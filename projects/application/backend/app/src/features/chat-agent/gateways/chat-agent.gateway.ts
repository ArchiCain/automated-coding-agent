import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Socket } from "socket.io";
import { ChatAgentService } from "../services/chat-agent.service";

const DEFAULT_RESOURCE = "default-user";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "/agent",
})
export class ChatAgentGateway {
  private readonly logger = new Logger(ChatAgentGateway.name);

  constructor(private readonly service: ChatAgentService) {}

  @SubscribeMessage("join:session")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    this.logger.log(`join:session ${data.sessionId}`);
    const resourceId = this.getResourceId(client);
    const history = await this.service.getHistory(data.sessionId, resourceId);
    client.emit("agent:history", history);
  }

  @SubscribeMessage("message")
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; message: string },
  ) {
    this.logger.log(`message sessionId=${data.sessionId}`);
    const resourceId = this.getResourceId(client);
    try {
      for await (const msg of this.service.streamAssistantTurn(
        data.sessionId,
        resourceId,
        data.message,
      )) {
        client.emit("agent:message", msg);
      }
      client.emit("agent:done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`stream error for ${data.sessionId}: ${message}`);
      client.emit("agent:error", { message });
    }
  }

  @SubscribeMessage("cancel")
  handleCancel(@MessageBody() data: { sessionId: string }) {
    this.logger.log(`cancel sessionId=${data.sessionId}`);
    this.service.cancel(data.sessionId);
  }

  private getResourceId(_client: Socket): string {
    return DEFAULT_RESOURCE;
  }
}
