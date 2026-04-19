/**
 * Dual-constraint truncation utilities ported from Pi tools.
 * Truncates by line count AND byte size, whichever limit hits first.
 * UTF-8 safe — never cuts mid-character.
 */

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
export const GREP_MAX_LINE_LENGTH = 500;

export interface TruncationResult {
  content: string;
  truncated: boolean;
  truncatedBy: 'lines' | 'bytes' | null;
  totalLines: number;
  totalBytes: number;
  outputLines: number;
  outputBytes: number;
  lastLinePartial: boolean;
  firstLineExceedsLimit: boolean;
  maxLines: number;
  maxBytes: number;
}

/**
 * Keep the first N lines/bytes (drops content from the end).
 */
export function truncateHead(
  text: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxBytes: number = DEFAULT_MAX_BYTES,
): TruncationResult {
  const lines = text.split('\n');
  const totalLines = lines.length;
  const totalBytes = Buffer.byteLength(text, 'utf-8');

  // Already fits?
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content: text,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    };
  }

  // Special case: first line alone exceeds byte limit
  const firstLineBytes = Buffer.byteLength(lines[0], 'utf-8');
  if (firstLineBytes > maxBytes) {
    return {
      content: '',
      truncated: true,
      truncatedBy: 'bytes',
      totalLines,
      totalBytes,
      outputLines: 0,
      outputBytes: 0,
      lastLinePartial: false,
      firstLineExceedsLimit: true,
      maxLines,
      maxBytes,
    };
  }

  const outputLines: string[] = [];
  let currentBytes = 0;
  let truncatedBy: 'lines' | 'bytes' = 'lines';

  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8');
    const separator = i > 0 ? 1 : 0; // newline char
    if (currentBytes + lineBytes + separator > maxBytes) {
      truncatedBy = 'bytes';
      break;
    }
    currentBytes += lineBytes + separator;
    outputLines.push(lines[i]);
  }

  if (outputLines.length >= maxLines && currentBytes <= maxBytes) {
    truncatedBy = 'lines';
  }

  const content = outputLines.join('\n');
  const truncated = outputLines.length < totalLines;

  return {
    content,
    truncated,
    truncatedBy: truncated ? truncatedBy : null,
    totalLines,
    totalBytes,
    outputLines: outputLines.length,
    outputBytes: Buffer.byteLength(content, 'utf-8'),
    lastLinePartial: false,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  };
}

/**
 * Keep the last N lines/bytes (drops content from the beginning).
 */
export function truncateTail(
  text: string,
  maxLines: number = DEFAULT_MAX_LINES,
  maxBytes: number = DEFAULT_MAX_BYTES,
): TruncationResult {
  const lines = text.split('\n');
  const totalLines = lines.length;
  const totalBytes = Buffer.byteLength(text, 'utf-8');

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content: text,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    };
  }

  const outputLines: string[] = [];
  let currentBytes = 0;
  let truncatedBy: 'lines' | 'bytes' = 'lines';
  let lastLinePartial = false;

  // Iterate backwards
  for (let i = lines.length - 1; i >= 0 && outputLines.length < maxLines; i--) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8');
    const separator = outputLines.length > 0 ? 1 : 0;

    if (currentBytes + lineBytes + separator > maxBytes) {
      truncatedBy = 'bytes';
      // If this is the first line we're collecting (last line of file),
      // truncate it from the end to fit
      if (outputLines.length === 0) {
        const truncated = truncateStringToBytesFromEnd(lines[i], maxBytes);
        if (truncated.length > 0) {
          outputLines.unshift(truncated);
          lastLinePartial = true;
        }
      }
      break;
    }

    currentBytes += lineBytes + separator;
    outputLines.unshift(lines[i]);
  }

  if (outputLines.length >= maxLines && currentBytes <= maxBytes) {
    truncatedBy = 'lines';
  }

  const content = outputLines.join('\n');
  const truncated = outputLines.length < totalLines;

  return {
    content,
    truncated,
    truncatedBy: truncated ? truncatedBy : null,
    totalLines,
    totalBytes,
    outputLines: outputLines.length,
    outputBytes: Buffer.byteLength(content, 'utf-8'),
    lastLinePartial,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  };
}

/**
 * Truncate a string from the right while respecting UTF-8 boundaries.
 */
function truncateStringToBytesFromEnd(str: string, maxBytes: number): string {
  const buf = Buffer.from(str, 'utf-8');
  if (buf.length <= maxBytes) return str;

  let start = buf.length - maxBytes;
  // Advance past any UTF-8 continuation bytes (10xxxxxx pattern)
  while (start < buf.length && (buf[start] & 0xc0) === 0x80) {
    start++;
  }

  return buf.subarray(start).toString('utf-8');
}

/**
 * Truncate a single line to max chars. Used for grep match lines.
 */
export function truncateLine(
  line: string,
  maxChars: number = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } {
  if (line.length <= maxChars) {
    return { text: line, wasTruncated: false };
  }
  return { text: line.slice(0, maxChars) + '... [truncated]', wasTruncated: true };
}

/**
 * Format byte count as human-readable string.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
