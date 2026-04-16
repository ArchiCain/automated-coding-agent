import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { Permission } from '../permissions/permissions.types';

@Directive({
  selector: '[appRequirePermission]',
})
export class RequirePermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);
  private hasView = false;

  @Input()
  set appRequirePermission(permission: Permission) {
    effect(() => {
      const hasPermission = this.auth.hasPermission(permission);
      if (hasPermission && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!hasPermission && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
