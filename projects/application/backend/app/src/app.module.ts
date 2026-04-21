import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeormDatabaseClientModule } from "./features/typeorm-database-client";
import { CorsModule } from "./features/cors";
import {
  KeycloakAuthModule,
  KeycloakJwtGuard,
  PermissionGuard,
} from "./features/keycloak-auth";
import { ThemeModule } from "./features/theme";
import { UserManagementModule } from "./features/user-management";
import { HealthModule } from "./features/health";
import { ChatAgentModule } from "./features/chat-agent";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../../../.env"],
    }),
    CorsModule,
    TypeormDatabaseClientModule.forRoot(),
    KeycloakAuthModule,
    ThemeModule,
    UserManagementModule,
    HealthModule,
    ChatAgentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: KeycloakJwtGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
