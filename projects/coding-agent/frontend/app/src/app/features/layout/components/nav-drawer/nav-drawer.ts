import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-nav-drawer',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './nav-drawer.html',
  styleUrl: './nav-drawer.scss',
})
export class NavDrawerComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  navItems: NavItem[] = [
    { label: 'Projects', icon: 'folder_open', route: '/projects' },
    { label: 'Brainstorm', icon: 'lightbulb', route: '/brainstorm' },
    { label: 'Backlog', icon: 'assignment', route: '/backlog' },
    { label: 'Command Center', icon: 'terminal', route: '/command-center' },
    { label: 'Agent Builder', icon: 'smart_toy', route: '/agents' },
  ];

  close(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.close();
  }

  onNavClick(): void {
    this.close();
  }
}
