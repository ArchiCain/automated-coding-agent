import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AgentBuilderService } from '../../services/agent-builder.service';
import { AgentConfig } from '../../models/agent-config.model';
import { AgentCardComponent } from '../../components/agent-card/agent-card';
import { AgentTestService } from '../../../chatbot/services/agent-test.service';

@Component({
  selector: 'app-agent-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    AgentCardComponent,
  ],
  templateUrl: './agent-list.html',
  styleUrl: './agent-list.scss',
})
export class AgentListComponent implements OnInit {
  private service = inject(AgentBuilderService);
  private router = inject(Router);
  private agentTestService = inject(AgentTestService);

  agents = signal<AgentConfig[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.loadAgents();
  }

  loadAgents(): void {
    this.loading.set(true);
    this.service.listAgents().subscribe({
      next: (agents) => {
        this.agents.set(agents.filter((a) => !a.hidden));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createAgent(): void {
    this.router.navigate(['/agents', 'new']);
  }

  editAgent(agent: AgentConfig): void {
    this.router.navigate(['/agents', agent.id, 'edit']);
  }

  testAgent(agent: AgentConfig): void {
    this.agentTestService.launchTest({
      scopeKey: `agent-${agent.id}-test`,
      scopeLabel: `${agent.name} (Test)`,
      instructionsFile: `.coding-agent-data/agents/${agent.slug}/instructions.md`,
      knowledgeFiles: agent.knowledgeFiles,
      cwd: agent.cwd,
      provider: agent.provider,
      defaultModel: agent.defaultModel,
      readOnly: true,
    });
  }

  deleteAgent(agent: AgentConfig): void {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;

    this.service.deleteAgent(agent.id).subscribe({
      next: () => this.loadAgents(),
    });
  }
}
