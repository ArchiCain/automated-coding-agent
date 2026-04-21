# CORS — Test Plan

## Configuration Parsing

- [ ] Parses `*` as allow-all origins
- [ ] Parses `false` as disabled (no origins allowed)
- [ ] Parses `none` as disabled
- [ ] Parses empty string as disabled
- [ ] Parses comma-delimited URLs into individual origins
- [ ] Validates each origin format (throws on invalid)
- [ ] Supports localhost URLs
- [ ] Supports IP address patterns

## CORS Behavior

- [ ] Credentials enabled when origins are configured
- [ ] Credentials disabled when CORS is off
- [ ] Allowed methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
- [ ] Allowed headers: Accept, Authorization, Content-Type, X-Requested-With, Range
- [ ] Options success status is 200

## Service API

- [ ] `getCorsConfig()` returns full NestJS CORS options object
- [ ] `isOriginAllowed(origin)` returns true for allowed origins
- [ ] `isOriginAllowed(origin)` returns false for disallowed origins
- [ ] `getAllowedOrigins()` returns string array or null (all allowed)
- [ ] `refreshConfig()` reloads from environment variables

## Module

- [ ] Module is global (available without explicit import)
- [ ] Reads CORS_ORIGINS from environment at startup
- [ ] Logs configuration on initialization
