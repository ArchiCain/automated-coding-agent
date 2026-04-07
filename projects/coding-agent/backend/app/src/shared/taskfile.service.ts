import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

export interface TaskfileRunOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

@Injectable()
export class TaskfileService {
  private readonly logger = new Logger(TaskfileService.name);

  async run(
    taskName: string,
    args?: string[],
    options?: TaskfileRunOptions,
  ): Promise<{ stdout: string; stderr: string }> {
    const cmdArgs = [taskName, ...(args ?? [])];
    this.logger.debug(`Running: task ${cmdArgs.join(' ')}`);

    const execOptions: Record<string, unknown> = {
      cwd: options?.cwd ?? process.cwd(),
      timeout: options?.timeout ?? 300_000,
      maxBuffer: 1024 * 1024 * 10,
    };

    if (options?.env) {
      execOptions.env = {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        ...options.env,
      };
    }

    const { stdout, stderr } = await execFile('task', cmdArgs, execOptions);
    return { stdout, stderr };
  }
}
