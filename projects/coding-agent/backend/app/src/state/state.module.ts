import { Module } from '@nestjs/common';
import { TaskStateService } from './task-state.service';
import { FindingsService } from './findings.service';

@Module({
  providers: [TaskStateService, FindingsService],
  exports: [TaskStateService, FindingsService],
})
export class StateModule {}
