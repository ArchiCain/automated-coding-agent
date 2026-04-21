import {
  WebSocketGateway,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Socket } from "socket.io";
import { KeycloakAuthService } from "../../keycloak-auth";
import { ChatAgentService } from "../services/chat-agent.service";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: "/agent",
})
export class ChatAgentGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatAgentGateway.name);

  constructor(
    private readonly service: ChatAgentService,
    private readonly auth: KeycloakAuthService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      this.logger.warn(`WS ${client.id}: no access_token cookie; disconnecting`);
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.auth.validateToken(token);
      (client.data as { resourceId?: string; username?: string }).resourceId = user.id;
      (client.data as { resourceId?: string; username?: string }).username = user.username;
      this.logger.log(`WS ${client.id}: connected as ${user.username} (${user.id})`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`WS ${client.id}: invalid token — ${msg}; disconnecting`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join:session")
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string },
  ) {
    const resourceId = this.getResourceId(client);
    if (!resourceId) return;
    this.logger.log(`join:session ${data.sessionId} by ${resourceId}`);
    const history = await this.service.getHistory(data.sessionId, resourceId);
    client.emit("agent:history", history);
  }

  @SubscribeMessage("message")
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; message: string },
  ) {
    const resourceId = this.getResourceId(client);
    if (!resourceId) return;
    this.logger.log(`message sessionId=${data.sessionId} by ${resourceId}`);
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

  private extractToken(client: Socket): string | null {
    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
      const eq = part.indexOf("=");
      if (eq === -1) continue;
      const name = part.slice(0, eq).trim();
      if (name === "access_token") {
        return decodeURIComponent(part.slice(eq + 1).trim());
      }
    }
    return null;
  }

  private getResourceId(client: Socket): string | null {
    return (client.data as { resourceId?: string })?.resourceId ?? null;
  }
}
