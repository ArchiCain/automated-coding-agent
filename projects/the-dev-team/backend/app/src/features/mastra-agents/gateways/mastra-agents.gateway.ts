import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { execFileSync } from 'child_process';
import { getDocsAssistantAgent } from '../agents/docs-assistant.agent';
import { createSyncAgent } from '../agents/sync-agent.agent';
import type { MastraUsage } from '../mastra-agents.types';

interface IncomingMessage {
  agentName?: 'docs-assistant' | 'sync-agent';
  messages: Array<{ role: string; content: string }>;
  model?: string;
  systemPrompt?: string;
  worktreePath?: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/mastra' })
export class MastraAgentsGateway {
  private readonly logger = new Logger(MastraAgentsGateway.name);
  private readonly activeStreams = new Map<string, AbortController>();

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: IncomingMessage,
  ) {
    const agentName = data.agentName || 'docs-assistant';
    const model = data.model || 'anthropic/claude-haiku-4-5';
    const instructions = data.systemPrompt || '';

    this.logger.log(`Message received (agent: ${agentName}, model: ${model}, messages: ${data.messages.length})`);

    const abortController = new AbortController();
    this.activeStreams.set(client.id, abortController);

    // Capture HEAD for sync-complete detection
    let headBefore: string | null = null;
    if (agentName === 'sync-agent' && data.worktreePath) {
      try {
        headBefore = execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: data.worktreePath,
          encoding: 'utf-8',
        }).trim();
      } catch {
        this.logger.warn('Could not read HEAD before sync');
      }
    }

    try {
      // Route to the correct agent
      let agent: any;
      if (agentName === 'sync-agent') {
        if (!data.worktreePath) {
          client.emit('agent:error', 'worktreePath is required for sync-agent');
          return;
        }
        agent = await createSyncAgent(model, instructions, data.worktreePath);
      } else {
        agent = await getDocsAssistantAgent(model, instructions);
      }

      let stepIndex = 0;
      const stream = await agent.stream(data.messages, {
        abortSignal: abortController.signal,
        onStepFinish: (step: any) => {
          try {
            this.logger.log(`Step ${stepIndex} finished — keys: ${Object.keys(step).join(', ')}`);
            this.logger.log(`Step ${stepIndex} usage: ${JSON.stringify(step.usage)}`);

            const stepUsage = step.usage || {};
            const tools = (step.toolCalls || []).map((tc: any) =>
              tc.toolName || tc.payload?.toolName || 'unknown',
            );

            client.emit('agent:step', {
              step: stepIndex++,
              finishReason: step.finishReason,
              toolCalls: tools,
              usage: {
                inputTokens: stepUsage.promptTokens ?? stepUsage.inputTokens ?? 0,
                outputTokens: stepUsage.completionTokens ?? stepUsage.outputTokens ?? 0,
                totalTokens: stepUsage.totalTokens ?? 0,
                cachedInputTokens: stepUsage.cachedInputTokens ?? 0,
              },
            });
          } catch (err) {
            this.logger.error(`onStepFinish error: ${err}`);
          }
        },
      });

      for await (const chunk of stream.fullStream) {
        if (abortController.signal.aborted) break;
        if (chunk.type === 'text-delta') {
          client.emit('agent:delta', chunk.payload.text);
        } else if (chunk.type === 'tool-call') {
          client.emit('agent:tool-call', {
            toolName: chunk.payload.toolName,
            args: chunk.payload.args,
          });
        } else if (chunk.type === 'tool-result') {
          client.emit('agent:tool-result', {
            toolName: chunk.payload.toolName,
            result: chunk.payload.result,
          });
        }
      }

      // Emit usage after stream completes
      try {
        const usage = await stream.usage;
        const finishReason = await stream.finishReason;
        const usageData: MastraUsage = {
          inputTokens: usage?.inputTokens ?? 0,
          outputTokens: usage?.outputTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
          reasoningTokens: usage?.reasoningTokens ?? 0,
          cachedInputTokens: usage?.cachedInputTokens ?? 0,
        };
        client.emit('agent:usage', { usage: usageData, finishReason });
      } catch (err) {
        this.logger.warn('Failed to retrieve usage data', err);
      }

      // Check for new commits (sync-complete detection)
      if (agentName === 'sync-agent' && data.worktreePath && headBefore) {
        try {
          const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: data.worktreePath,
            encoding: 'utf-8',
          }).trim();

          if (headAfter !== headBefore) {
            this.logger.log(`Sync agent made commits: ${headBefore.slice(0, 7)} → ${headAfter.slice(0, 7)}`);
            client.emit('agent:sync-complete', {
              worktreePath: data.worktreePath,
              hasNewCommits: true,
              headBefore,
              headAfter,
            });
          }
        } catch {
          this.logger.warn('Could not check HEAD after sync');
        }
      }

      client.emit('agent:done');
    } catch (err) {
      if (abortController.signal.aborted) return;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Stream error: ${errorMessage}`);
      client.emit('agent:error', errorMessage);
    } finally {
      this.activeStreams.delete(client.id);
    }
  }

  @SubscribeMessage('cancel')
  handleCancel(@ConnectedSocket() client: Socket) {
    const controller = this.activeStreams.get(client.id);
    if (controller) {
      controller.abort();
      this.activeStreams.delete(client.id);
      this.logger.log('Stream cancelled');
    }
  }
}
