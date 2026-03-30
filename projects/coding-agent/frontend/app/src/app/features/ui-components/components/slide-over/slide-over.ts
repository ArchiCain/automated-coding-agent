import { Component, Input, Output, EventEmitter, computed, signal, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MarkdownComponent } from 'ngx-markdown';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';

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
export class SlideOverComponent implements OnChanges {
  @Input() title = '';
  @Input() content = '';
  @Input() loading = false;
  @Input() isOpen = false;
  /** When true, render content in a dark <pre> block instead of markdown */
  @Input() raw = false;
  /** When set, render content as syntax-highlighted code using PrismJS */
  @Input() codeLanguage = '';
  /** Panel position: 'bottom' (default full-width drawer) or 'right' (side panel) */
  @Input() position: 'right' | 'bottom' = 'bottom';
  @Output() closed = new EventEmitter<void>();

  colorizedHtml: SafeHtml = '';
  highlightedCodeHtml: SafeHtml = '';

  constructor(private sanitizer: DomSanitizer) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['content'] || changes['raw']) && this.raw && this.content) {
      this.colorizedHtml = this.sanitizer.bypassSecurityTrustHtml(
        this.colorizeLog(this.content),
      );
    }

    if ((changes['content'] || changes['codeLanguage']) && this.codeLanguage && this.content) {
      this.highlightedCodeHtml = this.sanitizer.bypassSecurityTrustHtml(
        this.highlightCode(this.content, this.codeLanguage),
      );
    }
  }

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('slide-over-backdrop')) {
      this.close();
    }
  }

  private highlightCode(code: string, language: string): string {
    const grammar = Prism.languages[language];
    if (!grammar) {
      // Fallback: escape HTML and return plain text with line numbers
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return this.addLineNumbers(escaped);
    }
    const highlighted = Prism.highlight(code, grammar, language);
    return this.addLineNumbers(highlighted);
  }

  private addLineNumbers(html: string): string {
    const lines = html.split('\n');
    const gutterWidth = String(lines.length).length;
    return lines
      .map((line, i) => {
        const num = String(i + 1).padStart(gutterWidth, ' ');
        return `<span class="line-number">${num}</span>${line}`;
      })
      .join('\n');
  }

  /**
   * Colorize docker compose log output.
   */
  private colorizeLog(text: string): string {
    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return text
      .split('\n')
      .map((line) => {
        const escaped = esc(line);

        // Docker compose prefix: "servicename  |"
        const prefixMatch = escaped.match(
          /^(\S+\s+\|)(.*)/,
        );
        if (!prefixMatch) {
          return this.colorizePlainLine(escaped);
        }

        const servicePrefix = `<span class="log-service">${prefixMatch[1]}</span>`;
        const rest = prefixMatch[2];

        return servicePrefix + this.colorizePlainLine(rest);
      })
      .join('\n');
  }

  private colorizePlainLine(line: string): string {
    let result = line
      .replace(
        /(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}(\.\d+)?(\+\d{2}:\d{2}|Z)?)/g,
        '<span class="log-timestamp">$1</span>',
      )
      .replace(
        /(\d{1,2}\/\d{1,2}\/\d{4},?\s+\d{1,2}:\d{2}:\d{2}\s*[AP]M)/gi,
        '<span class="log-timestamp">$1</span>',
      )
      .replace(
        /\b(ERROR|FATAL|CRIT(?:ICAL)?)\b/g,
        '<span class="log-error">$1</span>',
      )
      .replace(
        /\b(WARN(?:ING)?)\b/g,
        '<span class="log-warn">$1</span>',
      )
      .replace(
        /\bLOG\b/g,
        '<span class="log-info">LOG</span>',
      )
      .replace(
        /\b(INFO)\b/g,
        '<span class="log-info">$1</span>',
      )
      .replace(
        /\b(DEBUG|VERBOSE)\b/g,
        '<span class="log-debug">$1</span>',
      )
      .replace(
        /\[([A-Za-z][\w.:]*)\]/g,
        '<span class="log-context">[$1]</span>',
      )
      .replace(
        /(https?:\/\/[^\s<]+)/g,
        '<span class="log-url">$1</span>',
      )
      .replace(
        /(\+\d+m?s)\b/g,
        '<span class="log-timing">$1</span>',
      );

    return result;
  }
}
