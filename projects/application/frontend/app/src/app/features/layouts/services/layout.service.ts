import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';

const BREAKPOINTS = {
  desktop: '(min-width: 1200px)',
  tablet: '(min-width: 768px) and (max-width: 1199px)',
  mobile: '(max-width: 767px)',
};

@Injectable({ providedIn: 'root' })
export class LayoutService implements OnDestroy {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly subscription: Subscription;

  private readonly _isDesktop = signal(true);
  private readonly _isTablet = signal(false);
  private readonly _isMobile = signal(false);
  private readonly _drawerOpen = signal(false);

  readonly isDesktop = this._isDesktop.asReadonly();
  readonly isTablet = this._isTablet.asReadonly();
  readonly isMobile = this._isMobile.asReadonly();
  readonly drawerOpen = this._drawerOpen.asReadonly();
  readonly showPersistentSidebar = computed(() => this._isDesktop());

  constructor() {
    this.subscription = this.breakpointObserver
      .observe([BREAKPOINTS.desktop, BREAKPOINTS.tablet, BREAKPOINTS.mobile])
      .subscribe(result => {
        this._isDesktop.set(result.breakpoints[BREAKPOINTS.desktop] ?? false);
        this._isTablet.set(result.breakpoints[BREAKPOINTS.tablet] ?? false);
        this._isMobile.set(result.breakpoints[BREAKPOINTS.mobile] ?? false);

        // Close drawer when switching to desktop
        if (this._isDesktop()) {
          this._drawerOpen.set(false);
        }
      });
  }

  toggleDrawer(): void {
    this._drawerOpen.set(!this._drawerOpen());
  }

  closeDrawer(): void {
    this._drawerOpen.set(false);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
