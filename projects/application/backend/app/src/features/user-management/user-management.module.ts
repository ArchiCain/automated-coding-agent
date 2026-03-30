import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UserManagementService } from './services/user-management.service';
import { UserManagementController } from './controllers/user-management.controller';
import { KeycloakAuthModule } from '../keycloak-auth';

@Module({
  imports: [ConfigModule, KeycloakAuthModule],
  controllers: [UserManagementController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserManagementModule {}
