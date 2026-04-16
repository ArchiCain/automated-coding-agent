# API Integration

How the Angular frontend communicates with backend services.

## Architecture

```
Feature services (typed API methods)
    |
    v
HttpClient (Angular built-in)
    |
    v
Interceptors (auth, activity tracking)
    |
    v
Backend REST API + WebSocket
```

## HTTP client

Angular's built-in `HttpClient` replaces Axios. It's configured in `app.config.ts` with interceptors:

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor, activityInterceptor]),
    ),
  ],
};
```

## Runtime configuration

The backend URL is loaded at runtime from `/config.json` (served by nginx), not baked in at build time. `AppConfigService` holds the loaded config:

```typescript
@Injectable({ providedIn: 'root' })
export class AppConfigService {
  private readonly _config = signal<AppConfig | null>(null);
  readonly config = this._config.asReadonly();

  get backendUrl(): string {
    const config = this._config();
    if (!config) {
      throw new Error('App config not loaded');
    }
    return config.backendUrl;
  }
}
```

Features inject `AppConfigService` to get the base URL for API calls.

## Per-feature API services

Each feature owns its own API calls. The `api-client` feature provides the configured `HttpClient` and interceptors — not the endpoints.

```typescript
// features/user-management/services/user-management.api.ts
@Injectable({ providedIn: 'root' })
export class UserManagementApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(AppConfigService);

  private get baseUrl(): string {
    return `${this.config.backendUrl}/users`;
  }

  getUsers(params?: UserListQuery): Observable<UserListResponse> {
    return this.http.get<UserListResponse>(this.baseUrl, { params: params as any });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  createUser(data: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, data);
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, data);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

This pattern keeps features portable — if a feature moves to another project, its API service comes with it.

## Auth interceptor

The auth interceptor handles:

1. **Credentials**: Sets `withCredentials: true` on every request (cookie-based JWT)
2. **401 handling**: On 401 response, queues the failed request, triggers token refresh, then retries all queued requests
3. **Token refresh queue**: If a refresh is already in progress, new 401s queue instead of triggering multiple refreshes

```typescript
// features/api-client/interceptors/auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const authReq = req.clone({ withCredentials: true });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return auth.refreshAndRetry(authReq, next);
      }
      return throwError(() => error);
    }),
  );
};
```

## Activity interceptor

Tracks user activity for inactivity timeout. Every HTTP request resets the inactivity timer:

```typescript
export const activityInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionManagementService);
  session.recordActivity();
  return next(req);
};
```

## WebSocket (Socket.io)

Real-time communication uses `socket.io-client` wrapped in an Angular service:

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketClientService {
  private readonly config = inject(AppConfigService);
  private socket: Socket | null = null;

  connect(namespace: string): void {
    this.socket = io(`${this.config.backendUrl}/${namespace}`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }

  on<T>(event: string): Observable<T> {
    return new Observable(subscriber => {
      this.socket?.on(event, (data: T) => subscriber.next(data));
      return () => this.socket?.off(event);
    });
  }

  emit(event: string, data: unknown): void {
    this.socket?.emit(event, data);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
```

## Error handling

### In interceptors

The auth interceptor handles 401s. Other HTTP errors propagate to the calling service.

### In API services

Services let errors propagate to components, which handle them in the template or via error signals:

```typescript
// In a component
this.userApi.getUsers().subscribe({
  next: users => this.users.set(users),
  error: err => this.error.set(err.message),
});
```

### Error response shape

The backend returns errors in a consistent shape. Define a shared type:

```typescript
interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}
```

## Key behaviors

- **Cookie-based auth**: Backend manages JWT in HTTP-only cookies. Frontend sends `withCredentials: true`.
- **Proactive token refresh**: Timer runs every 4 minutes. Tokens expire in 5 minutes.
- **Inactivity timeout**: 30 minutes of no HTTP activity triggers logout.
- **Request queuing during refresh**: Concurrent 401s queue until refresh completes, then retry.
