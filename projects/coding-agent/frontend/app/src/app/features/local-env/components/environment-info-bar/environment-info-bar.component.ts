import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Git status information for display
 */
export interface GitStatus {
  branch: string;
  clean: boolean;
  staged: number;
  ahead: number;
  behind: number;
}

/**
 * Reusable environment info bar component.
 * Displays branch and optional worktree information in a styled bar.
 *
 * @example
 * <!-- Basic branch only -->
 * <app-environment-info-bar [branch]="'main'" />
 *
 * @example
 * <!-- With worktree -->
 * <app-environment-info-bar
 *   [branch]="'feature/my-branch'"
 *   [worktreePath]="'.worktrees/my-worktree'"
 * />
 *
 * @example
 * <!-- With git status badges -->
 * <app-environment-info-bar
 *   [branch]="'main'"
 *   [showGitStatus]="true"
 *   [gitStatus]="{ branch: 'main', clean: false, staged: 3, ahead: 1, behind: 0 }"
 * />
 */
@Component({
  selector: 'app-environment-info-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './environment-info-bar.component.html',
  styleUrl: './environment-info-bar.component.scss',
})
export class EnvironmentInfoBarComponent {
  /**
   * Branch name to display
   */
  branch = input.required<string>();

  /**
   * Optional worktree path (only shown if provided)
   */
  worktreePath = input<string>();

  /**
   * Whether to show git status badges (dirty, staged count)
   */
  showGitStatus = input<boolean>(false);

  /**
   * Git status data for badges
   */
  gitStatus = input<GitStatus | null>(null);

  /**
   * Whether this is a worktree environment
   */
  isWorktree = computed(() => !!this.worktreePath());

  /**
   * Whether the branch is dirty (has uncommitted changes)
   */
  isDirty = computed(() => {
    const status = this.gitStatus();
    return status && !status.clean;
  });

  /**
   * Number of staged files
   */
  stagedCount = computed(() => {
    const status = this.gitStatus();
    return status?.staged || 0;
  });
}
