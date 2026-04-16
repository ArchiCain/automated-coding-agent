import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { TaskRunnerService } from './task-runner.service';

@Controller('task-runner')
export class TaskRunnerController {
  constructor(private readonly taskRunnerService: TaskRunnerService) {}

  @Post('tasks')
  startTask(@Body() body: { taskName: string; vars?: Record<string, string> }) {
    return this.taskRunnerService.startTask(body.taskName, body.vars);
  }

  @Get('tasks')
  listTasks() {
    return this.taskRunnerService.listTasks();
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return this.taskRunnerService.getTask(id);
  }

  @Post('tasks/:id/cancel')
  cancelTask(@Param('id') id: string) {
    this.taskRunnerService.cancelTask(id);
    return { success: true };
  }

  @Post('tasks/:id/dismiss')
  dismissTask(@Param('id') id: string) {
    this.taskRunnerService.dismissTask(id);
    return { success: true };
  }

  @Get('allowed-tasks')
  getAllowedTasks() {
    return this.taskRunnerService.getAllowedTasks();
  }
}
