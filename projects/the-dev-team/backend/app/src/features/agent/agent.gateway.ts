import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AgentService } from './agent.service';
import { AgentMessage } from './providers/provider.interface';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/agent' })
export class AgentGateway {
  private readonly logger = new Logger(AgentGateway.name);

  constructor(private readonly agentService: AgentService) {}

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; message: string },
  ) {
    this.logger.log(`Message received for session ${data.sessionId}`);
    try {
      for await (const msg of this.agentService.sendMessage(data.sessionId, data.message)) {
        const normalized = this.normalizeMessage(msg, data.sessionId);
        if (normalized) {
          client.emit('agent:message', normalized);
        }
      }
      client.emit('agent:done', { sessionId: data.sessionId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error in session ${data.sessionId}: ${errorMessage}`);
      client.emit('agent:error', { sessionId: data.sessionId, error: errorMessage });
    }
  }

  /**
   * Normalize Claude Code SDK messages into a consistent shape for the frontend.
   * SDK emits various message types with different structures — this extracts
   * the useful content into a flat { type, content, tool, input, output } shape.
   */
  private normalizeMessage(msg: AgentMessage, sessionId: string): Record<string, unknown> | null {
    const type = msg.type as string;

    // Skip noise
    if (type === 'rate_limit_event' || type === 'system') {
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

    // Final result
    if (type === 'result') {
      const result = (msg['result'] as string) ?? '';
      return { sessionId, type: 'result', content: result };
    }

    // Error
    if (type === 'error') {
      return { sessionId, type: 'error', content: (msg['error'] as string) ?? 'Unknown error' };
    }

    // Everything else — skip
    return null;
  }

  @SubscribeMessage('cancel')
  handleCancel(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    this.logger.log(`Cancel requested for session ${data.sessionId}`);
    this.agentService.cancelSession(data.sessionId);
    client.emit('agent:cancelled', { sessionId: data.sessionId });
  }
}
