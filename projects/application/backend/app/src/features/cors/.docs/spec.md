# CORS — Spec

## Purpose

Parses the `CORS_ORIGINS` environment variable into a NestJS `CorsOptions` object used by `app.enableCors()` at bootstrap. Also provides a `@Global()` `CorsService` that exposes the parsed config and origin-check helpers to any injectable in the app (currently no consumers — see Discrepancies).

## Behavior

- `getCorsConfigFromEnv()` reads `process.env.CORS_ORIGINS` and returns a `CorsOptions` object passed to `app.enableCors()` at bootstrap (`src/main.ts:12-13`).
- `CorsModule` is declared `@Global()` (`cors/cors.module.ts:4`) and imported in `app.module.ts:16`, so `CorsService` is DI-available app-wide.
- `parseCorsOrigins()` origin parsing rules (`cors/cors-config.ts:7-42`):
  - `undefined`, empty string, or whitespace-only → `origins: false` (CORS off).
  - `*` (case-insensitive, trimmed) → `origins: true` (allow-all).
  - `false` or `none` (case-insensitive, trimmed) → `origins: false`.
  - Otherwise: split on `,`, trim each, drop empties. If the result is non-empty → `origins: string[]`; if empty → `origins: false`.
- `createCorsConfig()` applies fixed defaults (`cors/cors-config.ts:50-62`):
  - `methods`: `GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`
  - `allowedHeaders`: `Accept, Authorization, Content-Type, X-Requested-With, Range`
  - `credentials: true`, forced to `false` when `origins === false` (`cors-config.ts:65-67`).
  - `optionsSuccessStatus: 200`.
- `validateCorsOrigins()` validation rules (`cors/cors-config.ts:83-128`):
  - Empty string is valid (returns `{ valid: true, errors: [] }`).
  - `*`, `false`, `none` (case-insensitive, trimmed) are always valid.
  - Each comma-delimited entry must parse as a `new URL(...)`, OR match `^https?://localhost(:\d+)?$`, OR match `^https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$`. Otherwise an error is collected.
  - Empty entries in the list produce the error `"Empty origin found in comma-delimited list"`.
- `CorsService` constructor runs validation and **throws** `Error("Invalid CORS_ORIGINS: <errors>")` if validation fails (`cors/services/cors.service.ts:22-33`). It then logs `"CORS Configuration initialized"`, origins, credentials, and methods at `log` level (`cors.service.ts:39-44`).
- `CorsService.isOriginAllowed(origin)` returns `true` when `origin === true`, `false` when `origin === false`, and `array.includes(origin)` otherwise (`cors.service.ts:66-73`).
- `CorsService.getAllowedOrigins()` returns `null` for allow-all, `[]` for disabled, or the filtered string array otherwise (`cors.service.ts:78-87`).
- `CorsService.refreshConfig()` re-runs `initializeCorsConfig()` from `process.env` and logs `"CORS configuration refreshed..."` (`cors.service.ts:93-96`).

## Components

| Export | Kind | Source | Role |
|---|---|---|---|
| `CorsModule` | `@Global() @Module` | `cors.module.ts:4-9` | Registers `CorsService` provider/export app-wide. |
| `CorsService` | `@Injectable` | `services/cors.service.ts:10` | Holds parsed `CorsOptions`; exposes accessors and origin checks. |
| `parseCorsOrigins` | function | `cors-config.ts:7` | Env string → `ParsedCorsOrigins` (`origins: string[] \| boolean`, `raw`). |
| `createCorsConfig` | function | `cors-config.ts:47` | Origins string → full `NestJSCorsOptions` with defaults. |
| `getCorsConfigFromEnv` | function | `cors-config.ts:75` | Wrapper used by `main.ts:12` — reads `process.env.CORS_ORIGINS`. |
| `validateCorsOrigins` | function | `cors-config.ts:83` | `{ valid, errors }` check used by `CorsService` ctor. |
| `CorsConfig`, `ParsedCorsOrigins`, `NestJSCorsOptions` | types | `types.ts:4-17` | `NestJSCorsOptions = CorsOptions` from `@nestjs/common`. |

## Environment Variables

| Var | Default | Consumed in |
|---|---|---|
| `CORS_ORIGINS` | unset → CORS disabled | `cors-config.ts:76`, `services/cors.service.ts:19` |

## Acceptance Criteria

- [ ] Unset / empty `CORS_ORIGINS` disables CORS and sets `credentials: false`.
- [ ] `CORS_ORIGINS=*` yields `origin: true` and `credentials: true`.
- [ ] `CORS_ORIGINS=false` or `CORS_ORIGINS=none` disables CORS (case-insensitive).
- [ ] Comma-delimited list produces a trimmed `string[]` origin.
- [ ] Invalid origin formats cause `CorsService` construction to throw.
- [ ] `localhost(:port)` and `<ipv4>(:port)` over http/https validate without relying on `new URL(...)`.
- [ ] Default headers, methods, and `optionsSuccessStatus=200` are applied on every non-disabled config.
- [ ] `CorsModule` is `@Global()` so `CorsService` can be injected without re-importing.
- [ ] `refreshConfig()` re-reads `process.env.CORS_ORIGINS` and replaces the cached config.
