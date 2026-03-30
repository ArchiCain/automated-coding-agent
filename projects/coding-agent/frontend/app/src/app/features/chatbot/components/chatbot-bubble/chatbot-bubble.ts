import { Component, Input, Output, EventEmitter } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chatbot-bubble',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './chatbot-bubble.html',
  styleUrl: './chatbot-bubble.scss',
})
export class ChatbotBubbleComponent {
  @Output() toggle = new EventEmitter<void>();

  onClick(): void {
    this.toggle.emit();
  }
}
