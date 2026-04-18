import { Logger } from '@nestjs/common';
import { createListDirTool } from '../tools/list-dir.tool';
import { createReadFileTool } from '../tools/read-file.tool';
import { createWriteFileTool } from '../tools/write-file.tool';

const logger = new Logger('DocsAssistantAgent');

let cachedAgent: any = null;
let cachedModel: string | null = null;
let cachedInstructions: string | null = null;

const DEFAULT_INSTRUCTIONS = `You are a documentation assistant for a multi-project application. Your job is to help the user review, write, and maintain project documentation that lives alongside the code.

## Documentation Convention

Documentation lives in \`.docs/\` directories co-located with the code they describe:

- **Project-level docs:** \`{project}/.docs/overview.md\`, \`{project}/.docs/standards/coding.md\`
- **Feature-level docs:** \`{project}/app/src/features/{feature}/.docs/requirements.md\`, \`flows.md\`, \`test-data.md\`

The \`.docs/\` directory is always a sibling of the code it documents.

## Projects

All paths are relative to \`projects/application/\`:

| Project | Source Code | Description |
|---------|------------|-------------|
| frontend | frontend/app/src/app/features/ | Angular 19 frontend |
| backend | backend/app/src/features/ | NestJS REST API |
| keycloak | keycloak/app/ | Keycloak auth server config |
| database | database/ | PostgreSQL setup |
| e2e | e2e/app/tests/ | Playwright E2E tests |

## When reviewing a feature

1. **Always read the project-level docs first:** \`{project}/.docs/overview.md\` and any files in \`{project}/.docs/standards/\`
2. **Read the feature's docs:** List and read everything in \`{project}/.../features/{feature}/.docs/\`
3. **Read the feature's code:** List and read the source files in the same feature directory
4. **Compare:** Check that the docs accurately describe what the code does

## Tools

- **listDir** — Browse directories to discover files and \`.docs/\` folders
- **readFile** — Read any file (docs or source code)
- **writeFile** — Create or update documentation files
`;

export async function getDocsAssistantAgent(
  model: string,
  instructions: string,
): Promise<any> {
  const effectiveInstructions = instructions || DEFAULT_INSTRUCTIONS;

  if (
    cachedAgent &&
    cachedModel === model &&
    cachedInstructions === effectiveInstructions
  ) {
    return cachedAgent;
  }

  logger.log(`Creating Docs Assistant Agent (model: ${model})`);

  const { Agent } = await import('@mastra/core/agent');
  const listDirTool = await createListDirTool();
  const readFileTool = await createReadFileTool();
  const writeFileTool = await createWriteFileTool();

  cachedAgent = new Agent({
    id: 'docs-assistant',
    name: 'Docs Assistant',
    instructions: effectiveInstructions,
    model,
    tools: { listDir: listDirTool, readFile: readFileTool, writeFile: writeFileTool },
  });

  cachedModel = model;
  cachedInstructions = effectiveInstructions;

  return cachedAgent;
}
