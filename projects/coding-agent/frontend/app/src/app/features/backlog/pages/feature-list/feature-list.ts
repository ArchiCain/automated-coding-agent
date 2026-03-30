import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BacklogService } from '../../services/backlog.service';
import { FeatureTask } from '../../models/plan.model';
import { ClaudeCodeAgentService } from '../../../claude-code-agent/services/claude-code-agent.service';
import { SlideOverComponent } from '../../../ui-components';

@Component({
  selector: 'app-backlog-feature-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SlideOverComponent,
  ],
  templateUrl: './feature-list.html',
  styleUrl: './feature-list.scss',
})
export class BacklogFeatureListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private backlogService = inject(BacklogService);
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

  ngOnInit(): void {
    this.planId.set(this.route.snapshot.paramMap.get('planId') || '');
    this.projectSlug.set(this.route.snapshot.paramMap.get('projectSlug') || '');

    if (!this.planId() || !this.projectSlug()) {
      this.router.navigate(['/backlog']);
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
    this.router.navigate(['/backlog/plan', this.planId(), 'projects']);
  }

  executeFeature(feature: FeatureTask): void {
    if (this.openingFeatureId() || feature.hasChildren) return;

    this.openingFeatureId.set(feature.path);

    // Create an execution session for this feature
    this.backlogService.createExecutionSession(this.planId(), feature.path).subscribe({
      next: (session) => {
        this.openingFeatureId.set(null);
        this.router.navigate(['/backlog', session.meta.sessionId]);
      },
      error: (err: Error) => {
        console.error('Failed to create execution session:', err);
        this.openingFeatureId.set(null);
        this.error.set('Failed to start execution');
      },
    });
  }

  viewTasks(feature: FeatureTask): void {
    // Navigate to the concern listing for this feature
    const featureName = feature.path.split('/').pop() || feature.name;
    this.router.navigate([
      '/backlog/plan',
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

  trackByPath(_: number, feature: FeatureTask): string {
    return feature.path;
  }
}
