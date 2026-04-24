# Coding Standards

Conventions derived from the actual code under `src/`. Cite `src/app/...` files when adding or changing patterns.

## Project Structure

```
src/
├── main.ts                        # bootstrapApplication(App, appConfig)
├── index.html                     # <title>AI Platform</title>, Roboto + Material Icons
├── styles.scss                    # global theme wiring + Material overrides
└── app/
    ├── app.ts                     # Root standalone component: <router-outlet />
    ├── app.config.ts              # providers (router, http, animations, initializer)
    ├── app.routes.ts              # Routes with loadComponent + authGuard
    └── features/
        ├── api-client/            # AppConfigService, interceptors, session mgmt, WS client
        ├── keycloak-auth/         # AuthService, guards, login page, permissions config
        ├── layouts/               # AppLayoutComponent, LayoutService (breakpoints)
        ├── app-header/            # Sticky toolbar
        ├── navigation/            # NavigationTreeComponent, sidebar/drawer
        ├── navigation-config/     # Static nav items
        ├── theme/                 # ThemeService, _light-theme.scss, _dark-theme.scss
        ├── chat/                  # Socket.IO chat client
        ├── user-management/       # CRUD users
        ├── testing-tools/         # Smoke tests page
        └── shared/                # ConfirmationModalComponent
```

Every feature has a barrel `index.ts` and a `{feature}.module.ts`. The module is a thin NgModule (often empty — see `features/api-client/api-client.module.ts:3`) that re-exports standalone components/directives for optional module-style consumption. All real code is standalone.

Path alias: `@features/*` -> `src/app/features/*` (`tsconfig.json:18`). Cross-feature imports MUST use the alias:

```ts
import { AppConfigService } from '@features/api-client';
```

## Angular Patterns

### Standalone only

No NgModules declare components. Every component, directive, and pipe is standalone with inline `imports: [...]`.

```ts
@Component({
  selector: 'app-users-page',
  imports: [MatButtonModule, MatIconModule, UsersTableComponent],
  templateUrl: './users.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPage { ... }
```

Reference: `features/user-management/pages/users.page.ts:16-55`. `ChangeDetectionStrategy.OnPush` is enforced by ESLint (`eslint.config.js:34`).

### Dependency injection

`inject()` function only — no constructor injection.

```ts
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);
  private readonly router = inject(Router);
}
```

Reference: `features/keycloak-auth/services/auth.service.ts:14-16`. Constructor bodies are reserved for side-effectful subscriptions (`features/layouts/services/layout.service.ts:27`).

### State: signals first, RxJS for async

- Sync state: `signal<T>()` with `computed()` for derivations and `asReadonly()` on public fields.
- Async: RxJS `Observable<T>` from `HttpClient`; components `.subscribe()` imperatively and push into signals.

```ts
private readonly _user = signal<User | null>(null);
readonly user = this._user.asReadonly();
readonly isAuthenticated = computed(() => this._user() !== null);
```

Reference: `features/keycloak-auth/services/auth.service.ts:18-29`.

`input.required<T>()` / `output<T>()` for component I/O (`features/navigation/components/navigation-tree/navigation-tree.component.ts:66`, `features/app-header/components/app-header/app-header.component.ts:45`).

### HTTP

- Base URL: `${inject(AppConfigService).backendUrl}` — NEVER hardcode `/api`.
- `withCredentials: true` is set per call today in services (e.g. `features/user-management/services/user-management.api.ts:26`) AND added again by `authInterceptor` (`features/api-client/interceptors/auth.interceptor.ts:15`). The interceptor is the authoritative source; per-call flags are redundant.
- Services are `@Injectable({ providedIn: 'root' })` singletons.
- Construct `HttpParams` immutably (reassign on each `.set`), as in `user-management.api.ts:19-25`.

### Interceptors

Registered once in `app.config.ts:15`:

- `authInterceptor` (`features/api-client/interceptors/auth.interceptor.ts`) — adds `withCredentials: true`; on 401 (non-`/auth/*` URLs) triggers a single `POST /auth/refresh` via `SessionManagementService`, queues concurrent requests on a `BehaviorSubject`, then retries.
- `activityInterceptor` (`features/api-client/interceptors/activity.interceptor.ts`) — calls `SessionManagementService.recordActivity()` on every request to reset the 30-minute inactivity timer.

### Routing

All routes use lazy `loadComponent`. The protected tree lives under an empty-path parent with `canActivate: [authGuard]`; `/login` is the only public route (`app.routes.ts`).

```ts
{
  path: '',
  loadComponent: () => import('./features/layouts/...').then(m => m.AppLayoutComponent),
  canActivate: [authGuard],
  children: [ ... ],
}
```

`authGuard` reads `AuthService.isAuthenticated()`; if false it calls `checkAuth()` so a valid cookie can revive the session (`features/keycloak-auth/guards/auth.guard.ts:7-24`).

`permissionGuard(permission)` is a factory returning a `CanActivateFn` that redirects to `/` if missing (`features/keycloak-auth/guards/permission.guard.ts:7-18`). It is currently imported nowhere — wire it onto routes that need permission checks.

### Permissions

Strictly typed union `Permission` (`features/keycloak-auth/permissions/permissions.types.ts:1-9`) and a static role->permissions map `ROLE_PERMISSIONS` (`permissions/permissions.config.ts:3-15`). `AuthService.permissions` is a `computed` of the user's resolved perms. Use `AuthService.hasPermission(p)`, `permissionGuard(p)` on routes, or `*appRequirePermission="'users:read'"` in templates (`features/keycloak-auth/directives/require-permission.directive.ts`).

### Runtime configuration

No build-time env vars. `AppConfigService.load()` is awaited by `provideAppInitializer` before the app renders (`features/api-client/services/app-config.service.ts:24-44`). Accessing `backendUrl` before load throws.

`public/config.json` ships with `{ "backendUrl": "/api" }`; the real value is written by the deployment image at container start.

### Realtime (Socket.IO)

- Connect with `io('${backendUrl}/<namespace>', { transports: ['websocket', 'polling'], withCredentials: true })` (`features/chat/services/chat.service.ts:28-31`).
- Lifecycle: connect in `ngOnInit`, disconnect in `ngOnDestroy` on the owning page (`features/chat/pages/chat.page.ts:54-61`). Services with long-lived sockets implement `OnDestroy`.
- A generic `WebSocketClientService` exposes `on<T>(event)` as an `Observable<T>` and `emit(event, data)` for ad-hoc use.

### Forms

Reactive forms only (`FormBuilder`, `formControlName`). No `FormsModule` / `ngModel`. See `features/keycloak-auth/components/login-form/login-form.component.ts` and `features/user-management/components/user-form/user-form.component.ts`.

### Templates

Use Angular control flow (`@if`, `@for`, `@else`) — never `*ngIf` / `*ngFor`. References: `app-layout.component.html:5-18`, `navigation-tree.component.ts:14-44`, `login.page.ts:19`. `@for` must have `track`.

## File naming

| Type | Pattern | Example |
|---|---|---|
| Page component | `{name}.page.ts` | `login.page.ts`, `users.page.ts` |
| UI component | `{name}.component.ts` | `app-header.component.ts` |
| Service | `{name}.service.ts` or `{name}.api.ts` for HTTP clients | `auth.service.ts`, `user-management.api.ts` |
| Guard | `{name}.guard.ts` | `auth.guard.ts` |
| Interceptor | `{name}.interceptor.ts` | `auth.interceptor.ts` |
| Directive | `{name}.directive.ts` | `require-permission.directive.ts` |
| Module barrel | `{feature}.module.ts` + `index.ts` | `keycloak-auth.module.ts` |
| Types | `types.ts` per feature | `features/chat/types.ts` |
| SCSS partial | `_{name}.scss` | `_dark-theme.scss` |

Selectors are kebab-case with the `app-` prefix (`eslint.config.js:26-33`). Directive attributes are camelCase with `app` prefix.

## Code style

- TypeScript `strict: true`, `noPropertyAccessFromIndexSignature`, `strictTemplates` (`tsconfig.json:5-26`). `@typescript-eslint/no-explicit-any: error` — do not reach for `any`.
- `@angular-eslint/prefer-on-push-component-change-detection: error` — every component must declare `OnPush`.
- Prefer `readonly` on injected services and signal fields.
- Private backing signals prefixed `_`, exposed via `.asReadonly()` (see `AuthService`, `LayoutService`, `ThemeService`).
- Inline templates allowed for small components; co-located `.html` / `.scss` for anything non-trivial (e.g. `AppLayoutComponent`).
- Unused args prefixed with `_` (`eslint.config.js:37`). `no-console: warn`.
- Prettier: `printWidth: 100`, `singleQuote: true` (`.prettierrc`).
- One component/service per file.
