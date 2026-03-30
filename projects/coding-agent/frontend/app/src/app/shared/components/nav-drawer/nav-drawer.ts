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
    { label: 'Dashboard', icon: 'dashboard', route: '/' },
    { label: 'Backlog', icon: 'list_alt', route: '/backlog' },
    { label: 'Projects', icon: 'folder', route: '/projects' },
    { label: 'Playground', icon: 'science', route: '/playground' },
    { label: 'Docs', icon: 'description', route: '/docs' },
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
