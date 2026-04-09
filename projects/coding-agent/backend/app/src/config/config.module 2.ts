import { Module } from '@nestjs/common';
import { DevTeamConfigService } from './dev-team-config.service';

@Module({
  providers: [DevTeamConfigService],
  exports: [DevTeamConfigService],
})
export class ConfigModule {}
