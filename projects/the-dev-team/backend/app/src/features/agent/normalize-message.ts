import type { AgentMessage } from './providers/provider.interface';
import type { NormalizedMessage } from './agent.service';

/**
 * Normalize Claude Code SDK messages into a consistent shape.
 * SDK emits various message types with different structures — this extracts
 * the useful content into a flat { type, content, tool, input, output } shape.
 */
export function normalizeMessage(msg: AgentMessage, sessionId: string): NormalizedMessage | null {
  const type = msg.type as string;

  // Skip noise and the final result (duplicates the streamed assistant text)
  if (type === 'rate_limit_event' || type === 'system' || type === 'result') {
    return null;
  }

  // Assistant text message
  if (type === 'assistant') {
    const message = msg['message'] as Record<string, unknown> | undefined;
    const contentBlocks = (message?.content ?? msg['content']) as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(contentBlocks)) {
      const text = contentBlocks
        .filter((b) => b.type === 'text')
        .map((b) => b.text as string)
        .join('');
      if (text) {
        return { sessionId, type: 'assistant', content: text };
      }
      // Tool use blocks embedded in assistant message
      for (const block of contentBlocks) {
        if (block.type === 'tool_use') {
          return {
            sessionId,
            type: 'tool_use',
            tool: block.name as string,
            input: block.input,
          };
        }
      }
    }
    return null;
  }

  // Tool result
  if (type === 'tool_result') {
    const content = msg['content'] as Array<Record<string, unknown>> | string | undefined;
    let output = '';
    if (Array.isArray(content)) {
      output = content.map((b) => (b.text as string) ?? '').join('');
    } else if (typeof content === 'string') {
      output = content;
    }
    return { sessionId, type: 'tool_result', output: output.slice(0, 2000) };
  }

  // Error
  if (type === 'error') {
    return { sessionId, type: 'error', content: (msg['error'] as string) ?? 'Unknown error' };
  }

  // Everything else — skip
  return null;
}
