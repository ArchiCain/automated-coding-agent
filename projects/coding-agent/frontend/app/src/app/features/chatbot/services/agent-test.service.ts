import { Injectable, signal, computed } from '@angular/core';
import { ChatbotScopeContext } from '../models/chatbot-scope.model';

/**
 * Manages agent test sessions.
 * When an agent is "tested", its scope is pushed here and the ChatbotWidget
 * renders a second bubble + panel for it alongside the general assistant.
 */
@Injectable({ providedIn: 'root' })
export class AgentTestService {
  private activeTestScope = signal<ChatbotScopeContext | null>(null);

  /** The currently active agent test scope, or null */
  readonly testScope = this.activeTestScope.asReadonly();

  /** Whether an agent test bubble is active */
  readonly isActive = computed(() => this.activeTestScope() !== null);

  /**
   * Launch an agent test bubble.
   * If a test is already active, it replaces the previous one.
   */
  launchTest(scope: ChatbotScopeContext): void {
    this.activeTestScope.set(scope);
  }

  /** Close the agent test bubble */
  dismiss(): void {
    this.activeTestScope.set(null);
  }
}
