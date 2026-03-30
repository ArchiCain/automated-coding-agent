import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-slide-over',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MarkdownComponent,
  ],
  templateUrl: './slide-over.html',
  styleUrl: './slide-over.scss',
})
export class SlideOverComponent {
  @Input() title = '';
  @Input() content = '';
  @Input() loading = false;
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('slide-over-backdrop')) {
      this.close();
    }
  }
}
