import { Component, Input, Output, EventEmitter, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AgentBuilderService } from '../../services/agent-builder.service';
import { FileEntry } from '../../models/agent-config.model';

@Component({
  selector: 'app-context-file-picker',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule],
  templateUrl: './context-file-picker.html',
  styleUrl: './context-file-picker.scss',
})
export class ContextFilePickerComponent implements OnInit {
  private service = inject(AgentBuilderService);

  @Input() selectedFiles: string[] = [];
  @Output() selectedFilesChange = new EventEmitter<string[]>();

  entries = signal<FileEntry[]>([]);
  currentPath = signal('.');
  loading = signal(false);
  expanded = signal(false);

  ngOnInit(): void {
    this.browse();
  }

  browse(dirPath?: string): void {
    this.loading.set(true);
    this.service.browse(dirPath).subscribe({
      next: (result) => {
        this.entries.set(result.entries);
        this.currentPath.set(result.currentPath);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  navigateUp(): void {
    const current = this.currentPath();
    if (current === '.') return;
    const parent = current.split('/').slice(0, -1).join('/') || '.';
    this.browse(parent === '.' ? undefined : parent);
  }

  onEntryClick(entry: FileEntry): void {
    if (entry.type === 'directory') {
      this.browse(entry.path);
    } else {
      this.toggleFile(entry.path);
    }
  }

  toggleFile(filePath: string): void {
    const current = [...this.selectedFiles];
    const index = current.indexOf(filePath);

    if (index >= 0) {
      current.splice(index, 1);
    } else {
      current.push(filePath);
    }

    this.selectedFilesChange.emit(current);
  }

  removeFile(filePath: string): void {
    this.selectedFilesChange.emit(this.selectedFiles.filter((f) => f !== filePath));
  }

  isSelected(filePath: string): boolean {
    return this.selectedFiles.includes(filePath);
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }
}
