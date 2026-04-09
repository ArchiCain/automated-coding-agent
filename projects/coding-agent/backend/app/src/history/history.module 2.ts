import { Module } from '@nestjs/common';
import { TranscriptWriterService } from './transcript-writer.service';
import { TaskSummaryService } from './task-summary.service';
import { HistoryInitService } from './history-init.service';

@Module({
  providers: [TranscriptWriterService, TaskSummaryService, HistoryInitService],
  exports: [TranscriptWriterService, TaskSummaryService],
})
export class HistoryModule {}
