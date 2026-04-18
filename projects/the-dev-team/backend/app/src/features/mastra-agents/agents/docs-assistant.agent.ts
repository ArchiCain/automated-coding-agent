import { Logger } from '@nestjs/common';
import { createReadDocTool } from '../tools/read-doc.tool';
import { createWriteDocTool } from '../tools/write-doc.tool';

const logger = new Logger('DocsAssistantAgent');

let cachedAgent: any = null;
let cachedModel: string | null = null;
let cachedInstructions: string | null = null;

/**
 * Get or create the Docs Assistant Mastra Agent.
 *
 * Uses dynamic import() because @mastra/core is ESM-only and NestJS runs CommonJS.
 * Caches the instance and re-creates only when model or instructions change.
 */
export async function getDocsAssistantAgent(model: string, instructions: string): Promise<any> {
  if (cachedAgent && cachedModel === model && cachedInstructions === instructions) {
    return cachedAgent;
  }

  logger.log(`Creating Docs Assistant Agent (model: ${model})`);

  const { Agent } = await import('@mastra/core/agent');
  const readDocTool = await createReadDocTool();
  const writeDocTool = await createWriteDocTool();

  cachedAgent = new Agent({
    id: 'docs-assistant',
    name: 'Docs Assistant',
    instructions,
    model,
    tools: { readDoc: readDocTool, writeDoc: writeDocTool },
  });

  cachedModel = model;
  cachedInstructions = instructions;

  return cachedAgent;
}
