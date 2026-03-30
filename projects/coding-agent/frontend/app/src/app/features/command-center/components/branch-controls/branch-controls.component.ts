import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, debounceTime, switchMap, takeUntil } from 'rxjs';
import { CommandCenterService, GitStatus } from '../../services/command-center.service';

/**
 * Branch controls component for switching branches.
 */
@Component({
  selector: 'app-branch-controls',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './branch-controls.component.html',
  styleUrl: './branch-controls.component.scss',
})
export class BranchControlsComponent implements OnInit, OnDestroy {
  private commandCenterService = inject(CommandCenterService);
  private destroy$ = new Subject<void>();

  // State
  gitStatus = signal<GitStatus | null>(null);
  loading = signal(false);
  switching = signal(false);
  showBranchPicker = signal(false);

  // Branch picker state
  branchQuery = signal('');
  branches = signal<string[]>([]);
  branchesLoading = signal(false);

  // Search subject for debouncing
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.loadGitStatus();

    // Setup branch search with debounce
    this.searchSubject
      .pipe(
        debounceTime(300),
        switchMap((query) => {
          this.branchesLoading.set(true);
          return this.commandCenterService.listBranches(query);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (branches) => {
          this.branches.set(branches);
          this.branchesLoading.set(false);
        },
        error: () => {
          this.branchesLoading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGitStatus(): void {
    this.loading.set(true);
    this.commandCenterService.getGitStatus().subscribe({
      next: (status) => {
        this.gitStatus.set(status);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  openBranchPicker(): void {
    this.showBranchPicker.set(true);
    this.branchQuery.set('');
    this.searchBranches('');
  }

  closeBranchPicker(): void {
    this.showBranchPicker.set(false);
  }

  searchBranches(query: string): void {
    this.branchQuery.set(query);
    this.searchSubject.next(query);
  }

  async switchToBranch(branch: string): Promise<void> {
    this.switching.set(true);
    this.showBranchPicker.set(false);

    this.commandCenterService.switchBranch(branch).subscribe({
      next: (result) => {
        if (result.success) {
          this.loadGitStatus();
        } else {
          console.error('Failed to switch branch:', result.message);
        }
        this.switching.set(false);
      },
      error: (error) => {
        console.error('Failed to switch branch:', error);
        this.switching.set(false);
      },
    });
  }

  refresh(): void {
    this.loadGitStatus();
  }
}
