import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TaskRole } from '../config/dev-team-config.interface';

export interface TaskContext {
  description: string;
  taskId?: string;
  branch?: string;
  namespace?: string;
}

@Injectable()
export class SkillLoaderService {
  private readonly logger = new Logger(SkillLoaderService.name);
  private readonly skillsDir = path.join(process.cwd(), 'skills');

  /**
   * Maps each role to the skill directories it should load.
   */
  private readonly roleSkillMap: Record<TaskRole, string[]> = {
    architect: ['decompose'],
    implementer: ['execute', 'database'],
    reviewer: ['execute'],
    tester: ['api-test'],
    designer: ['design-review', 'e2e-test'],
    bugfixer: ['execute', 'infrastructure'],
    documentarian: ['execute'],
    monitor: ['monitor', 'github'],
    devops: ['infrastructure'],
  };

  /**
   * Maps each role to the tools it is allowed to use.
   * This is enforced by the orchestrator when spawning agent sessions.
   */
  private readonly roleToolMap: Record<TaskRole, string[]> = {
    architect: ['Read', 'Grep', 'Glob'],
    implementer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    reviewer: ['Read', 'Write', 'Grep', 'Glob'],
    tester: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    designer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    bugfixer: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    documentarian: ['Read', 'Write', 'Edit', 'Grep', 'Glob'],
    monitor: ['Read', 'Bash', 'Grep'],
    devops: ['Bash', 'Read'],
  };

  /**
   * Load the soul document — core behavioral rules for all agents.
   */
  async loadSoul(): Promise<string> {
    const soulPath = path.join(this.skillsDir, 'soul.md');
    try {
      return await fs.readFile(soulPath, 'utf-8');
    } catch (error) {
      this.logger.error(`Failed to load soul.md from ${soulPath}`, error);
      throw new Error(`Soul document not found at ${soulPath}`);
    }
  }

  /**
   * Load one or more skill documents by name, joined with separators.
   */
  async loadSkills(skillNames: string[]): Promise<string> {
    const sections: string[] = [];

    for (const name of skillNames) {
      const skillPath = path.join(this.skillsDir, name, 'SKILL.md');
      try {
        const content = await fs.readFile(skillPath, 'utf-8');
        sections.push(content);
      } catch (error) {
        this.logger.warn(
          `Skill "${name}" not found at ${skillPath}, skipping`,
        );
      }
    }

    if (sections.length === 0) {
      this.logger.warn(
        `No skills loaded for requested names: ${skillNames.join(', ')}`,
      );
      return '';
    }

    return sections.join('\n\n---\n\n');
  }

  /**
   * Build the full system prompt for an agent session.
   *
   * Structure:
   *   1. Soul (always loaded)
   *   2. Role header with context
   *   3. Task-specific context
   *   4. Skill documents for the role
   */
  async buildSystemPrompt(
    role: TaskRole,
    context: TaskContext,
  ): Promise<string> {
    const soul = await this.loadSoul();
    const skillNames = this.getSkillsForRole(role);
    const skills = await this.loadSkills(skillNames);

    const roleHeader = this.buildRoleHeader(role, context);
    const contextSection = this.buildContextSection(context);

    const parts = [soul, roleHeader, contextSection];

    if (skills.length > 0) {
      parts.push(`# Loaded Skills\n\n${skills}`);
    }

    return parts.join('\n\n---\n\n');
  }

  /**
   * Get the skill names assigned to a role.
   */
  getSkillsForRole(role: TaskRole): string[] {
    return this.roleSkillMap[role] ?? [];
  }

  /**
   * Get the allowed tools for a role.
   */
  getToolsForRole(role: TaskRole): string[] {
    return this.roleToolMap[role] ?? [];
  }

  /**
   * Build the role assignment header.
   */
  private buildRoleHeader(role: TaskRole, context: TaskContext): string {
    const lines = [
      `# Role Assignment`,
      ``,
      `You are assigned the **${role}** role.`,
    ];

    if (context.branch) {
      lines.push(`Your working branch is \`${context.branch}\`.`);
    }

    if (context.namespace) {
      lines.push(
        `Your Kubernetes namespace is \`${context.namespace}\`. All infrastructure commands target this namespace.`,
      );
    }

    const tools = this.getToolsForRole(role);
    lines.push(``);
    lines.push(`Allowed tools: ${tools.map((t) => `\`${t}\``).join(', ')}`);

    return lines.join('\n');
  }

  /**
   * Build the task context section.
   */
  private buildContextSection(context: TaskContext): string {
    const lines = [`# Task Context`, ``];

    if (context.taskId) {
      lines.push(`**Task ID:** ${context.taskId}`);
    }

    lines.push(`**Description:** ${context.description}`);

    return lines.join('\n');
  }
}
