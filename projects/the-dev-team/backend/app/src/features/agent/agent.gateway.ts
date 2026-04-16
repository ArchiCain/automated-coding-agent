import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { AgentService, NormalizedMessage } from './agent.service';
import { normalizeMessage } from './normalize-message';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/agent' })
export class AgentGateway {
  private readonly logger = new Logger(AgentGateway.name);

  constructor(private readonly agentService: AgentService) {}

  /**
   * Client joins a session — send the full conversation history
   * including the system prompt so the UI has complete context.
   */
  @SubscribeMessage('join:session')
  handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    this.logger.log(`Client joining session ${data.sessionId}`);
    try {
      const { systemPrompt, messages } = this.agentService.getHistory(data.sessionId);
      client.emit('agent:history', {
        sessionId: data.sessionId,
        systemPrompt,
        messages,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to send history for session ${data.sessionId}: ${errorMessage}`);
    }
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; message: string },
  ) {
    this.logger.log(`Message received for session ${data.sessionId}`);

    // Store the user message in history
    const userMsg: NormalizedMessage = {
      sessionId: data.sessionId,
      type: 'user',
      content: data.message,
    };
    this.agentService.addMessage(data.sessionId, userMsg);

    try {
      for await (const msg of this.agentService.sendMessage(data.sessionId, data.message)) {
        const normalized = normalizeMessage(msg, data.sessionId);
        if (normalized) {
          // Store in history and emit to client
          this.agentService.addMessage(data.sessionId, normalized);
          client.emit('agent:message', normalized);
        }
      }
      client.emit('agent:done', { sessionId: data.sessionId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error in session ${data.sessionId}: ${errorMessage}`);
      const errorMsg: NormalizedMessage = {
        sessionId: data.sessionId,
        type: 'error',
        content: errorMessage,
      };
      this.agentService.addMessage(data.sessionId, errorMsg);
      client.emit('agent:error', { sessionId: data.sessionId, error: errorMessage });
    }
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
