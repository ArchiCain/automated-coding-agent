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
} from '../../../decomposition/services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-backlog-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './backlog-list.html',
  styleUrl: './backlog-list.scss',
})
export class BacklogListComponent implements OnInit {
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);
  private router = inject(Router);

  // Plans list (only ready plans)
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
        // Filter to only show ready plans that have been decomposed
        const readyPlans = plans.filter(
          (p) => p.status === 'ready' && p.hasBeenDecomposed
        );
        this.plans.set(readyPlans);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load plans:', err);
        this.error.set('Failed to load backlog plans');
        this.loading.set(false);
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

  togglePlanReady(plan: PlanInfo, ready: boolean): void {
    this.decompositionService.updatePlanReady(plan.id, ready).subscribe({
      next: () => {
        if (!ready) {
          // If marking as not ready, remove from the backlog list
          const plans = this.plans();
          const filtered = plans.filter((p) => p.id !== plan.id);
          this.plans.set(filtered);
        }
      },
      error: (err) => {
        console.error('Failed to update plan ready status:', err);
      },
    });
  }

  viewTasks(plan: PlanInfo): void {
    if (this.openingPlanId()) return;
    this.openingPlanId.set(plan.id);
    // Navigate to the dev environment setup for this plan
    this.router.navigate(['/backlog/plan', plan.id, 'environment']);
    this.openingPlanId.set(null);
  }

  trackByPlanId(_: number, plan: PlanInfo): string {
    return plan.id;
  }
}
