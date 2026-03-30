import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DocsService } from '../../services/docs.service';
import { DocEntry } from '../../models/doc.model';
import { SlideOverComponent } from '../../../../shared';

@Component({
  selector: 'app-docs-list',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    SlideOverComponent,
  ],
  templateUrl: './docs-list.html',
  styleUrl: './docs-list.scss',
})
export class DocsListComponent implements OnInit {
  private docsService = inject(DocsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  docs = signal<DocEntry[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  currentPath = signal<string>('');

  // Slide-over state
  slideOverOpen = signal(false);
  slideOverTitle = signal('');
  slideOverContent = signal('');
  slideOverLoading = signal(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const path = params['path'] || '';
      this.currentPath.set(path);
      this.loadDocs(path);
    });
  }

  loadDocs(path?: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.docsService.getDocs(path).subscribe({
      next: (response) => {
        this.docs.set(response.entries);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to load documents');
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    const path = this.currentPath();
    if (path) {
      const parentPath = path.split('/').slice(0, -1).join('/');
      if (parentPath) {
        this.router.navigate(['/docs'], { queryParams: { path: parentPath } });
      } else {
        this.router.navigate(['/docs']);
      }
    } else {
      // At docs root, go back to dashboard
      this.router.navigate(['/']);
    }
  }

  openDoc(doc: DocEntry): void {
    if (doc.type === 'folder') {
      this.router.navigate(['/docs'], { queryParams: { path: doc.path } });
    } else {
      this.openSlideOver(doc);
    }
  }

  openSlideOver(doc: DocEntry): void {
    this.slideOverTitle.set(this.getDisplayName(doc.name));
    this.slideOverContent.set('');
    this.slideOverLoading.set(true);
    this.slideOverOpen.set(true);

    this.docsService.getDocContent(doc.path).subscribe({
      next: (response) => {
        this.slideOverContent.set(response.content);
        this.slideOverLoading.set(false);
      },
      error: () => {
        this.slideOverContent.set('Failed to load document');
        this.slideOverLoading.set(false);
      },
    });
  }

  closeSlideOver(): void {
    this.slideOverOpen.set(false);
  }

  getDocIcon(doc: DocEntry): string {
    if (doc.type === 'folder') {
      return 'folder';
    }
    if (doc.name.endsWith('.md')) {
      return 'description';
    }
    return 'insert_drive_file';
  }

  getDisplayName(name: string): string {
    return name.replace(/\.md$/, '').replace(/-/g, ' ');
  }

  getPageTitle(): string {
    const path = this.currentPath();
    if (!path) {
      return 'Docs';
    }
    const parts = path.split('/');
    return this.getDisplayName(parts[parts.length - 1]);
  }
}
