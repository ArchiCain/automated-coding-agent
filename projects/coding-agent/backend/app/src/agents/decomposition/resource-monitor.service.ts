import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface NodeUsage {
  cpuPercent: number;
  memoryPercent: number;
}

/**
 * Checks cluster resource availability by querying kubectl.
 * Falls back gracefully when kubectl is unavailable (returns true).
 */
@Injectable()
export class ResourceMonitorService {
  private readonly logger = new Logger(ResourceMonitorService.name);

  /**
   * Returns true if cluster CPU and memory usage are both below
   * the given threshold percentage, or if resource data cannot
   * be retrieved (fail-open).
   */
  async hasClusterCapacity(threshold = 80): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync('kubectl', [
        'top',
        'nodes',
        '--no-headers',
      ]);
      const usage = this.parseNodeUsage(stdout);
      const withinCapacity =
        usage.cpuPercent < threshold && usage.memoryPercent < threshold;

      if (!withinCapacity) {
        this.logger.warn(
          `Cluster capacity exceeded threshold (${threshold}%): ` +
            `CPU=${usage.cpuPercent}%, Memory=${usage.memoryPercent}%`,
        );
      }

      return withinCapacity;
    } catch {
      // kubectl not available or command failed — assume capacity is available
      this.logger.debug(
        'Could not check cluster capacity (kubectl unavailable), assuming available',
      );
      return true;
    }
  }

  private parseNodeUsage(output: string): NodeUsage {
    const lines = output.trim().split('\n');
    if (lines.length === 0 || !lines[0].trim()) {
      return { cpuPercent: 0, memoryPercent: 0 };
    }

    // kubectl top nodes format: NAME  CPU(cores)  CPU%  MEMORY(bytes)  MEMORY%
    const parts = lines[0].trim().split(/\s+/);
    const cpuPercent = parseInt(parts[2]?.replace('%', '') ?? '0', 10);
    const memoryPercent = parseInt(parts[4]?.replace('%', '') ?? '0', 10);

    return {
      cpuPercent: isNaN(cpuPercent) ? 0 : cpuPercent,
      memoryPercent: isNaN(memoryPercent) ? 0 : memoryPercent,
    };
  }
}
