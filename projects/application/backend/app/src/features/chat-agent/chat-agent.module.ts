import { Module } from "@nestjs/common";
import { KeycloakAuthModule } from "../keycloak-auth";
import { ChatAgentService } from "./services/chat-agent.service";
import { ChatAgentGateway } from "./gateways/chat-agent.gateway";
import { ChatAgentController } from "./controllers/chat-agent.controller";

@Module({
  imports: [KeycloakAuthModule],
  controllers: [ChatAgentController],
  providers: [ChatAgentService, ChatAgentGateway],
})
export class ChatAgentModule {}
