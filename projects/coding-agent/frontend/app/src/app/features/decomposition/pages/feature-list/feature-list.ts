import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { BacklogService } from '../../../backlog/services/backlog.service';
import { FeatureTask, TaskStatus } from '../../../backlog/models/plan.model';
import { DecompositionService } from '../../services/decomposition.service';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-feature-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    SlideOverComponent,
  ],
  templateUrl: './feature-list.html',
  styleUrl: './feature-list.scss',
})
export class FeatureListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
  private decompositionService = inject(DecompositionService);
  private agentService = inject(ClaudeCodeAgentService);

  // Route params
  planId = signal<string>('');
  projectSlug = signal<string>('');

  // Features list
  features = signal<FeatureTask[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Track which feature is being opened (for loading state)
  openingFeatureId = signal<string | null>(null);

  // Slide-over state for viewing task files
  viewingFeature = signal<FeatureTask | null>(null);
  documentContent = signal<string>('');
  documentLoading = signal(false);

  // Reset state
  resettingFeatureId = signal<string | null>(null);

  ngOnInit(): void {
    this.planId.set(this.route.snapshot.paramMap.get('planId') || '');
    this.projectSlug.set(this.route.snapshot.paramMap.get('projectSlug') || '');

    if (!this.planId() || !this.projectSlug()) {
      this.router.navigate(['/brainstorm']);
      return;
    }
    this.loadFeatures();
  }

  loadFeatures(): void {
    this.loading.set(true);
    this.error.set(null);

    this.backlogService.getFeatureTasks(this.planId(), this.projectSlug()).subscribe({
      next: (response) => {
        this.features.set(response.features);
        this.loading.set(false);
      },
      error: (err: Error) => {
        console.error('Failed to load features:', err);
        this.error.set('Failed to load features');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    // Go back to the project listing for this plan
    this.router.navigate(['/decomposition/plan', this.planId(), 'projects']);
  }

  decomposeFeature(feature: FeatureTask): void {
    if (this.openingFeatureId()) return;

    this.openingFeatureId.set(feature.path);

    // Create a task session for feature-to-concerns decomposition
    // The task ID format expected by the backend is: planId:featurePath
    const taskId = `${this.planId()}/${feature.path}`;
    this.decompositionService.createTaskSession(taskId, 'feature-to-concerns').subscribe({
      next: (session) => {
        this.openingFeatureId.set(null);
        this.router.navigate(['/decomposition', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create session:', err);
        this.openingFeatureId.set(null);
        this.error.set('Failed to start decomposition');
      },
    });
  }

  viewTasks(feature: FeatureTask): void {
    // Navigate to the concern listing for this feature
    // Extract the feature name from the path
    const featureName = feature.path.split('/').pop() || feature.name;
    this.router.navigate([
      '/decomposition/plan',
      this.planId(),
      'project',
      this.projectSlug(),
      'feature',
      featureName,
      'concerns',
    ]);
  }

  viewTaskFile(feature: FeatureTask): void {
    this.viewingFeature.set(feature);
    this.documentLoading.set(true);
    this.documentContent.set('');

    // Read the plan.md file for this feature
    const taskPath = `.coding-agent-data/backlog/${this.planId()}/tasks/${feature.path}/plan.md`;
    this.agentService.readDocument(taskPath).subscribe({
      next: (response) => {
        this.documentContent.set(response.content);
        this.documentLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load task file:', err);
        this.documentContent.set('Error loading task file');
        this.documentLoading.set(false);
      },
    });
  }

  closeDocumentView(): void {
    this.viewingFeature.set(null);
    this.documentContent.set('');
  }

  isFeatureReady(feature: FeatureTask): boolean {
    if (feature.hasChildren) {
      return false;
    }
    return feature.status === 'ready';
  }

  toggleFeatureReady(feature: FeatureTask, ready: boolean): void {
    const status: TaskStatus = ready ? 'ready' : 'not_ready';
    this.backlogService.updateTaskStatus(this.planId(), feature.path, status).subscribe({
      next: () => {
        const features = this.features();
        const index = features.findIndex((f) => f.path === feature.path);
        if (index >= 0) {
          features[index] = { ...features[index], status };
          this.features.set([...features]);
        }
      },
      error: (err) => {
        console.error('Failed to update feature ready status:', err);
      },
    });
  }

  resetFeature(feature: FeatureTask): void {
    if (this.resettingFeatureId()) return;

    // Confirm before resetting
    if (!confirm(`Reset "${feature.name}"? This will delete all concerns under this feature.`)) {
      return;
    }

    this.resettingFeatureId.set(feature.path);

    // Extract feature name from the path (last segment)
    const featureName = feature.path.split('/').pop() || feature.name;
    this.backlogService.resetFeatureDecomposition(this.planId(), this.projectSlug(), featureName).subscribe({
      next: () => {
        this.resettingFeatureId.set(null);
        // Reload to get updated state
        this.loadFeatures();
      },
      error: (err) => {
        console.error('Failed to reset feature:', err);
        this.resettingFeatureId.set(null);
        this.error.set('Failed to reset feature');
      },
    });
  }

  trackByPath(_: number, feature: FeatureTask): string {
    return feature.path;
  }
}
