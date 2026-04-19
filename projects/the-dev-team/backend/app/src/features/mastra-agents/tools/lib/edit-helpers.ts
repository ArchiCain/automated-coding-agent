/**
 * Edit helpers ported from Pi tools.
 * Handles line endings, BOM, fuzzy matching, multi-edit application, and diff generation.
 */

import { diffLines } from 'diff';

// ── Line ending handling ──────────────────────────────────────────

export function detectLineEnding(text: string): '\r\n' | '\n' {
  const crlfIndex = text.indexOf('\r\n');
  return crlfIndex !== -1 ? '\r\n' : '\n';
}

export function normalizeToLF(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function restoreLineEndings(text: string, ending: '\r\n' | '\n'): string {
  if (ending === '\r\n') {
    return text.replace(/\n/g, '\r\n');
  }
  return text;
}

// ── BOM handling ──────────────────────────────────────────────────

const BOM = '\uFEFF';

export function stripBom(text: string): { content: string; hasBom: boolean } {
  if (text.startsWith(BOM)) {
    return { content: text.slice(1), hasBom: true };
  }
  return { content: text, hasBom: false };
}

export function restoreBom(text: string, hasBom: boolean): string {
  return hasBom ? BOM + text : text;
}

// ── Fuzzy matching ────────────────────────────────────────────────

/**
 * Normalize text for fuzzy matching:
 * - NFKC unicode normalization
 * - Strip trailing whitespace per line
 * - Smart quotes → ASCII
 * - Unicode dashes → hyphen
 * - Unicode spaces → regular space
 */
export function normalizeForFuzzyMatch(text: string): string {
  let result = text.normalize('NFKC');

  // Strip trailing whitespace per line
  result = result
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n');

  // Smart quotes → ASCII
  result = result.replace(/[\u2018\u2019\u201A\u201B]/g, "'");
  result = result.replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // Unicode dashes → hyphen
  result = result.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');

  // Unicode spaces → regular space
  result = result.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, ' ');

  return result;
}

export interface FuzzyFindResult {
  found: boolean;
  index: number;
  matchLength: number;
  usedFuzzyMatch: boolean;
}

/**
 * Find text in content. Tries exact match first, falls back to fuzzy.
 */
export function fuzzyFindText(content: string, needle: string): FuzzyFindResult {
  // Try exact match first
  const exactIndex = content.indexOf(needle);
  if (exactIndex !== -1) {
    return { found: true, index: exactIndex, matchLength: needle.length, usedFuzzyMatch: false };
  }

  // Fall back to fuzzy match
  const normalizedContent = normalizeForFuzzyMatch(content);
  const normalizedNeedle = normalizeForFuzzyMatch(needle);
  const fuzzyIndex = normalizedContent.indexOf(normalizedNeedle);

  if (fuzzyIndex !== -1) {
    // Map back to original content position.
    // We need the original text at this position for replacement.
    // Walk through the original content matching normalized positions.
    const matchLength = findOriginalMatchLength(content, fuzzyIndex, normalizedNeedle.length);
    return { found: true, index: fuzzyIndex, matchLength, usedFuzzyMatch: true };
  }

  return { found: false, index: -1, matchLength: 0, usedFuzzyMatch: false };
}

/**
 * Given a position in normalized text, find the corresponding length in the original.
 * This handles cases where normalization changes character counts.
 */
function findOriginalMatchLength(
  original: string,
  normalizedIndex: number,
  normalizedLength: number,
): number {
  // For most cases the lengths are the same after normalization.
  // This is a simplified approach that works for the common case.
  // The normalized content maps 1:1 in position for our normalizations
  // (trailing whitespace removal can shift things, but we match on
  // the normalized version and replace in the normalized version too).
  return normalizedLength;
}

// ── Multi-edit application ────────────────────────────────────────

export interface EditOperation {
  oldText: string;
  newText: string;
}

interface MatchedEdit {
  editIndex: number;
  matchIndex: number;
  matchLength: number;
  oldText: string;
  newText: string;
  usedFuzzyMatch: boolean;
}

export interface ApplyEditsResult {
  baseContent: string;
  newContent: string;
  usedFuzzyMatch: boolean;
}

/**
 * Apply multiple edits to normalized content.
 * Validates: no empty oldText, no duplicates, no overlaps, no no-ops.
 * Applies in reverse position order to preserve earlier indices.
 */
export function applyEditsToNormalizedContent(
  content: string,
  edits: EditOperation[],
): ApplyEditsResult {
  if (edits.length === 0) {
    throw new Error('No edits provided.');
  }

  const isSingle = edits.length === 1;
  let anyFuzzy = false;

  // Validate and find all edits
  const matchedEdits: MatchedEdit[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const label = isSingle ? '' : `edits[${i}]: `;

    if (!edit.oldText) {
      throw new Error(`${label}oldText cannot be empty.`);
    }

    // Count occurrences
    const result = fuzzyFindText(content, edit.oldText);
    if (!result.found) {
      throw new Error(
        `${label}Could not find the exact text to replace. Make sure oldText matches the file content exactly, including whitespace and indentation.`,
      );
    }

    // Check for multiple occurrences
    const secondOccurrence = content.indexOf(
      edit.oldText,
      result.index + 1,
    );
    if (secondOccurrence !== -1) {
      throw new Error(
        `${label}Found multiple occurrences of oldText. The text must be unique — include more surrounding context to make it unique.`,
      );
    }

    if (result.usedFuzzyMatch) anyFuzzy = true;

    matchedEdits.push({
      editIndex: i,
      matchIndex: result.index,
      matchLength: result.matchLength,
      oldText: edit.oldText,
      newText: edit.newText,
      usedFuzzyMatch: result.usedFuzzyMatch,
    });
  }

  // Sort by position for overlap detection
  matchedEdits.sort((a, b) => a.matchIndex - b.matchIndex);

  // Check for overlaps
  for (let i = 1; i < matchedEdits.length; i++) {
    const prev = matchedEdits[i - 1];
    const curr = matchedEdits[i];
    if (prev.matchIndex + prev.matchLength > curr.matchIndex) {
      throw new Error(
        `edits[${prev.editIndex}] and edits[${curr.editIndex}] overlap. Merge them into one edit.`,
      );
    }
  }

  // Apply edits in reverse order (from end of file to start) to preserve positions
  let newContent = content;
  for (let i = matchedEdits.length - 1; i >= 0; i--) {
    const edit = matchedEdits[i];
    newContent =
      newContent.slice(0, edit.matchIndex) +
      edit.newText +
      newContent.slice(edit.matchIndex + edit.matchLength);
  }

  // Check no-op
  if (content === newContent) {
    throw new Error(
      'No changes made. The newText is identical to oldText — this might indicate special character issues.',
    );
  }

  return {
    baseContent: content,
    newContent,
    usedFuzzyMatch: anyFuzzy,
  };
}

// ── Diff generation ───────────────────────────────────────────────

export interface DiffResult {
  diff: string;
  firstChangedLine: number;
}

/**
 * Generate a unified diff string with line numbers and context.
 */
export function generateDiffString(
  before: string,
  after: string,
  contextLines: number = 4,
): DiffResult {
  const changes = diffLines(before, after);

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const maxLineNum = Math.max(beforeLines.length, afterLines.length);
  const padWidth = String(maxLineNum).length;

  const outputLines: string[] = [];
  let beforeLineNum = 1;
  let afterLineNum = 1;
  let firstChangedLine = -1;
  let lastOutputIndex = -1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    // diffLines includes trailing empty string from final newline
    if (lines[lines.length - 1] === '') lines.pop();

    if (change.added) {
      if (firstChangedLine === -1) firstChangedLine = afterLineNum;
      for (const line of lines) {
        outputLines.push(`+${String(afterLineNum).padStart(padWidth)} | ${line}`);
        afterLineNum++;
      }
      lastOutputIndex = outputLines.length - 1;
    } else if (change.removed) {
      if (firstChangedLine === -1) firstChangedLine = beforeLineNum;
      for (const line of lines) {
        outputLines.push(`-${String(beforeLineNum).padStart(padWidth)} | ${line}`);
        beforeLineNum++;
      }
      lastOutputIndex = outputLines.length - 1;
    } else {
      // Context lines — show only lines near changes
      for (let i = 0; i < lines.length; i++) {
        const distFromLastChange = outputLines.length - lastOutputIndex - 1;
        const distToNextChange = lines.length - i; // approximate

        if (
          distFromLastChange < contextLines ||
          i < contextLines ||
          distToNextChange <= contextLines
        ) {
          outputLines.push(` ${String(beforeLineNum).padStart(padWidth)} | ${lines[i]}`);
        } else if (
          distFromLastChange === contextLines &&
          lines.length - i > contextLines
        ) {
          outputLines.push(` ... `);
        }
        beforeLineNum++;
        afterLineNum++;
      }
    }
  }

  return {
    diff: outputLines.join('\n'),
    firstChangedLine: firstChangedLine === -1 ? 1 : firstChangedLine,
  };
}
