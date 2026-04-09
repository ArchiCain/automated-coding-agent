import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class HistoryInitService implements OnModuleInit {
  private readonly logger = new Logger(HistoryInitService.name);
  private readonly historyRoot: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || process.cwd();
    this.historyRoot = path.join(repoRoot, '.the-dev-team', 'history');
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('Ensuring history directories exist');

    const dirs = [
      path.join(this.historyRoot, 'sessions'),
      path.join(this.historyRoot, 'tasks'),
      path.join(this.historyRoot, 'orchestrator'),
      path.join(this.historyRoot, 'state'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Ensure index.jsonl exists
    const indexPath = path.join(this.historyRoot, 'tasks', 'index.jsonl');
    try {
      await fs.access(indexPath);
    } catch {
      await fs.writeFile(indexPath, '', 'utf-8');
      this.logger.debug('Created index.jsonl');
    }

    this.logger.log('History directories initialized');
  }
}
