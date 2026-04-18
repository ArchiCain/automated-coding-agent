# CORS — Requirements

## What It Does

Global NestJS module that manages Cross-Origin Resource Sharing configuration from environment variables. Parses the `CORS_ORIGINS` env var, validates origin formats, and provides the resulting config to the rest of the application via an injectable `CorsService`.

## Configuration

| Env Variable | Format | Description |
|-------------|--------|-------------|
| `CORS_ORIGINS` | Comma-delimited string | Allowed origins for cross-origin requests |

### Supported Origin Formats

| Value | Behavior |
|-------|----------|
| `*` | Allow all origins |
| `false` / `none` / empty | Disable CORS (no origins allowed) |
| Comma-delimited URLs | Allow only listed origins (e.g. `http://localhost:3000,https://app.example.com`) |

Origins are validated as URLs, with explicit support for `localhost` and IP address patterns.

## Defaults

- **Methods:** GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
- **Allowed headers:** Accept, Authorization, Content-Type, X-Requested-With, Range
- **Credentials:** Enabled when origins are configured, disabled when CORS is off
- **Options success status:** 200 (for legacy browser compatibility)

## Service API

| Method | Returns | Description |
|--------|---------|-------------|
| `getCorsConfig()` | `NestJSCorsOptions` | Current CORS config object |
| `isOriginAllowed(origin)` | `boolean` | Check if a specific origin is permitted |
| `getAllowedOrigins()` | `string[] \| null` | List of allowed origins, or `null` if all are allowed |
| `refreshConfig()` | `void` | Reload config from environment variables at runtime |

## Acceptance Criteria

- [ ] Reads `CORS_ORIGINS` from environment variables at startup
- [ ] Parses `*` as allow-all, `false`/`none`/empty as disabled
- [ ] Parses comma-delimited origin lists into individual origins
- [ ] Validates each origin format and throws on invalid input
- [ ] Credentials enabled only when origins are configured
- [ ] Module is global — available to all other modules without importing
- [ ] Supports runtime config refresh via `refreshConfig()`
- [ ] Logs CORS configuration on initialization
