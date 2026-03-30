import { Component, Input, Output, EventEmitter, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AgentBuilderService } from '../../services/agent-builder.service';
import { PromptInfo } from '../../models/agent-config.model';

@Component({
  selector: 'app-prompt-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './prompt-editor.html',
  styleUrl: './prompt-editor.scss',
})
export class PromptEditorComponent implements OnInit {
  private service = inject(AgentBuilderService);

  @Input() selectedFile: string | null = null;
  @Output() selectedFileChange = new EventEmitter<string>();

  prompts = signal<PromptInfo[]>([]);
  loading = signal(false);
  editing = signal(false);
  creating = signal(false);

  editorContent = signal('');
  newFilename = signal('');
  saving = signal(false);

  ngOnInit(): void {
    this.loadPrompts();
  }

  loadPrompts(): void {
    this.loading.set(true);
    this.service.listPrompts().subscribe({
      next: (prompts) => {
        this.prompts.set(prompts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectPrompt(filename: string): void {
    this.selectedFileChange.emit(filename);

    if (this.editing()) {
      this.openEditor(filename);
    }
  }

  openEditor(filename: string): void {
    this.creating.set(false);
    this.editing.set(true);
    this.loading.set(true);
    this.service.readPrompt(filename).subscribe({
      next: (content) => {
        this.editorContent.set(content);
        this.loading.set(false);
      },
      error: () => {
        this.editorContent.set('');
        this.loading.set(false);
      },
    });
  }

  startCreate(): void {
    this.creating.set(true);
    this.editing.set(true);
    this.newFilename.set('');
    this.editorContent.set('# New Prompt\n\nDescribe what this agent should do...\n');
  }

  save(): void {
    this.saving.set(true);

    if (this.creating()) {
      let filename = this.newFilename();
      if (!filename.endsWith('.md')) {
        filename += '.md';
      }

      this.service.createPrompt(filename, this.editorContent()).subscribe({
        next: () => {
          this.saving.set(false);
          this.creating.set(false);
          this.editing.set(false);
          this.selectedFileChange.emit(filename);
          this.loadPrompts();
        },
        error: () => this.saving.set(false),
      });
    } else if (this.selectedFile) {
      this.service.updatePrompt(this.selectedFile, this.editorContent()).subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.loadPrompts();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.creating.set(false);
  }

  onContentChange(value: string): void {
    this.editorContent.set(value);
  }

  onFilenameChange(value: string): void {
    this.newFilename.set(value);
  }
}
