import { Injectable, Logger } from '@nestjs/common';
import { ProviderRegistryService } from '../../providers/provider-registry.service';
import { TaskTree } from './task-tree.interface';

/**
 * Uses the architect role to decompose a high-level feature plan
 * into a structured task tree that can be executed concurrently.
 */
@Injectable()
export class DecompositionService {
  private readonly logger = new Logger(DecompositionService.name);

  constructor(private readonly registry: ProviderRegistryService) {}

  async decompose(plan: string): Promise<TaskTree> {
    const architect = this.registry.getForRole('architect');

    const systemPrompt = [
      'You are a software architect.',
      'Your job is to decompose a feature plan into an implementation task tree.',
      'Analyze the codebase using the available tools before producing the tree.',
    ].join(' ');

    let output = '';
    for await (const message of architect.execute({
      prompt: this.buildDecompositionPrompt(plan),
      cwd: process.cwd(),
      systemPrompt,
      allowedTools: ['Read', 'Grep', 'Glob'],
    })) {
      if (message.type === 'text') {
        output += message.content;
      }
    }

    const tree = this.parseTaskTree(output);
    this.logger.log(
      `Decomposed plan into tree "${tree.title}" with root node "${tree.rootNode.id}"`,
    );
    return tree;
  }

  private buildDecompositionPrompt(plan: string): string {
    return `Analyze the codebase and decompose the following feature into an implementation plan:

${plan}

Output a task tree in JSON format with this structure:
{
  "id": "unique-id",
  "title": "Feature title",
  "description": "Feature description",
  "source": "original plan reference",
  "rootNode": {
    "id": "root",
    "type": "feature",
    "title": "Feature title",
    "description": "...",
    "children": [...],
    "dependencies": [],
    "status": "pending",
    "estimatedFiles": []
  }
}

Rules:
- Each leaf task must be atomic (one agent can complete it independently)
- Specify dependencies between tasks (by task ID)
- Estimate which files each task will create or modify
- Group tasks by project area (backend, frontend, e2e, etc.)
- Order tasks so dependencies are respected

Output ONLY the JSON task tree wrapped in \`\`\`json code blocks.`;
  }

  private parseTaskTree(output: string): TaskTree {
    const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]) as TaskTree;
    }

    // Fallback: try to parse the entire output as JSON
    try {
      return JSON.parse(output) as TaskTree;
    } catch {
      throw new Error('Architect did not produce a valid task tree');
    }
  }
}
