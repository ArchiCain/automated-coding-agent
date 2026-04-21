# CORS — Test Plan

Unit tests live at `src/features/cors/cors.service.spec.ts`. There are no integration tests that exercise CORS headers on real HTTP responses — add them under `test/` if desired.

## Configuration Parsing (`parseCorsOrigins`)

- [ ] `undefined` → `{ origins: false, raw: "" }` (`cors-config.ts:8-13`)
- [ ] `""` / `"   "` → `{ origins: false, raw: <input> }`
- [ ] `"*"` (any case, with surrounding whitespace) → `{ origins: true, raw: <input> }`
- [ ] `"false"` / `"none"` (any case) → `{ origins: false }`
- [ ] `"http://a.com,http://b.com"` → `{ origins: ["http://a.com", "http://b.com"] }`
- [ ] Entries are trimmed and empty segments are dropped (`" a , , b "` → `["a", "b"]`)
- [ ] Comma-only input (`","`) produces `origins: false` (empty array fallback at `cors-config.ts:39`)

## Validation (`validateCorsOrigins`)

- [ ] Empty input returns `{ valid: true, errors: [] }` (`cors-config.ts:89-91`)
- [ ] `*`, `false`, `none` (any case) return valid
- [ ] Full URLs (`https://app.example.com`) validate via `new URL()`
- [ ] `http://localhost` and `http://localhost:3000` validate via localhost regex
- [ ] `http://127.0.0.1:8080` validates via IPv4 regex
- [ ] `"not-a-url"` produces `errors: ["Invalid origin format: not-a-url"]`
- [ ] Leading/trailing comma (`",http://a.com"`) produces `"Empty origin found in comma-delimited list"`

## Config Assembly (`createCorsConfig`)

- [ ] Non-disabled config includes methods `GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS`
- [ ] Non-disabled config includes headers `Accept, Authorization, Content-Type, X-Requested-With, Range`
- [ ] Non-disabled config has `credentials: true` and `optionsSuccessStatus: 200`
- [ ] Disabled config (`origins === false`) has `credentials: false` (`cors-config.ts:65-67`)
- [ ] Allow-all config (`CORS_ORIGINS=*`) has `origin: true, credentials: true`

## `CorsService`

- [ ] Construction with a valid multi-origin `CORS_ORIGINS` succeeds and logs config (covered: `cors.service.spec.ts:21-30`)
- [ ] Construction with invalid `CORS_ORIGINS` throws `"Invalid CORS_ORIGINS: ..."` (covered: `cors.service.spec.ts:32-39`)
- [ ] `getCorsConfig()` returns the cached `CorsOptions` (covered: `cors.service.spec.ts:47-56`)
- [ ] `isOriginAllowed("http://localhost:3000")` is `true` when that origin is in the list (covered: `cors.service.spec.ts:65-71`)
- [ ] `isOriginAllowed("http://evil.com")` is `false` when not in the list (covered: `cors.service.spec.ts:73-79`)
- [ ] `isOriginAllowed(x)` returns `true` for any `x` when origin is `true` (allow-all) — not currently covered
- [ ] `isOriginAllowed(x)` returns `false` for any `x` when origin is `false` (disabled) — not currently covered
- [ ] `getAllowedOrigins()` returns string array when configured (covered: `cors.service.spec.ts:88-96`)
- [ ] `getAllowedOrigins()` returns `null` for allow-all and `[]` for disabled — not currently covered
- [ ] `refreshConfig()` reloads after env var change (covered: `cors.service.spec.ts:105-117`)

## Module Wiring

- [ ] `CorsModule` is declared `@Global()` (`cors.module.ts:4`) so `CorsService` can be injected anywhere without re-importing
- [ ] `CorsModule` is imported in `AppModule` (`src/app.module.ts:16`)
- [ ] Bootstrap calls `app.enableCors(getCorsConfigFromEnv())` (`src/main.ts:12-13`)

## Bootstrap Behavior (manual / integration)

- [ ] With `CORS_ORIGINS` unset, preflight from any origin receives no `Access-Control-Allow-Origin` header
- [ ] With `CORS_ORIGINS=http://localhost:3000`, preflight from that origin echoes it back with `Access-Control-Allow-Credentials: true`
- [ ] With `CORS_ORIGINS=*`, preflight echoes `Access-Control-Allow-Origin: *` (note: NestJS `origin: true` reflects the request origin with credentials enabled)
