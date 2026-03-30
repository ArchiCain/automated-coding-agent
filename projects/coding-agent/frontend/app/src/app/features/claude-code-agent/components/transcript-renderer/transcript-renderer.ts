import {
  Component,
  Input,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * Parsed SDK message types
 */
interface SystemInitMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
}

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | Array<{ type: string; text?: string }>;
}

interface AssistantMessage {
  type: 'assistant';
  message: {
    content: Array<TextBlock | ToolUseBlock>;
  };
}

interface UserMessage {
  type: 'user';
  message: {
    content: string | Array<ToolResultBlock>;
  };
}

type SDKMessage = SystemInitMessage | AssistantMessage | UserMessage | { type: string };

/**
 * Rendered item for display
 */
export interface TranscriptItem {
  id: string;
  type: 'system-init' | 'assistant-text' | 'tool-use' | 'tool-result' | 'user-text' | 'unknown';
  content: string;
  details?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  expanded: boolean;
}

@Component({
  selector: 'app-transcript-renderer',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './transcript-renderer.html',
  styleUrl: './transcript-renderer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TranscriptRendererComponent {
  @Input() set transcript(lines: string[]) {
    this.rawLines.set(lines);
  }

  private rawLines = signal<string[]>([]);

  // Track which items are expanded
  private expandedItems = signal<Set<string>>(new Set());

  // Parse and render transcript items
  items = computed(() => {
    const lines = this.rawLines();
    const items: TranscriptItem[] = [];
    let itemId = 0;

    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as SDKMessage;
        const parsed = this.parseMessage(msg, `item-${itemId++}`);
        items.push(...parsed);
      } catch {
        // Not JSON, treat as plain text (legacy format)
        if (line.trim()) {
          items.push({
            id: `item-${itemId++}`,
            type: 'unknown',
            content: line,
            expanded: false,
          });
        }
      }
    }

    return items;
  });

  /**
   * Parse an SDK message into renderable items
   */
  private parseMessage(msg: SDKMessage, baseId: string): TranscriptItem[] {
    const items: TranscriptItem[] = [];

    switch (msg.type) {
      case 'system':
        if ((msg as SystemInitMessage).subtype === 'init') {
          const initMsg = msg as SystemInitMessage;
          items.push({
            id: baseId,
            type: 'system-init',
            content: `Session started (${this.formatModelName(initMsg.model)})`,
            expanded: false,
          });
        }
        break;

      case 'assistant':
        const assistantMsg = msg as AssistantMessage;
        if (assistantMsg.message?.content) {
          let blockIdx = 0;
          for (const block of assistantMsg.message.content) {
            if (block.type === 'text' && (block as TextBlock).text?.trim()) {
              items.push({
                id: `${baseId}-${blockIdx++}`,
                type: 'assistant-text',
                content: (block as TextBlock).text.trim(),
                expanded: false,
              });
            } else if (block.type === 'tool_use') {
              const toolBlock = block as ToolUseBlock;
              items.push({
                id: `${baseId}-${blockIdx++}`,
                type: 'tool-use',
                content: this.formatToolUse(toolBlock.name, toolBlock.input),
                toolName: toolBlock.name,
                toolInput: toolBlock.input,
                details: JSON.stringify(toolBlock.input, null, 2),
                expanded: false,
              });
            }
          }
        }
        break;

      case 'user':
        const userMsg = msg as UserMessage;
        if (userMsg.message?.content) {
          if (typeof userMsg.message.content === 'string') {
            // Plain text user message
            items.push({
              id: baseId,
              type: 'user-text',
              content: userMsg.message.content,
              expanded: false,
            });
          } else if (Array.isArray(userMsg.message.content)) {
            // Tool results
            let blockIdx = 0;
            for (const block of userMsg.message.content) {
              if (block.type === 'tool_result') {
                const resultBlock = block as ToolResultBlock;
                const resultContent = this.extractToolResultContent(resultBlock.content);
                items.push({
                  id: `${baseId}-${blockIdx++}`,
                  type: 'tool-result',
                  content: this.truncateContent(resultContent, 100),
                  details: resultContent,
                  expanded: false,
                });
              }
            }
          }
        }
        break;
    }

    return items;
  }

  /**
   * Extract text content from tool result
   */
  private extractToolResultContent(content: string | Array<{ type: string; text?: string }>): string {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter(c => c.type === 'text' && c.text)
        .map(c => c.text)
        .join('\n');
    }
    return JSON.stringify(content);
  }

  /**
   * Format tool use for display
   */
  private formatToolUse(toolName: string, input: Record<string, unknown>): string {
    if (!input) return toolName;

    const getFileName = (filePath: string): string => {
      const parts = filePath.split('/');
      return parts[parts.length - 1] || filePath;
    };

    switch (toolName) {
      case 'Read':
        if (input['file_path']) {
          return `Read ${getFileName(input['file_path'] as string)}`;
        }
        break;
      case 'Write':
        if (input['file_path']) {
          return `Write ${getFileName(input['file_path'] as string)}`;
        }
        break;
      case 'Edit':
        if (input['file_path']) {
          return `Edit ${getFileName(input['file_path'] as string)}`;
        }
        break;
      case 'Bash':
        if (input['command']) {
          const cmd = (input['command'] as string).slice(0, 50);
          return `Bash: ${cmd}${(input['command'] as string).length > 50 ? '...' : ''}`;
        }
        break;
      case 'Glob':
        if (input['pattern']) {
          return `Glob ${input['pattern']}`;
        }
        break;
      case 'Grep':
        if (input['pattern']) {
          return `Grep "${input['pattern']}"`;
        }
        break;
      case 'TodoWrite':
        return 'Update task list';
      case 'Task':
        if (input['description']) {
          return `Task: ${input['description']}`;
        }
        break;
    }

    return toolName;
  }

  /**
   * Format model name
   */
  private formatModelName(model: string): string {
    if (model.includes('opus')) return 'Opus';
    if (model.includes('sonnet')) return 'Sonnet';
    if (model.includes('haiku')) return 'Haiku';
    return model;
  }

  /**
   * Truncate content for preview
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  }

  /**
   * Toggle item expansion
   */
  toggleExpand(item: TranscriptItem): void {
    item.expanded = !item.expanded;
  }

  /**
   * Check if item has expandable details
   */
  hasDetails(item: TranscriptItem): boolean {
    return !!item.details && item.details.length > 0;
  }

  /**
   * Get icon for item type
   */
  getIcon(item: TranscriptItem): string {
    switch (item.type) {
      case 'system-init':
        return 'play_circle';
      case 'assistant-text':
        return 'smart_toy';
      case 'tool-use':
        return 'build';
      case 'tool-result':
        return 'output';
      case 'user-text':
        return 'person';
      default:
        return 'notes';
    }
  }

  /**
   * Get tool icon
   */
  getToolIcon(toolName: string | undefined): string {
    switch (toolName) {
      case 'Read':
        return 'visibility';
      case 'Write':
        return 'edit_document';
      case 'Edit':
        return 'edit';
      case 'Bash':
        return 'terminal';
      case 'Glob':
        return 'folder_open';
      case 'Grep':
        return 'search';
      case 'TodoWrite':
        return 'checklist';
      case 'Task':
        return 'account_tree';
      default:
        return 'build';
    }
  }
}
