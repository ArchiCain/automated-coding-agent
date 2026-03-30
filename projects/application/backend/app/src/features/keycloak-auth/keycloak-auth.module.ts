import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KeycloakAuthService } from './services/keycloak-auth.service';
import { KeycloakAuthController } from './controllers/keycloak-auth.controller';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [ConfigModule],
  controllers: [KeycloakAuthController],
  providers: [KeycloakAuthService, PermissionGuard],
  exports: [KeycloakAuthService, PermissionGuard],
})
export class KeycloakAuthModule {}