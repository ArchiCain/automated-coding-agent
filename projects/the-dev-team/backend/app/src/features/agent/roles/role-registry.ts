import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentRole } from './role.interface';
import { DefaultRole } from './default.role';
import { FrontendOwnerRole } from './frontend-owner.role';
import { DesignerRole } from './designer.role';
import { TeamLeadRole } from './team-lead.role';
import { FrontendDeveloperRole } from './frontend-developer.role';
import { DevOpsRole } from './devops.role';
import { CodeReviewerRole } from './code-reviewer.role';

@Injectable()
export class RoleRegistry {
  private readonly logger = new Logger(RoleRegistry.name);
  private readonly roles = new Map<string, AgentRole>();

  constructor() {
    this.register(new DefaultRole());
    this.register(new FrontendOwnerRole());
    this.register(new DesignerRole());
    this.register(new TeamLeadRole());
    this.register(new FrontendDeveloperRole());
    this.register(new DevOpsRole());
    this.register(new CodeReviewerRole());
    this.logger.log(`Registered ${this.roles.size} agent roles: ${[...this.roles.keys()].join(', ')}`);
  }

  private register(role: AgentRole): void {
    this.roles.set(role.name, role);
  }

  getRole(name: string): AgentRole {
    const role = this.roles.get(name);
    if (!role) {
      throw new NotFoundException(`Agent role "${name}" not found. Available: ${[...this.roles.keys()].join(', ')}`);
    }
    return role;
  }

  listRoles(): Array<{ name: string; displayName: string; description: string }> {
    return [...this.roles.values()].map(r => ({
      name: r.name,
      displayName: r.displayName,
      description: r.description,
    }));
  }
}
