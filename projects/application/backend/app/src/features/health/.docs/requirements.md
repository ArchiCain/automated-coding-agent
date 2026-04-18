# Health — Requirements

## What It Does

Simple health check endpoint for monitoring and readiness probes.

## Endpoint

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/health` | Public | Returns service status |

## Response

```typescript
{ status: 'ok', timestamp: string, service: 'backend' }
```

## Acceptance Criteria

- [ ] No authentication required
- [ ] Returns 200 with status object
- [ ] Timestamp is ISO 8601 format
