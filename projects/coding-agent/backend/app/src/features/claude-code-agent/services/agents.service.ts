import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, CreateAgentConfigDto, UpdateAgentConfigDto } from '../models/agent-config.model';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly agentsDir: string;

  constructor() {
    const repoRoot = process.env.REPO_ROOT || path.resolve(__dirname, '../../../../../../../../');
    this.agentsDir = path.join(repoRoot, '.coding-agent-data', 'agents');
  }

  getAgentsDir(): string {
    return this.agentsDir;
  }

  async listAgents(): Promise<AgentConfig[]> {
    await this.ensureDir();

    try {
      const entries = await fs.readdir(this.agentsDir, { withFileTypes: true });
      const agents: AgentConfig[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const configPath = path.join(this.agentsDir, entry.name, 'config.json');
            const content = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            agents.push(this.migrateConfig(config));
          } catch {
            // Skip directories without valid config.json
          }
        }
      }

      return agents.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      this.logger.error(`Failed to list agents: ${err}`);
      return [];
    }
  }

  async getAgent(id: string): Promise<AgentConfig> {
    const agents = await this.listAgents();
    const agent = agents.find((a) => a.id === id || a.slug === id);
    if (!agent) throw new NotFoundException(`Agent not found: ${id}`);
    return agent;
  }

  async createAgent(dto: CreateAgentConfigDto): Promise<AgentConfig> {
    await this.ensureDir();

    const slug = this.slugify(dto.name);
    if (!slug) throw new BadRequestException('Agent name is required');

    const agentDir = path.join(this.agentsDir, slug);
    try {
      await fs.access(agentDir);
      throw new ConflictException(`An agent named "${dto.name}" already exists`);
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      // Directory doesn't exist, good
    }

    const now = new Date().toISOString();
    const config: AgentConfig = {
      id: uuidv4(),
      slug,
      ...dto,
      pages: dto.pages || [],
      createdAt: now,
      updatedAt: now,
    };

    await fs.mkdir(agentDir, { recursive: true });
    await fs.mkdir(path.join(agentDir, 'sessions'), { recursive: true });
    await fs.writeFile(path.join(agentDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

    // Auto-create default instructions.md
    const instructionsPath = path.join(agentDir, 'instructions.md');
    const defaultInstructions = `# ${config.name}\n\n${config.description || 'Agent instructions go here.'}\n`;
    await fs.writeFile(instructionsPath, defaultInstructions, 'utf-8');

    this.logger.log(`Created agent: ${config.name} (${slug})`);
    return config;
  }

  async updateAgent(id: string, dto: UpdateAgentConfigDto): Promise<AgentConfig> {
    const existing = await this.getAgent(id);
    const oldSlug = existing.slug;

    const updated: AgentConfig = {
      ...existing,
      ...dto,
      id: existing.id,
      slug: existing.slug,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    // If name changed, rename the directory
    if (dto.name && dto.name !== existing.name) {
      const newSlug = this.slugify(dto.name);
      if (newSlug !== oldSlug) {
        const newDir = path.join(this.agentsDir, newSlug);
        try {
          await fs.access(newDir);
          throw new ConflictException(`An agent named "${dto.name}" already exists`);
        } catch (err) {
          if (err instanceof ConflictException) throw err;
        }
        await fs.rename(path.join(this.agentsDir, oldSlug), newDir);
        updated.slug = newSlug;
      }
    }

    const configPath = path.join(this.agentsDir, updated.slug, 'config.json');
    await fs.writeFile(configPath, JSON.stringify(updated, null, 2), 'utf-8');
    this.logger.log(`Updated agent: ${updated.name} (${updated.slug})`);

    return updated;
  }

  async deleteAgent(id: string): Promise<void> {
    const agent = await this.getAgent(id);
    const agentDir = path.join(this.agentsDir, agent.slug);

    await fs.rm(agentDir, { recursive: true, force: true });
    this.logger.log(`Deleted agent: ${agent.name} (${agent.slug})`);
  }

  /**
   * Save a session transcript line to the agent's sessions directory
   */
  async appendSessionLine(slug: string, sessionId: string, line: string): Promise<void> {
    const sessionDir = path.join(this.agentsDir, slug, 'sessions', sessionId);
    await fs.mkdir(sessionDir, { recursive: true });
    const transcriptPath = path.join(sessionDir, 'transcript.jsonl');
    await fs.appendFile(transcriptPath, line + '\n', 'utf-8');
  }

  /**
   * Read a session transcript from disk
   */
  async readSessionTranscript(slug: string, sessionId: string): Promise<string[]> {
    const transcriptPath = path.join(this.agentsDir, slug, 'sessions', sessionId, 'transcript.jsonl');
    try {
      const content = await fs.readFile(transcriptPath, 'utf-8');
      return content.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * List sessions for an agent
   */
  async listSessions(slug: string): Promise<string[]> {
    const sessionsDir = path.join(this.agentsDir, slug, 'sessions');
    try {
      const entries = await fs.readdir(sessionsDir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  /**
   * Read instructions.md for an agent
   */
  async readInstructions(slug: string): Promise<string> {
    const instructionsPath = path.join(this.agentsDir, slug, 'instructions.md');
    try {
      return await fs.readFile(instructionsPath, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Write instructions.md for an agent
   */
  async writeInstructions(slug: string, content: string): Promise<void> {
    const agentDir = path.join(this.agentsDir, slug);
    await fs.mkdir(agentDir, { recursive: true });
    const instructionsPath = path.join(agentDir, 'instructions.md');
    await fs.writeFile(instructionsPath, content, 'utf-8');
    this.logger.log(`Updated instructions for agent: ${slug}`);
  }

  /**
   * Migrate old config format: contextFiles→knowledgeFiles, remove promptFile
   */
  private migrateConfig(config: any): AgentConfig {
    if (config.contextFiles && !config.knowledgeFiles) {
      config.knowledgeFiles = config.contextFiles;
      delete config.contextFiles;
    }
    if (!config.knowledgeFiles) {
      config.knowledgeFiles = [];
    }
    delete config.promptFile;
    return config as AgentConfig;
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.agentsDir, { recursive: true });
  }
}
