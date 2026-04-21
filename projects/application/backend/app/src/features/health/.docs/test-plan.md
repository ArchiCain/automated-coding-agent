# Health — Test Plan

## Endpoint (`GET /health`)

- [ ] No authentication required (public route)
- [ ] Returns 200 status code
- [ ] Response contains `status: 'ok'`
- [ ] Response contains `service: 'backend'`
- [ ] Response contains `timestamp` in ISO 8601 format
