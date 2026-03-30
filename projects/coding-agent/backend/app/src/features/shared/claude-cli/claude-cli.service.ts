import { Injectable, Logger } from "@nestjs/common";
import { query, SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

export interface ClaudeRunOptions {
  cwd?: string;
  model?: string;
}

@Injectable()
export class ClaudeCliService {
  private readonly logger = new Logger(ClaudeCliService.name);

  /**
   * Run a prompt using the Claude Agent SDK.
   * Returns 0 on success, 1 on failure.
   */
  async run(prompt: string, options?: ClaudeRunOptions): Promise<number> {
    this.logger.debug("Running prompt via Claude Agent SDK...");

    try {
      const queryResult = query({
        prompt,
        options: {
          cwd: options?.cwd || process.cwd(),
          model: options?.model || "claude-opus-4-5-20251101",
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
        },
      });

      let result: SDKResultMessage | null = null;

      // Iterate through the async generator to get all messages
      for await (const message of queryResult) {
        this.logMessage(message);

        // Capture the final result
        if (message.type === "result") {
          result = message;
        }
      }

      if (result) {
        if (result.subtype === "success") {
          this.logger.debug(`Claude completed successfully. Cost: $${result.total_cost_usd.toFixed(4)}`);
          return 0;
        } else {
          this.logger.error(`Claude execution failed: ${result.subtype}`);
          if ("errors" in result && result.errors.length > 0) {
            result.errors.forEach((err) => this.logger.error(`  - ${err}`));
          }
          return 1;
        }
      }

      this.logger.error("No result received from Claude");
      return 1;
    } catch (err) {
      this.logger.error(`Failed to run prompt: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  /**
   * Log SDK messages for debugging.
   */
  private logMessage(message: SDKMessage): void {
    switch (message.type) {
      case "assistant":
        // Log assistant responses (text blocks only, not tool use)
        if (message.message?.content) {
          for (const block of message.message.content) {
            if (block.type === "text") {
              this.logger.debug(`Assistant: ${block.text.slice(0, 200)}...`);
            }
          }
        }
        break;
      case "system":
        if (message.subtype === "init") {
          this.logger.debug(`Session initialized. Model: ${message.model}`);
        }
        break;
      case "result":
        // Handled in the main flow
        break;
      default:
        // Ignore other message types for now
        break;
    }
  }
}
