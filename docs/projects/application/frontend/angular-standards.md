# Angular Standards

Coding conventions and patterns for the Angular frontend.

## Component conventions

### Standalone by default

Every component, directive, and pipe is `standalone: true`. Dependencies are declared in the component's `imports` array.

```typescript
@Component({
  selector: 'app-users-table',
  standalone: true,
  imports: [MatTableModule, MatSortModule, MatPaginatorModule],
  templateUrl: './users-table.component.html',
  styleUrl: './users-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersTableComponent {
  // ...
}
```

### OnPush change detection

Every component uses `ChangeDetectionStrategy.OnPush`. This is enforced by ESLint. Signals and the `async` pipe work naturally with OnPush.

### Feature modules as public API

Each feature has an NgModule that imports and re-exports its public components. Other features import the module, not individual components.

```typescript
// features/shared/shared.module.ts
@NgModule({
  imports: [ConfirmationModalComponent],
  exports: [ConfirmationModalComponent],
})
export class SharedModule {}

// features/shared/index.ts
export { SharedModule } from './shared.module';
export { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';
```

A feature can import either the module (for template usage) or individual exports (for programmatic usage like services).

### Component structure

Components with templates and styles use separate files:

```
components/login-form/
├── login-form.component.ts       # Component class
├── login-form.component.html     # Template
├── login-form.component.scss     # Styles (component-scoped)
└── login-form.component.spec.ts  # Tests
```

Small components (no template logic, few styles) may use inline template/styles:

```typescript
@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [MatIconButtonModule, MatIconModule],
  template: `
    <button mat-icon-button (click)="toggle()">
      <mat-icon>{{ isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggleComponent { ... }
```

## Dependency injection

### `inject()` function over constructor injection

```typescript
// Correct
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
}

// Incorrect — do not use constructor injection
export class AuthService {
  constructor(private http: HttpClient) {} // NO
}
```

### `providedIn: 'root'` for singleton services

Services that should be app-wide singletons use `providedIn: 'root'`. Feature-scoped services are provided in their feature module.

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService { ... }
```

## State management

### Signals for synchronous state

Use Angular signals for state that doesn't involve async operations:

```typescript
export class AuthService {
  private readonly _user = signal<User | null>(null);
  private readonly _isLoading = signal(false);

  readonly user = this._user.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly permissions = computed(() => this._user()?.permissions ?? []);
}
```

### RxJS for async streams

Use RxJS for HTTP calls, WebSocket streams, timers, and other async operations:

```typescript
export class ChatService {
  private readonly messages$ = new BehaviorSubject<ChatMessage[]>([]);

  sendMessage(content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.baseUrl}/messages`, { content });
  }
}
```

### Decision tree

| Scenario | Use |
|----------|-----|
| Component local state | Signals |
| Service singleton state (auth, theme) | Signals |
| HTTP request/response | RxJS Observable (HttpClient returns Observable) |
| WebSocket stream | RxJS Observable |
| Timer-based operations (token refresh) | RxJS (interval, timer) |
| Computed/derived values | `computed()` signal |
| Template binding | Signals preferred, `async` pipe for Observables |

## Routing

### Lazy loading

Feature routes are lazy-loaded. Route-level components (pages) use `loadComponent`:

```typescript
// app.routes.ts
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/keycloak-auth').then(m => m.LoginPage),
  },
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'admin/users',
        loadChildren: () =>
          import('./features/user-management').then(m => m.userManagementRoutes),
      },
    ],
  },
];
```

### Functional guards

Route guards are functions, not classes:

```typescript
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
```

## Forms

### Reactive forms only

All forms use `ReactiveFormsModule`. Template-driven forms (`FormsModule`, `ngModel`) are not used.

```typescript
export class UserFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
  });
}
```

## SCSS conventions

### Component-scoped styles

Each component has its own `.scss` file. Styles are scoped to the component by default (Angular view encapsulation).

### Avoid `::ng-deep`

`::ng-deep` is deprecated. For Angular Material customizations, use the theming system (SCSS mixins) or the component's public CSS custom properties.

### Use Angular Material theming

Global customizations go in `src/styles/themes/`. Component-specific overrides use Angular Material's SCSS API:

```scss
@use '@angular/material' as mat;

// In a component's SCSS — reference theme tokens
:host {
  color: mat.get-theme-color($theme, primary);
}
```

## Import ordering

Organize imports in this order, separated by blank lines:

1. Angular core (`@angular/core`, `@angular/common`, etc.)
2. Angular Material (`@angular/material/*`)
3. Third-party libraries (`rxjs`, `socket.io-client`, etc.)
4. Project imports (`@features/*`)
5. Relative imports (`./`, `../`)

```typescript
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';

import { Observable } from 'rxjs';

import { AuthService } from '@features/keycloak-auth';

import { UserFormComponent } from './components/user-form/user-form.component';
```

## Feature module pattern

Every feature follows this structure:

```
features/feature-name/
├── feature-name.module.ts      # NgModule: imports standalone components, exports public API
├── pages/                      # Route-level standalone components (*.page.ts)
├── components/                 # Reusable standalone components (*.component.ts)
├── services/                   # Injectable services (*.service.ts)
├── guards/                     # Functional route guards (*.guard.ts)
├── interceptors/               # HTTP interceptors (*.interceptor.ts)
├── directives/                 # Structural/attribute directives (*.directive.ts)
├── pipes/                      # Pipes (*.pipe.ts)
├── types.ts                    # Interfaces and type definitions
└── index.ts                    # Barrel exports
```

### Rules

- All code lives inside `features/`. No code outside this directory (except `app.component.ts`, `app.config.ts`, `app.routes.ts`, `main.ts`).
- Features do not reach into other features' internal files. Import only from `index.ts` or the module.
- Shared features do not depend on full-stack features.
- Keep features focused on a single domain concept.
