import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AgentConfig, AVAILABLE_PROVIDERS } from '../../models/agent-config.model';

@Component({
  selector: 'app-agent-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './agent-card.html',
  styleUrl: './agent-card.scss',
})
export class AgentCardComponent {
  @Input({ required: true }) agent!: AgentConfig;
  @Output() edit = new EventEmitter<void>();
  @Output() test = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();

  get providerLabel(): string {
    return AVAILABLE_PROVIDERS.find((p) => p.id === this.agent.provider)?.name ?? this.agent.provider;
  }

  get iconName(): string {
    return this.agent.icon || 'smart_toy';
  }

  get accentColor(): string {
    return this.agent.color || '#7c4dff';
  }
}
