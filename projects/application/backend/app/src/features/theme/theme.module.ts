import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeController } from './controllers/theme.controller';
import { ThemeService } from './services/theme.service';
import { UserTheme } from '../typeorm-database-client/entities';
import { KeycloakAuthModule } from '../keycloak-auth';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTheme]),
    KeycloakAuthModule,
  ],
  controllers: [ThemeController],
  providers: [ThemeService],
  exports: [ThemeService],
})
export class ThemeModule {}
