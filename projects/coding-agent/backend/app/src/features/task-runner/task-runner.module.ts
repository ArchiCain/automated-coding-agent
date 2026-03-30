import { Module } from '@nestjs/common';
import { TaskService } from './services/task.service';
import { TaskGateway } from './gateway/task.gateway';

@Module({
  providers: [TaskService, TaskGateway],
  exports: [TaskService],
})
export class TaskRunnerModule {}
