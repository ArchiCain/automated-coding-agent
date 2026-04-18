# Coding Standards

## Project Structure

```
src/
├── app/
│   ├── app.component.ts          # Root component (router-outlet + theme class)
│   ├── app.config.ts             # Application config (providers)
│   ├── app.routes.ts             # Route definitions
│   ├── features/
│   │   ├── auth/                 # See docs/shared/auth/
│   │   ├── home/                 # See docs/pages/welcome/
│   │   ├── users/                # See docs/pages/users/
│   │   ├── smoke-tests/          # See docs/pages/smoke-tests/
│   │   └── shared/               # See docs/shared/layout/ and docs/shared/theme/
│   └── environments/             # (unused — runtime config only)
├── styles.scss                   # Global styles + Material theme (both light + dark)
├── index.html
└── main.ts
```

Each feature directory contains a `README.md` (technical integration), pages, components, services, `types.ts`, and `index.ts` barrel export.

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

// WRONG
export class LoginPage {
  constructor(private authService: AuthService) { }
}
```

### State Management

Signals for synchronous state. RxJS for async (HTTP).

```typescript
export class SomePage {
  loading = signal(true);
  error = signal<string | null>(null);

  data = toSignal(
    this.someService.getData().pipe(
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

ReactiveFormsModule only. Never use FormsModule/ngModel.

```typescript
export class LoginPage {
  private fb = inject(FormBuilder);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
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

    return this.http.get<UserListResponse>(`${this.config.apiUrl}/users`, { params });
  }
}
```

Note: `withCredentials: true` is handled globally by `credentialsInterceptor` — never set per-request.

### Routing

**Default protected.** `authGuard` on the parent route. All children inherit. Login lives outside the protected parent.

`permissionGuard(perm)` only where specific permissions are required.

```typescript
export const routes: Routes = [
  { path: 'login', loadComponent: () => import('...').then(m => m.LoginPage) },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => ... },
      { path: 'users', loadComponent: () => ..., canActivate: [permissionGuard('users:read')] },
      { path: 'smoke-tests', loadComponent: () => ... },
      { path: '', redirectTo: 'home', pathMatch: 'full' },
    ],
  },
];
```

### Runtime Configuration

No build-time environment variables. Use runtime `/config.json`:

```typescript
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
```

---

## File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Page component | `{name}.page.ts` | `login.page.ts` |
| Reusable component | `{name}.component.ts` | `feature-card.component.ts` |
| Service | `{name}.service.ts` | `auth.service.ts` |
| Guard | `{name}.guard.ts` | `auth.guard.ts` |
| Interceptor | `{name}.interceptor.ts` | `credentials.interceptor.ts` |
| Types | `types.ts` | `types.ts` |
| Barrel export | `index.ts` | `index.ts` |
| Styles | `{name}.{page|component}.scss` | `login.page.scss` |
| Template | `{name}.{page|component}.html` | `login.page.html` |

---

## Documentation

Follow `docs/development/documentation-standard.md`.

- Every feature directory has a `README.md` — integration, flow, contracts, constraints
- Comments explain **why**, never **what**
- No JSDoc on private methods. No `@author`/`@date`. No commented-out code. No TODOs without linked issues.

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
