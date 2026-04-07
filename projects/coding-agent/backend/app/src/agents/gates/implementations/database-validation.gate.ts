import { Logger } from '@nestjs/common';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { ValidationGate, GateContext, GateResult } from '../gate.interface';

const execFile = promisify(execFileCb);

export class DatabaseValidationGate implements ValidationGate {
  readonly name = 'database-validation';
  readonly description = 'Validates database migration integrity and schema consistency';
  readonly phase = 2 as const;
  readonly applicableTo = 'backend' as const;

  private readonly logger = new Logger(DatabaseValidationGate.name);

  async run(context: GateContext): Promise<GateResult> {
    const start = Date.now();
    const results: string[] = [];
    let passed = true;

    // Step 1: Check git diff for new/modified migration files
    const migrationFiles = await this.findChangedMigrations(context);

    if (migrationFiles.length === 0) {
      return {
        gate: this.name,
        passed: true,
        output: 'No database changes — no new or modified migration files detected',
        details: { migrationsFound: 0 },
        durationMs: Date.now() - start,
        attempt: 1,
      };
    }

    results.push(
      `[Migration Files] Found ${migrationFiles.length} new/modified migration(s):\n${migrationFiles.map((f) => `  - ${f}`).join('\n')}`,
    );

    // Step 2: Validate each migration file
    const validationErrors: string[] = [];

    for (const migrationFile of migrationFiles) {
      const fullPath = path.join(context.worktreePath, migrationFile);

      try {
        const content = fs.readFileSync(fullPath, 'utf-8');

        // Check for proper up() and down() methods
        const hasUp = /async\s+up\s*\(/.test(content) || /up\s*\(\s*queryRunner/.test(content);
        const hasDown = /async\s+down\s*\(/.test(content) || /down\s*\(\s*queryRunner/.test(content);

        if (!hasUp) {
          validationErrors.push(
            `${migrationFile}: Missing up() method`,
          );
        }
        if (!hasDown) {
          validationErrors.push(
            `${migrationFile}: Missing down() method`,
          );
        }

        // Check that the file has a class that implements MigrationInterface or extends something
        const hasClass = /class\s+\w+/.test(content);
        if (!hasClass) {
          validationErrors.push(
            `${migrationFile}: No class definition found — may not be a valid migration`,
          );
        }

        // Check for TypeORM migration decorators or implements
        const hasTypeOrmImport =
          content.includes('MigrationInterface') ||
          content.includes('typeorm') ||
          content.includes('QueryRunner');
        if (!hasTypeOrmImport) {
          validationErrors.push(
            `${migrationFile}: No TypeORM imports found (MigrationInterface, QueryRunner)`,
          );
        }

        if (hasUp && hasDown && hasClass) {
          results.push(`[${path.basename(migrationFile)}] Valid — has up(), down(), and class definition`);
        }
      } catch (err) {
        validationErrors.push(
          `${migrationFile}: Could not read file — ${(err as Error).message}`,
        );
      }
    }

    // Step 3: Check entity files for proper decorators
    const entityIssues = await this.validateEntities(context.worktreePath);
    if (entityIssues.length > 0) {
      results.push(
        `[Entity Validation]\n${entityIssues.map((i) => `  - ${i}`).join('\n')}`,
      );
    }

    if (validationErrors.length > 0) {
      passed = false;
      results.push(
        `[Validation Errors]\n${validationErrors.map((e) => `  - ${e}`).join('\n')}`,
      );
    }

    return {
      gate: this.name,
      passed,
      output: results.join('\n\n'),
      details: {
        migrationsFound: migrationFiles.length,
        validationErrors: validationErrors.length,
        errors: validationErrors,
      },
      durationMs: Date.now() - start,
      attempt: 1,
    };
  }

  /**
   * Find migration files that have been changed (added/modified) in the worktree
   * compared to the branch base.
   */
  private async findChangedMigrations(context: GateContext): Promise<string[]> {
    try {
      // First try git diff to find changed migration files
      const { stdout } = await execFile(
        'git',
        ['diff', '--name-only', '--diff-filter=ACMR', 'HEAD~1', '--', '**/migrations/*.ts'],
        {
          cwd: context.worktreePath,
          timeout: 30_000,
        },
      );

      const files = stdout
        .trim()
        .split('\n')
        .filter((f) => f.length > 0 && f.includes('migrations/'));

      if (files.length > 0) return files;
    } catch {
      // git diff may fail if there's no previous commit — fall through
    }

    // Fallback: look for unstaged/untracked migration files
    try {
      const { stdout } = await execFile(
        'git',
        ['status', '--porcelain', '--', '**/migrations/*.ts'],
        {
          cwd: context.worktreePath,
          timeout: 30_000,
        },
      );

      return stdout
        .trim()
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => line.slice(3).trim())
        .filter((f) => f.includes('migrations/'));
    } catch {
      return [];
    }
  }

  /**
   * Scan entity files for common issues (missing @Entity decorator, missing @Column, etc.)
   */
  private async validateEntities(worktreePath: string): Promise<string[]> {
    const issues: string[] = [];
    const srcDir = path.join(
      worktreePath,
      'projects',
      'coding-agent',
      'backend',
      'app',
      'src',
    );

    try {
      const entityFiles = await this.findFiles(srcDir, /\.entity\.ts$/);

      for (const filePath of entityFiles) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const relativePath = path.relative(worktreePath, filePath);

          const hasEntityDecorator = /@Entity\(/.test(content);
          if (!hasEntityDecorator) {
            issues.push(
              `${relativePath}: Missing @Entity() decorator`,
            );
          }

          const hasColumns =
            /@Column\(/.test(content) ||
            /@PrimaryGeneratedColumn\(/.test(content) ||
            /@PrimaryColumn\(/.test(content);
          if (!hasColumns) {
            issues.push(
              `${relativePath}: No @Column or @PrimaryGeneratedColumn decorators found`,
            );
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch {
      // Source directory not readable
    }

    return issues;
  }

  private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const results: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          const subResults = await this.findFiles(fullPath, pattern);
          results.push(...subResults);
        } else if (entry.isFile() && pattern.test(entry.name)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Directory not readable
    }

    return results;
  }
}
