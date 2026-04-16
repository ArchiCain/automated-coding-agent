# Testing Standards

Testing conventions for the Angular frontend.

## Test runner

**Jest** via `@angular-builders/jest`. Configured in `jest.config.ts` at the project root and wired into `angular.json`'s test architect.

## File conventions

- Test files: `*.spec.ts`, co-located with the source file they test
- One spec file per source file
- Naming: `auth.service.spec.ts` tests `auth.service.ts`

## Coverage targets

**80% minimum** across all metrics: lines, functions, branches, statements. Enforced in `jest.config.ts` via `coverageThreshold`.

## What to test

| Type | What to verify |
|------|---------------|
| **Services** | Business logic, HTTP calls (request URL, method, body, response mapping), error handling, signal state transitions |
| **Components** | Rendering with given inputs, user interactions (clicks, form input), output events, conditional rendering |
| **Guards** | Allow/deny routing based on auth state, permission checks, redirect URLs |
| **Interceptors** | Request modification (headers, credentials), error handling (401 refresh flow), retry logic |
| **Pipes** | Input/output transformation, edge cases (null, undefined, empty) |
| **Directives** | DOM manipulation, conditional rendering |

## What NOT to test

- Angular Material internals (trust the library)
- Simple getter/setter services with no logic
- Template-only components that just compose other components with no logic
- Private methods directly (test via public API)

## Testing patterns

### Component tests with TestBed

```typescript
describe('UsersTableComponent', () => {
  let component: UsersTableComponent;
  let fixture: ComponentFixture<UsersTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersTableComponent],
      providers: [
        { provide: UserManagementApiService, useValue: mockUserApi },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render user rows', () => {
    // ...
  });
});
```

### Service tests

```typescript
describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding requests
  });

  it('should set user on successful login', () => {
    const mockUser: User = { id: '1', username: 'test', roles: ['user'] };

    service.login({ username: 'test', password: 'pass' });

    const req = httpMock.expectOne('/auth/login');
    expect(req.request.method).toBe('POST');
    req.flush(mockUser);

    expect(service.user()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);
  });
});
```

### Mocking patterns

| Need | Approach |
|------|----------|
| HTTP calls | `HttpClientTestingModule` + `HttpTestingController` |
| Services | `jest.fn()` or `jest.spyOn()` on injected service |
| Router | `RouterTestingModule` or mock `Router` |
| Signals | Set signal values directly in test setup |
| Observables | `of()`, `throwError()` for sync test values |
| Time-based (debounce, interval) | `fakeAsync()` + `tick()` |

### Guard tests

```typescript
describe('authGuard', () => {
  it('should redirect to login when not authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isAuthenticated: () => false } },
      ],
    });

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBeInstanceOf(UrlTree);
  });
});
```

## Running tests

```bash
# Unit tests (single run)
task frontend:local:test

# Watch mode
cd projects/application/frontend/app && npx jest --watch

# Coverage report
task frontend:local:test:coverage

# Specific file
cd projects/application/frontend/app && npx jest auth.service
```
