import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeormDatabaseClientModule } from "./features/typeorm-database-client";
import { CorsModule } from "./features/cors";
import { MastraAgentsModule } from "./features/mastra-agents";
import { KeycloakAuthModule, KeycloakJwtGuard } from "./features/keycloak-auth";
import { ThemeModule } from "./features/theme";
import { UserManagementModule } from "./features/user-management";
import { HealthModule } from "./features/health";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CorsModule,
    TypeormDatabaseClientModule.forRoot(),
    KeycloakAuthModule,
    MastraAgentsModule,
    ThemeModule,
    UserManagementModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: KeycloakJwtGuard,
    },
  ],
})
export class AppModule {}
