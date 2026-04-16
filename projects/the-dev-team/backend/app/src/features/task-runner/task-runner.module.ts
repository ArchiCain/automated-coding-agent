import { Module } from '@nestjs/common';
import { TaskRunnerController } from './task-runner.controller';
import { TaskRunnerService } from './task-runner.service';
import { TaskRunnerGateway } from './task-runner.gateway';

@Module({
  controllers: [TaskRunnerController],
  providers: [TaskRunnerService, TaskRunnerGateway],
  exports: [TaskRunnerService],
})
export class TaskRunnerModule {}
