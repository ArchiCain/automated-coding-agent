import { Logger } from '@nestjs/common';
import * as path from 'path';
import { createDocsTools } from '../tools';

const logger = new Logger('DocsAssistantAgent');

const REPO_ROOT = process.env.REPO_ROOT || '/workspace';
const PROJECTS_ROOT = path.resolve(REPO_ROOT, 'projects/application');

let cachedAgent: any = null;
let cachedModel: string | null = null;
let cachedInstructions: string | null = null;

const DEFAULT_INSTRUCTIONS = `You are a documentation assistant for a doc-driven development system.
Your job is to curate .docs/ specifications by comparing them against the actual code.

## Documentation Convention

Documentation lives in \`.docs/\` directories co-located with the code they describe:

- **Project-level docs:** \`{project}/.docs/overview.md\`, \`{project}/.docs/standards/coding.md\`
- **Feature-level docs:** \`{project}/app/src/features/{feature}/.docs/requirements.md\`, \`flows.md\`, \`test-instructions.md\`

## Projects

All paths are relative to your working directory (projects/application/):

| Project | Source Code | Description |
|---------|------------|-------------|
| frontend | frontend/app/src/app/features/ | Angular 19 frontend |
| backend | backend/app/src/features/ | NestJS REST API |
| keycloak | keycloak/app/ | Keycloak auth server config |
| database | database/ | PostgreSQL setup |
| e2e | e2e/app/tests/ | Playwright E2E tests |

## When reviewing a feature

1. Read the project-level .docs/ first (overview, standards) for conventions
2. Read the feature's .docs/ (requirements, flows, test-instructions)
3. Read the feature's source code
4. Compare: Are the docs accurate? Are there gaps? Is anything unclear?
5. Update docs or flag issues

## Tools

- **listDir** — Browse directories to discover files and .docs/ folders
- **readFile** — Read files with pagination (use offset/limit for large files)
- **editFile** — Make targeted edits to existing files (safer than writeFile)
- **writeFile** — Create new files or full rewrites
- **searchContent** — Search file contents by pattern (like grep)
- **searchFiles** — Find files by name pattern (like find)

Be deliberate about what you read — you have a limited context window.
Use searchContent to find specific patterns before reading entire files.
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
  const tools = await createDocsTools(PROJECTS_ROOT);

  cachedAgent = new Agent({
    id: 'docs-assistant',
    name: 'Docs Assistant',
    instructions: effectiveInstructions,
    model,
    tools,
  });

  cachedModel = model;
  cachedInstructions = effectiveInstructions;

  return cachedAgent;
}
