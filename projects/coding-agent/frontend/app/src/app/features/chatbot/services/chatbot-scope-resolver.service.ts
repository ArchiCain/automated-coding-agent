import { Injectable, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute } from '@angular/router';
import { filter } from 'rxjs';
import { ChatbotScopeContext } from '../models/chatbot-scope.model';

@Injectable({ providedIn: 'root' })
export class ChatbotScopeResolverService {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  private routeScope = signal<ChatbotScopeContext | null>(null);
  private overrideScopeSignal = signal<ChatbotScopeContext | null>(null);

  readonly currentScope = computed<ChatbotScopeContext | null>(() => {
    return this.overrideScopeSignal() || this.routeScope() || null;
  });

  constructor() {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        // Clear any page-level override on navigation
        this.overrideScopeSignal.set(null);
        // Walk the activated route tree to find chatbotScope data
        const scope = this.findScopeInRoute(this.activatedRoute);
        this.routeScope.set(scope);
      });
  }

  /**
   * Called by pages with dynamic scopes (e.g., project-detail, feature-detail)
   * to set a param-dependent scope after loading data.
   */
  overrideScope(scope: ChatbotScopeContext): void {
    this.overrideScopeSignal.set(scope);
  }

  private findScopeInRoute(route: ActivatedRoute): ChatbotScopeContext | null {
    // Walk from root to deepest child, last one with chatbotScope wins
    let result: ChatbotScopeContext | null = null;
    let current: ActivatedRoute | null = route;

    while (current) {
      const data = current.snapshot?.data;
      if (data && data['chatbotScope']) {
        result = data['chatbotScope'] as ChatbotScopeContext;
      }
      current = current.firstChild;
    }

    return result;
  }
}
