import { Module } from '@nestjs/common';
import { CommandCenterService } from './services/command-center.service';
import { CommandCenterController } from './controllers/command-center.controller';

@Module({
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}
