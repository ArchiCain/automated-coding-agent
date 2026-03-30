import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  BrainstormService,
  BrainstormingSession,
} from '../../services/brainstorm.service';
import {
  DecompositionService,
  PlanInfo,
} from '../../../decomposition/services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';
import { forkJoin } from 'rxjs';

/**
 * Extended plan info that combines session and decomposition data
 */
interface PlanWithSession extends PlanInfo {
  session?: BrainstormingSession;
}

@Component({
  selector: 'app-brainstorm-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './brainstorm-list.html',
  styleUrl: './brainstorm-list.scss',
})
export class BrainstormListComponent implements OnInit {
  private brainstormService = inject(BrainstormService);
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);
  private router = inject(Router);

  // Plans list (combined from sessions and decomposition info)
  plans = signal<PlanWithSession[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  creating = signal(false);

  // Track which plan is being opened (for loading state)
  openingPlanId = signal<string | null>(null);

  // Track which plan is starting auto-decomp
  autoDecompPlanId = signal<string | null>(null);

  // Slide-over state for viewing plan files
  viewingPlan = signal<PlanWithSession | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    // Fetch both sessions and plan info
    forkJoin({
      sessions: this.brainstormService.listSessions(),
      plans: this.decompositionService.listPlans(),
    }).subscribe({
      next: ({ sessions, plans }) => {
        // Filter out ready plans (those appear in Backlog instead)
        const notReadyPlans = plans.filter((p) => p.status !== 'ready');
        // Merge session data with plan info
        const plansWithSessions: PlanWithSession[] = notReadyPlans.map((plan) => {
          const session = sessions.find((s) => s.meta.planId === plan.id);
          return { ...plan, session };
        });
        this.plans.set(plansWithSessions);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load plans:', err);
        this.error.set('Failed to load brainstorming plans');
        this.loading.set(false);
      },
    });
  }

  createSession(): void {
    if (this.creating()) return;

    this.creating.set(true);

    this.brainstormService.createSession().subscribe({
      next: (session) => {
        this.creating.set(false);
        // Navigate to the new session
        this.router.navigate(['/brainstorm', session.meta.planId]);
      },
      error: (err) => {
        console.error('Failed to create session:', err);
        this.creating.set(false);
      },
    });
  }

  openSession(plan: PlanWithSession): void {
    this.router.navigate(['/brainstorm', plan.id]);
  }

  viewPlanFile(plan: PlanWithSession): void {
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

  isPlanReady(plan: PlanWithSession): boolean {
    return plan.status === 'ready';
  }

  togglePlanReady(plan: PlanWithSession, ready: boolean): void {
    this.decompositionService.updatePlanReady(plan.id, ready).subscribe({
      next: () => {
        if (ready) {
          // If marking as ready, remove from Brainstorm list (it goes to Backlog)
          const plans = this.plans();
          const filtered = plans.filter((p) => p.id !== plan.id);
          this.plans.set(filtered);
        } else {
          // If marking as not ready, update local state
          const plans = this.plans();
          const index = plans.findIndex((p) => p.id === plan.id);
          if (index >= 0) {
            plans[index] = { ...plans[index], status: 'draft' };
            this.plans.set([...plans]);
          }
        }
      },
      error: (err) => {
        console.error('Failed to update plan ready status:', err);
      },
    });
  }

  decomposePlan(plan: PlanWithSession): void {
    if (this.openingPlanId()) return;

    this.openingPlanId.set(plan.id);

    // Create a decomposition session and navigate to it
    this.decompositionService.createSession(plan.id, 'plan-to-projects').subscribe({
      next: (session) => {
        this.openingPlanId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err) => {
        console.error('Failed to create decomposition session:', err);
        this.openingPlanId.set(null);
        this.error.set('Failed to start decomposition');
      },
    });
  }

  viewTasks(plan: PlanWithSession): void {
    if (this.openingPlanId()) return;

    this.openingPlanId.set(plan.id);

    // Create a decomposition session and navigate to it (same as decompose, but tasks already exist)
    this.decompositionService.createSession(plan.id, 'plan-to-projects').subscribe({
      next: (session) => {
        this.openingPlanId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err) => {
        console.error('Failed to create session:', err);
        this.openingPlanId.set(null);
        this.error.set('Failed to view tasks');
      },
    });
  }

  trackByPlanId(_: number, plan: PlanWithSession): string {
    return plan.id;
  }

  isPlanLocked(_plan: PlanWithSession): boolean {
    return false;
  }
}
