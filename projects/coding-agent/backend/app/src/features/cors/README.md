# CORS Package

Self-contained NestJS package for configuring and validating Cross-Origin Resource Sharing (CORS) with environment variable support.

## Purpose

This package provides a centralized, reusable solution for managing CORS configuration in the coding-agent-backend application. It validates origin formats at initialization, handles environment-based configuration, and provides runtime utilities for checking if specific origins are allowed.

## Usage

### Import the Module

```typescript
import { CorsModule } from '@packages/cors';

@Module({
  imports: [CorsModule],
})
export class AppModule {}
```

### Use the Service

```typescript
import { CorsService } from '@packages/cors';

@Injectable()
export class MyService {
  constructor(private corsService: CorsService) {}

  checkAccess(origin: string): boolean {
    return this.corsService.isOriginAllowed(origin);
  }

  getAllowedDomains(): string[] | null {
    return this.corsService.getAllowedOrigins();
  }

  getCorsOptions() {
    return this.corsService.getCorsConfig();
  }
}
```

### Configure with Environment Variables

Set the `CODING_AGENT_CORS_ORIGINS` environment variable:

```bash
# Allow all origins
CODING_AGENT_CORS_ORIGINS=*

# Allow specific origins (comma-delimited)
CODING_AGENT_CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://example.com

# Disable CORS
CODING_AGENT_CORS_ORIGINS=false

# Or leave empty for no CORS
CODING_AGENT_CORS_ORIGINS=
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `CorsModule` | Class | Global NestJS module that provides CorsService |
| `CorsService` | Injectable | Service for CORS configuration and validation |
| `createCorsConfig()` | Function | Creates a complete CORS config from origins string |
| `getCorsConfigFromEnv()` | Function | Reads CORS config from CODING_AGENT_CORS_ORIGINS env var |
| `parseCorsOrigins()` | Function | Parses comma-delimited origins with special cases |
| `validateCorsOrigins()` | Function | Validates origin format and returns errors |

## Key Methods

### CorsService

#### `getCorsConfig(): NestJSCorsOptions`
Returns the current CORS configuration object ready for NestJS.

#### `isOriginAllowed(origin: string): boolean`
Checks if a specific origin is allowed by the current configuration.

```typescript
const allowed = corsService.isOriginAllowed('http://localhost:3000');
```

#### `getAllowedOrigins(): string[] | null`
Returns an array of allowed origins, or `null` if all origins are allowed.

#### `refreshConfig(): void`
Reloads CORS configuration from environment variables at runtime.

```typescript
// Update environment variable
process.env.CODING_AGENT_CORS_ORIGINS = 'http://new-domain.com';

// Refresh configuration
corsService.refreshConfig();
```

## Configuration

The package automatically reads and validates the `CODING_AGENT_CORS_ORIGINS` environment variable during service initialization.

### Default Configuration

When origins are provided, the following defaults are applied:

| Setting | Value | Notes |
|---------|-------|-------|
| Methods | GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS | Standard HTTP methods |
| Allowed Headers | Accept, Authorization, Content-Type, X-Requested-With, Range, x-client-id | Common request headers |
| Credentials | true | Allows cookies and auth headers (disabled if origins are empty) |
| Success Status | 200 | Used for legacy browser compatibility |

### Validation Rules

The package validates origins with the following rules:

- **Special cases**: `*` (all origins), `false`, or `none` (disabled)
- **Full URLs**: Must be valid URLs (e.g., `https://example.com`)
- **Localhost**: Pattern `http://localhost:port` or `https://localhost:port`
- **IP addresses**: Pattern `http://ip.ip.ip.ip:port`
- **Comma-delimited**: Multiple origins separated by commas with automatic trimming

### Initialization Validation

The service validates origins during construction and throws an error if the format is invalid:

```typescript
try {
  const corsService = new CorsService();
} catch (error) {
  console.error('Invalid CORS configuration:', error.message);
}
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports for the package |
| `cors.module.ts` | NestJS Global module definition |
| `cors.service.ts` | Core service with configuration and utility methods |
| `cors-config.ts` | Helper functions for parsing and creating CORS config |
| `types.ts` | TypeScript interfaces and type definitions |
| `cors.service.spec.ts` | Unit tests covering service behavior |

## Dependencies

- `@nestjs/common` - NestJS framework for decorators and injectable services
