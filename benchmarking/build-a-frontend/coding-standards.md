# Benchmark Frontend — Coding Standards

## Project Structure

```
src/
├── app/
│   ├── app.component.ts          # Root component (router-outlet + theme class)
│   ├── app.config.ts             # Application config (providers, interceptors)
│   ├── app.routes.ts             # Route definitions
│   ├── features/
│   │   ├── auth/                 # Login, guards, interceptors, session management
│   │   │   ├── README.md
│   │   │   ├── pages/
│   │   │   │   └── login/
│   │   │   │       ├── login.page.ts
│   │   │   │       ├── login.page.html
│   │   │   │       └── login.page.scss
│   │   │   ├── guards/
│   │   │   │   ├── auth.guard.ts
│   │   │   │   └── permission.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── credentials.interceptor.ts
│   │   │   │   └── auth-error.interceptor.ts
│   │   │   ├── services/
│   │   │   │   └── auth.service.ts
│   │   │   ├── auth.provider.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── home/                 # Welcome page (static/informational)
│   │   │   ├── README.md
│   │   │   ├── pages/
│   │   │   │   └── home/
│   │   │   │       ├── home.page.ts
│   │   │   │       ├── home.page.html
│   │   │   │       └── home.page.scss
│   │   │   ├── components/
│   │   │   │   └── feature-card/
│   │   │   │       ├── feature-card.component.ts
│   │   │   │       ├── feature-card.component.html
│   │   │   │       └── feature-card.component.scss
│   │   │   └── index.ts
│   │   ├── users/                # User management page (admin)
│   │   │   ├── README.md
│   │   │   ├── pages/
│   │   │   │   └── user-management/
│   │   │   │       ├── user-management.page.ts
│   │   │   │       ├── user-management.page.html
│   │   │   │       └── user-management.page.scss
│   │   │   ├── components/
│   │   │   │   ├── user-detail-dialog/
│   │   │   │   │   ├── user-detail-dialog.component.ts
│   │   │   │   │   ├── user-detail-dialog.component.html
│   │   │   │   │   └── user-detail-dialog.component.scss
│   │   │   │   ├── create-user-dialog/
│   │   │   │   │   ├── create-user-dialog.component.ts
│   │   │   │   │   ├── create-user-dialog.component.html
│   │   │   │   │   └── create-user-dialog.component.scss
│   │   │   │   └── confirm-dialog/
│   │   │   │       ├── confirm-dialog.component.ts
│   │   │   │       ├── confirm-dialog.component.html
│   │   │   │       └── confirm-dialog.component.scss
│   │   │   ├── services/
│   │   │   │   └── users.service.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── smoke-tests/          # Health check page
│   │   │   ├── README.md
│   │   │   ├── pages/
│   │   │   │   └── smoke-tests/
│   │   │   │       ├── smoke-tests.page.ts
│   │   │   │       ├── smoke-tests.page.html
│   │   │   │       └── smoke-tests.page.scss
│   │   │   ├── services/
│   │   │   │   └── health.service.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── shared/               # Shared layout, nav, config, theme
│   │       ├── README.md
│   │       ├── components/
│   │       │   └── layout/
│   │       │       ├── layout.component.ts
│   │       │       ├── layout.component.html
│   │       │       └── layout.component.scss
│   │       ├── services/
│   │       │   ├── app-config.service.ts
│   │       │   └── theme.service.ts
│   │       ├── types.ts
│   │       └── index.ts
│   └── environments/             # (unused — runtime config only)
├── styles.scss                   # Global styles + Material theme (both light + dark)
├── index.html
└── main.ts
```

---

## Angular Patterns

### Standalone Components (REQUIRED)

All components, pages, directives, and pipes must be standalone. No NgModules.

```typescript
@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatCardModule, MatFormFieldModule, ...],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage { }
```

### Dependency Injection

Use `inject()` function, not constructor injection.

```typescript
// CORRECT
export class LoginPage {
  private authService = inject(AuthService);
  private router = inject(Router);
}

// WRONG — do not use constructor injection
export class LoginPage {
  constructor(private authService: AuthService) { }
}
```

### State Management

Use signals for synchronous state. RxJS for async (HTTP, WebSocket).

```typescript
export class HomePage {
  private dashboardService = inject(DashboardService);

  // Signal for sync state
  loading = signal(true);
  error = signal<string | null>(null);

  // RxJS for the HTTP call, converted to signal
  summary = toSignal(
    this.dashboardService.getSummary().pipe(
      tap(() => this.loading.set(false)),
      catchError(err => {
        this.error.set(err.message);
        this.loading.set(false);
        return EMPTY;
      }),
    ),
  );
}
```

### Forms

ReactiveFormsModule only. Never use template-driven forms (FormsModule/ngModel).

```typescript
export class LoginPage {
  private fb = inject(FormBuilder);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  onSubmit() {
    if (this.loginForm.valid) {
      // ...
    }
  }
}
```

### Services

```typescript
@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  getUsers(query: UserListQuery): Observable<UserListResponse> {
    const params = new HttpParams()
      .set('page', query.page.toString())
      .set('pageSize', query.pageSize.toString());
    // ... add search, sortBy, sortDirection if present

    return this.http.get<UserListResponse>(`${this.config.apiUrl}/users`, {
      params,
      withCredentials: true,
    });
  }
}
```

**Important:** All HTTP requests must include `withCredentials: true` for cookie-based auth to work cross-origin. Configure this globally in `app.config.ts` via `HttpClient` interceptor or provider.

### Authentication Pattern

Cookie-based auth means the frontend does NOT manage tokens. The pattern is:

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private config = inject(AppConfigService);

  // Current user state — null means not authenticated
  private currentUser = signal<AuthUser | null>(null);
  private currentPermissions = signal<string[]>([]);

  readonly user = this.currentUser.asReadonly();
  readonly permissions = this.currentPermissions.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /** Check a specific permission — use in guards and imperative logic */
  hasPermission(permission: string): boolean {
    return this.currentPermissions().includes(permission);
  }

  /** Reactive permission check — use in templates */
  hasPermission$(permission: string): Signal<boolean> {
    return computed(() => this.currentPermissions().includes(permission));
  }

  /** Call on app bootstrap to restore session from cookies */
  checkSession(): Observable<AuthUser | null> {
    return this.http.get<AuthCheckResponse>(`${this.config.apiUrl}/auth/check`).pipe(
      map(res => {
        this.currentUser.set(res.user);
        this.currentPermissions.set(res.permissions);
        return res.user;
      }),
      catchError(() => {
        this.currentUser.set(null);
        this.currentPermissions.set([]);
        return of(null);
      }),
    );
  }

  login(username: string, password: string): Observable<AuthUser> {
    return this.http.post<LoginResponse>(`${this.config.apiUrl}/auth/login`, { username, password }).pipe(
      // After login, fetch full session including permissions
      switchMap(() => this.checkSession()),
      map(user => user!),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.config.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        this.currentUser.set(null);
        this.currentPermissions.set([]);
      }),
    );
  }

  refreshToken(): Observable<boolean> {
    return this.http.post<void>(`${this.config.apiUrl}/auth/refresh`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
```

Note: `withCredentials: true` is not set per-request — it's handled globally by the `credentialsInterceptor` (see Interceptors below).

### Interceptors

Two interceptors, registered in `provideAuth()`:

**credentialsInterceptor** — adds `withCredentials: true` to every outgoing request:

```typescript
export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
```

**authErrorInterceptor** — handles 401 refresh with retry queue, 403, and 5xx:

```typescript
export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/')) {
        // Queue behind a single refresh to prevent concurrent refresh calls
        return authService.refreshToken().pipe(
          switchMap(success => {
            if (success) {
              return next(req);
            }
            router.navigate(['/login']);
            return throwError(() => error);
          }),
        );
      }
      if (error.status === 403) {
        snackBar.open('Access denied', 'Dismiss', { duration: 5000 });
      }
      if (error.status >= 500) {
        snackBar.open('Something went wrong. Please try again.', 'Dismiss', { duration: 5000 });
      }
      return throwError(() => error);
    }),
  );
};
```

### Auth Provider

Single function to wire all auth infrastructure:

```typescript
// auth.provider.ts
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(
      withInterceptors([credentialsInterceptor, authErrorInterceptor]),
    ),
    {
      provide: APP_INITIALIZER,
      useFactory: (authService: AuthService) => () => firstValueFrom(authService.checkSession()),
      deps: [AuthService],
      multi: true,
    },
  ]);
}
```

Used in `app.config.ts`:

```typescript
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideAuth(),
  ],
};
```

### Guards

**authGuard** — protects the parent route. All child routes inherit it automatically:

```typescript
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
```

**permissionGuard** — factory function for permission-based route protection:

```typescript
export function permissionGuard(permission: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasPermission(permission)) {
      return true;
    }
    // Redirect to /home — user is authenticated but unauthorized
    return router.createUrlTree(['/home']);
  };
}
```
```

### Routing

**Default protected.** The `authGuard` sits on the parent route once. Every child route inherits it. Only the login page lives outside the protected parent — that's how it opts out. Adding a new page means adding a child route; it's automatically protected.

Only `permissionGuard` is added per-route where specific permissions are required. This is a permission escalation, not an auth check.

```typescript
// app.routes.ts
export const routes: Routes = [
  // Public — explicitly outside the protected parent
  { path: 'login', loadComponent: () => import('./features/auth/pages/login/login.page').then(m => m.LoginPage) },

  // Protected — authGuard on parent, all children inherit
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./features/home/pages/home/home.page').then(m => m.HomePage) },
      { path: 'users', loadComponent: () => import('./features/users/pages/user-management/user-management.page').then(m => m.UserManagementPage), canActivate: [permissionGuard('users:read')] },
      { path: 'smoke-tests', loadComponent: () => import('./features/smoke-tests/pages/smoke-tests/smoke-tests.page').then(m => m.SmokeTestsPage) },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
```

### Runtime Configuration

No build-time environment variables. Use runtime `/config.json`:

```typescript
// app-config.service.ts
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private config: AppConfig | null = null;

  get apiUrl(): string {
    return this.config?.apiUrl ?? '/api';
  }

  load(): Observable<AppConfig> {
    return this.http.get<AppConfig>('/config.json').pipe(
      tap(config => this.config = config),
    );
  }
}

// Provide via APP_INITIALIZER in app.config.ts
```

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Page component | `{name}.page.ts` | `login.page.ts` |
| Reusable component | `{name}.component.ts` | `summary-card.component.ts` |
| Service | `{name}.service.ts` | `auth.service.ts` |
| Guard | `{name}.guard.ts` | `auth.guard.ts` |
| Interceptor | `{name}.interceptor.ts` | `error.interceptor.ts` |
| Types | `types.ts` | `types.ts` |
| Barrel export | `index.ts` | `index.ts` |
| Styles | `{name}.{page|component}.scss` | `login.page.scss` |
| Template | `{name}.{page|component}.html` | `login.page.html` |

---

## Documentation

Follow the global documentation standard (`docs/development/documentation-standard.md`). Key points for this project:

### Feature READMEs

Every feature directory (`features/{name}/`) must have a `README.md`. It is a map, not a manual:
- **Integration** — how to wire the feature into an app
- **How it works** — numbered flow showing how pieces connect, referencing specific files
- **Backend contract** — endpoints this feature depends on, with request/response shapes
- **Constraints** — rules that prevent mistakes
- **Portability** — how to extract and reuse in another project

A feature README is part of the feature. When a ticket changes a feature's public API, the README update is part of that ticket.

### Comments

Comments explain **why**, never **what**. If the code needs a "what" comment, the code needs to be clearer.

```typescript
// Good — explains a non-obvious decision
// Redirect to /home not /login — user IS authenticated, just unauthorized
return router.createUrlTree(['/home']);

// Good — documents an integration constraint
// Keycloak uses email as username — login form labels this "Email"
// but the API field is still "username" for compatibility
username: email,

// Bad — restates what the code says
// Check if the user has permission
if (authService.hasPermission('users:read')) { ... }
```

No JSDoc on private methods. No `@author`/`@date`. No commented-out code. No TODOs without a linked issue.

---

## Code Style

- **TypeScript strict mode** — no `any` types
- **OnPush change detection** on all components
- **No `console.log`** in production code
- **No `subscribe()` in components** — use `async` pipe or `toSignal()`
- **No inline styles** — all styling in SCSS files
- **No `!important`** in SCSS unless overriding Material internals (and document why)
- **Single responsibility** — one component/service per file
- **Barrel exports** — each feature has an `index.ts` that exports public API
- **`withCredentials: true`** handled globally by `credentialsInterceptor` — never set per-request

---

## API Response Types

These are the exact shapes the backend returns. Define them in each feature's `types.ts`.

```typescript
// features/auth/types.ts
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
}

export interface AuthCheckResponse {
  authenticated: boolean;
  user: AuthUser;
  permissions: string[];
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
  firstName?: string;
  lastName?: string;
}

// features/users/types.ts
export interface UserDto {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  createdTimestamp?: number;
  roles: string[];
}

export interface UserListResponse {
  users: UserDto[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserListQuery {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: 'username' | 'email' | 'firstName' | 'lastName' | 'createdTimestamp';
  sortDirection?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  temporaryPassword: string;
  role: 'admin' | 'user';
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'user';
}

// features/smoke-tests/types.ts
export interface HealthStatus {
  status: string;
  timestamp: string;
  service: string;
}

// features/shared/types.ts
export interface AppConfig {
  apiUrl: string;
}

export interface ThemeResponse {
  theme: 'light' | 'dark';
  userId: string;
}
```
