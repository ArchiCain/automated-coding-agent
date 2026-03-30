# CORS Package

Environment-driven CORS configuration for NestJS applications with validation and runtime management.

## Purpose

This package provides a self-contained, reusable solution for managing Cross-Origin Resource Sharing (CORS) configuration in NestJS applications. It handles:

- Flexible origin configuration through environment variables
- Automatic validation of CORS origin formats
- Runtime configuration refresh capabilities
- Built-in logging for security auditing
- Support for special cases (allow all origins, disable CORS)

## Usage

### Import the Module

```typescript
import { CorsModule } from '@packages/cors';

@Module({
  imports: [CorsModule],
})
export class AppModule {}
```

### Using the Service

```typescript
import { CorsService } from '@packages/cors';

@Controller()
export class MyController {
  constructor(private readonly corsService: CorsService) {}

  someMethod() {
    // Get full CORS configuration
    const config = this.corsService.getCorsConfig();

    // Check if an origin is allowed
    const allowed = this.corsService.isOriginAllowed('http://localhost:3000');

    // Get list of allowed origins
    const origins = this.corsService.getAllowedOrigins();

    // Refresh from environment variables at runtime
    this.corsService.refreshConfig();
  }
}
```

### Get Config for Express/Fastify

```typescript
import { CorsService } from '@packages/cors';

@Injectable()
export class AppConfig {
  constructor(private readonly corsService: CorsService) {}

  getCorsConfig() {
    return this.corsService.getCorsConfig(); // Returns NestJS CorsOptions
  }
}

// Then use with app.enableCors()
app.enableCors(corsService.getCorsConfig());
```

## Configuration

### Environment Variables

| Variable | Description | Format | Default |
|----------|-------------|--------|---------|
| `CORS_ORIGINS` | Allowed origins for CORS | See below | None (CORS disabled) |

### CORS_ORIGINS Format

The `CORS_ORIGINS` environment variable supports multiple formats:

```bash
# Allow all origins
CORS_ORIGINS=*

# Disable CORS
CORS_ORIGINS=false
CORS_ORIGINS=none

# Single origin
CORS_ORIGINS=http://localhost:3000

# Multiple origins (comma-delimited)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://example.com

# With ports
CORS_ORIGINS=https://app.example.com:3000,https://admin.example.com:3001
```

### Default CORS Options

When configured, the package applies these defaults:

- **Methods**: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
- **Allowed Headers**: Accept, Authorization, Content-Type, X-Requested-With, Range
- **Credentials**: true (allows cookies and authorization headers)
- **Options Success Status**: 200 (for legacy browser compatibility)

## API

### CorsService

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `getCorsConfig()` | None | `NestJSCorsOptions` | Get the current CORS configuration object |
| `isOriginAllowed(origin)` | `string` | `boolean` | Check if a specific origin is allowed |
| `getAllowedOrigins()` | None | `string[] \| null` | Get array of allowed origins (null if all origins allowed) |
| `refreshConfig()` | None | `void` | Reload configuration from environment variables |

### Configuration Functions

| Export | Type | Description |
|--------|------|-------------|
| `createCorsConfig` | `(corsOrigins?: string) => NestJSCorsOptions` | Create CORS config from origins string |
| `getCorsConfigFromEnv` | `() => NestJSCorsOptions` | Load config from CORS_ORIGINS env var |
| `parseCorsOrigins` | `(corsOrigins?: string) => ParsedCorsOrigins` | Parse origins string into structured format |
| `validateCorsOrigins` | `(corsOrigins: string) => ValidationResult` | Validate origins format |

### Types

```typescript
// NestJS CORS configuration options
export type NestJSCorsOptions = CorsOptions;

// Validation result
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Parsed origins
interface ParsedCorsOrigins {
  origins: string[] | string | boolean;
  raw: string;
}
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports for module, service, and utilities |
| `cors.module.ts` | NestJS global module registration |
| `cors.service.ts` | Main service with configuration and origin checking logic |
| `cors-config.ts` | Configuration parsing, creation, and validation utilities |
| `types.ts` | TypeScript interfaces and type definitions |
| `cors.service.spec.ts` | Unit tests for CorsService |

## Examples

### Development Setup

```bash
# Allow local development
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000
```

### Production Setup

```bash
# Restrict to specific production domains
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

### Disable CORS (API-only mode)

```bash
# No CORS_ORIGINS variable set, or explicitly:
CORS_ORIGINS=false
```

### Allow All Origins (NOT recommended for production)

```bash
CORS_ORIGINS=*
```

## Error Handling

The service throws an error on initialization if `CORS_ORIGINS` is invalid:

```typescript
try {
  const service = new CorsService();
} catch (error) {
  // Error logged: Invalid CORS_ORIGINS: [error details]
}
```

Validation errors include:
- Empty origins in comma-delimited list
- Invalid URL formats (must be valid URLs or localhost/IP patterns)

## Testing

```bash
# Run CORS package tests
npm test -- cors.service.spec.ts
```

Tests cover:
- Service initialization with valid/invalid configurations
- Origin allowance checking
- Configuration retrieval
- Runtime configuration refresh

## Logging

The service logs CORS configuration on initialization and refresh:

```
[LOG] CORS Configuration initialized
[LOG] Origins: http://localhost:3000, http://localhost:3001
[LOG] Credentials: true
[LOG] Methods: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
```

Errors are logged with full details for debugging security issues:

```
[ERROR] Invalid CORS_ORIGINS configuration: [error list]
```
