import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { Permission } from '../permissions/permissions.types';

export function permissionGuard(requiredPermission: Permission): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.hasPermission(requiredPermission)) {
      return true;
    }

    return router.createUrlTree(['/']);
  };
}
