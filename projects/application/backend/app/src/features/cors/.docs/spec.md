# CORS — Spec

## What it is

Startup configuration that decides which browser origins are allowed to call the backend. An operator sets a single environment variable, `CORS_ORIGINS`, and the server either disables CORS, allows every origin, or restricts calls to a specific list. The parsed configuration is also made available to any other part of the app that wants to ask "is this origin allowed?".

## How it behaves

### Parsing the env var

`CORS_ORIGINS` is read once at startup. Unset, empty, or whitespace-only turns CORS off. The literal values `*`, `false`, and `none` are recognized (case-insensitive, whitespace trimmed): `*` allows every origin, while `false` and `none` turn CORS off. Any other value is treated as a comma-delimited list — each entry is trimmed, empty entries are dropped, and if nothing non-empty remains, CORS is off.

### Applying CORS at startup

The parsed configuration is handed to the server at boot so browsers see the right CORS headers. When CORS is enabled, the server always advertises the same set of methods (`GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`), the same set of allowed headers (`Accept, Authorization, Content-Type, X-Requested-With, Range`), credentials turned on, and a `200` response for preflight `OPTIONS` requests. When CORS is disabled, credentials are forced off.

### Validating the env var

Before the configuration is published, each origin in the list is validated. An origin is valid if it parses as a URL, or if it looks like `http(s)://localhost` (with an optional port), or if it looks like `http(s)://<ipv4>` (with an optional port). Empty entries inside the list are flagged as errors. The special values `*`, `false`, `none`, and an empty string are always valid. If validation fails, startup aborts with an error listing the bad entries.

### What downstream code sees

Other parts of the app can ask the CORS service two questions: "is this specific origin allowed?" and "what's the full list of allowed origins?". The allow-all case reports every origin as allowed and returns a null list. The disabled case reports every origin as not allowed and returns an empty list. The list case reports allowed only if the origin is in the configured list.

### Refreshing at runtime

The service can be asked to re-read `CORS_ORIGINS` from the environment and replace its cached configuration, logging that it did so.

### Logging

When the service initializes, it logs that CORS configuration is initialized along with the origins, credentials, and methods it ended up with.

## Acceptance criteria

- Unset or empty `CORS_ORIGINS` disables CORS and forces credentials off.
- `CORS_ORIGINS=*` allows every origin and enables credentials.
- `CORS_ORIGINS=false` or `CORS_ORIGINS=none` disables CORS, case-insensitively.
- A comma-delimited list produces a trimmed list of allowed origins.
- Invalid origin formats cause startup to fail with an error naming the bad entries.
- `http(s)://localhost` with an optional port is accepted without needing to parse as a full URL.
- `http(s)://<ipv4>` with an optional port is accepted without needing to parse as a full URL.
- Empty entries inside a comma-delimited list are reported as errors.
- Whenever CORS is enabled, the configured methods, allowed headers, and `optionsSuccessStatus=200` are applied.
- The CORS service is available for injection anywhere in the app without re-importing its module.
- Refreshing the configuration re-reads `CORS_ORIGINS` from the environment and replaces the cached configuration.
- The origin-allowed check returns true for every origin when CORS is allow-all, false for every origin when CORS is disabled, and membership-based otherwise.
- The allowed-origins accessor returns null for allow-all, empty for disabled, and the configured list otherwise.

## Known gaps

- No other code in the app currently consumes `CorsService`; it is wired globally but has no in-app callers.

## Code map

Paths relative to `projects/application/backend/app/`.

| Concern | File · lines |
|---|---|
| Bootstrap reads env and applies CORS via `app.enableCors()` | `src/main.ts:12-13` |
| `CorsModule` declared `@Global()` | `src/features/cors/cors.module.ts:4` |
| `CorsModule` imported into `AppModule` | `src/app.module.ts:16` |
| `parseCorsOrigins()` — env string → `ParsedCorsOrigins` (`origins: string[] \| boolean`, `raw`) | `src/features/cors/cors-config.ts:7-42` |
| Parsing rule: undefined / empty / whitespace → `origins: false` | `src/features/cors/cors-config.ts:7-42` |
| Parsing rule: `*` (case-insensitive, trimmed) → `origins: true` | `src/features/cors/cors-config.ts:7-42` |
| Parsing rule: `false` / `none` (case-insensitive, trimmed) → `origins: false` | `src/features/cors/cors-config.ts:7-42` |
| Parsing rule: comma-split, trim, drop empties; empty result → `origins: false` | `src/features/cors/cors-config.ts:7-42` |
| `createCorsConfig()` applies fixed defaults | `src/features/cors/cors-config.ts:50-62` |
| Default `methods`: `GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS` | `src/features/cors/cors-config.ts:50-62` |
| Default `allowedHeaders`: `Accept, Authorization, Content-Type, X-Requested-With, Range` | `src/features/cors/cors-config.ts:50-62` |
| `credentials: true`, forced `false` when `origins === false` | `src/features/cors/cors-config.ts:65-67` |
| `optionsSuccessStatus: 200` | `src/features/cors/cors-config.ts:50-62` |
| `getCorsConfigFromEnv()` — reads `process.env.CORS_ORIGINS` | `src/features/cors/cors-config.ts:75-76` |
| `validateCorsOrigins()` — `{ valid, errors }` | `src/features/cors/cors-config.ts:83-128` |
| Validation: empty string returns `{ valid: true, errors: [] }` | `src/features/cors/cors-config.ts:83-128` |
| Validation: `*`, `false`, `none` (case-insensitive, trimmed) always valid | `src/features/cors/cors-config.ts:83-128` |
| Validation: each entry must parse as `new URL(...)`, OR match `^https?://localhost(:\d+)?$`, OR match `^https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$` | `src/features/cors/cors-config.ts:83-128` |
| Validation: empty entries produce `"Empty origin found in comma-delimited list"` | `src/features/cors/cors-config.ts:83-128` |
| `CorsService` `@Injectable`, constructor runs validation | `src/features/cors/services/cors.service.ts:10,22-33` |
| Constructor throws `Error("Invalid CORS_ORIGINS: <errors>")` on validation failure | `src/features/cors/services/cors.service.ts:22-33` |
| Startup log `"CORS Configuration initialized"` with origins, credentials, methods at `log` level | `src/features/cors/services/cors.service.ts:39-44` |
| `CorsService.isOriginAllowed(origin)` — `true` if `origin === true`, `false` if `origin === false`, else `array.includes(origin)` | `src/features/cors/services/cors.service.ts:66-73` |
| `CorsService.getAllowedOrigins()` — `null` for allow-all, `[]` for disabled, filtered string array otherwise | `src/features/cors/services/cors.service.ts:78-87` |
| `CorsService.refreshConfig()` — re-runs `initializeCorsConfig()` from `process.env`; logs `"CORS configuration refreshed..."` | `src/features/cors/services/cors.service.ts:93-96` |
| `CorsService` reads `process.env.CORS_ORIGINS` | `src/features/cors/services/cors.service.ts:19` |
| `CorsModule` registers `CorsService` provider/export | `src/features/cors/cors.module.ts:4-9` |
| Types: `CorsConfig`, `ParsedCorsOrigins`, `NestJSCorsOptions` (= `CorsOptions` from `@nestjs/common`) | `src/features/cors/types.ts:4-17` |

### Environment variables

| Var | Default | Consumed in |
|---|---|---|
| `CORS_ORIGINS` | unset → CORS disabled | `src/features/cors/cors-config.ts:76`, `src/features/cors/services/cors.service.ts:19` |
