import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

@Injectable()
export class DockerService {
  private readonly logger = new Logger(DockerService.name);

  async build(tag: string, context: string, dockerfile?: string): Promise<string> {
    const args = ['build', '-t', tag];
    if (dockerfile) {
      args.push('-f', dockerfile);
    }
    args.push(context);

    this.logger.log(`Docker build: ${tag}`);
    const { stdout } = await execFile('docker', args, {
      maxBuffer: 1024 * 1024 * 50,
      timeout: 600_000,
    });
    return stdout;
  }

  async push(tag: string): Promise<string> {
    this.logger.log(`Docker push: ${tag}`);
    const { stdout } = await execFile('docker', ['push', tag]);
    return stdout;
  }
}
