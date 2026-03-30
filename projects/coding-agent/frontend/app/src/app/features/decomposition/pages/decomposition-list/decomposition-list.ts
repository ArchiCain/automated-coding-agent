import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  DecompositionService,
  PlanInfo,
} from '../../services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-decomposition-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './decomposition-list.html',
  styleUrl: './decomposition-list.scss',
})
export class DecompositionListComponent implements OnInit {
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);
  private router = inject(Router);

  // Plans list
  plans = signal<PlanInfo[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Track which plan is being opened (for loading state)
  openingPlanId = signal<string | null>(null);

  // Slide-over state for viewing plan files
  viewingPlan = signal<PlanInfo | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    this.decompositionService.listPlans().subscribe({
      next: (plans) => {
        this.plans.set(plans);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load plans:', err);
        this.error.set('Failed to load plans');
        this.loading.set(false);
      },
    });
  }

  openPlan(plan: PlanInfo): void {
    if (this.openingPlanId()) return; // Already opening a plan

    this.openingPlanId.set(plan.id);

    // Always create a new session (sessions are ephemeral)
    this.decompositionService.createSession(plan.id, 'plan-to-projects').subscribe({
      next: (session) => {
        this.openingPlanId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create session:', err);
        this.openingPlanId.set(null);
        this.error.set('Failed to start decomposition');
      },
    });
  }

  viewPlanFile(plan: PlanInfo): void {
    this.viewingPlan.set(plan);
    this.documentLoading.set(true);
    this.documentContent.set('');

    this.agentService.readDocument(plan.path).subscribe({
      next: (response) => {
        this.documentContent.set(response.content);
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load plan file:', err);
        this.documentContent.set('Error loading plan file');
        this.documentLoading.set(false);
      },
    });
  }

  closeDocumentView(): void {
    this.viewingPlan.set(null);
    this.documentContent.set('');
  }

  isPlanReady(plan: PlanInfo): boolean {
    // If plan has been decomposed, it's not ready - work is done by tasks
    if (plan.hasBeenDecomposed) {
      return false;
    }
    return plan.status === 'ready';
  }

  togglePlanReady(plan: PlanInfo, ready: boolean): void {
    this.decompositionService.updatePlanReady(plan.id, ready).subscribe({
      next: () => {
        // Update local state
        const plans = this.plans();
        const index = plans.findIndex(p => p.id === plan.id);
        if (index >= 0) {
          plans[index] = { ...plans[index], status: ready ? 'ready' : 'draft' };
          this.plans.set([...plans]);
        }
      },
      error: (err) => {
        console.error('Failed to update plan ready status:', err);
      },
    });
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'ready':
        return 'status-ready';
      case 'decomposing':
        return 'status-decomposing';
      case 'in-progress':
        return 'status-in-progress';
      case 'completed':
        return 'status-completed';
      default:
        return 'status-draft';
    }
  }

  trackByPlanId(_: number, plan: PlanInfo): string {
    return plan.id;
  }
}
