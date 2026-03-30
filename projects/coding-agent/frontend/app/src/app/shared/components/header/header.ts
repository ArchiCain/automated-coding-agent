import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatBadgeModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  @Input() runningCount = 0;
  @Output() menuClick = new EventEmitter<void>();
  @Output() agentsClick = new EventEmitter<void>();

  onMenuClick(): void {
    this.menuClick.emit();
  }

  onAgentsClick(): void {
    this.agentsClick.emit();
  }
}
