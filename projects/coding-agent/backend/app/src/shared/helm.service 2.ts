import { Injectable, Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';

const execFile = promisify(execFileCb);

@Injectable()
export class HelmService {
  private readonly logger = new Logger(HelmService.name);

  async install(
    name: string,
    chart: string,
    namespace: string,
    values?: Record<string, string>,
  ): Promise<string> {
    const args = ['install', name, chart, '--namespace', namespace, '--create-namespace'];

    if (values) {
      for (const [key, val] of Object.entries(values)) {
        args.push('--set', `${key}=${val}`);
      }
    }

    this.logger.log(`Helm install: ${name} from ${chart} in ${namespace}`);
    const { stdout } = await execFile('helm', args);
    return stdout;
  }

  async uninstall(name: string, namespace: string): Promise<string> {
    this.logger.log(`Helm uninstall: ${name} in ${namespace}`);
    const { stdout } = await execFile('helm', [
      'uninstall',
      name,
      '--namespace',
      namespace,
    ]);
    return stdout;
  }

  async status(name: string, namespace: string): Promise<string> {
    const { stdout } = await execFile('helm', [
      'status',
      name,
      '--namespace',
      namespace,
    ]);
    return stdout;
  }
}
