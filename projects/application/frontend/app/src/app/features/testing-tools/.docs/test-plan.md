# Smoke Tests — Test Plan

## Initial Load

- [ ] Page shows "Smoke Tests" heading
- [ ] Health card shows loading state on initial render
- [ ] `GET /api/health` called on page init
- [ ] On success: green dot, service name, status "ok", relative timestamp
- [ ] Auto-refresh timer starts (30s interval)

## Manual Refresh

- [ ] "Check Now" button triggers `GET /api/health`
- [ ] Button shows loading state while request is in flight
- [ ] Button is disabled during request
- [ ] "Last checked" timestamp updates on success
- [ ] Auto-refresh timer resets after manual check

## Auto-Refresh

- [ ] Health check fires automatically every 30 seconds
- [ ] No loading indicator on auto-refresh
- [ ] Card updates with fresh data

## Error State

- [ ] Red status dot when backend is unreachable or returns error
- [ ] "Check Now" button remains available for retry
- [ ] Auto-refresh continues (will update when backend recovers)

## Timestamp Display

- [ ] Relative time shown (e.g. "2 minutes ago")
- [ ] Exact time visible on hover (tooltip)
- [ ] Timestamp in ISO 8601 format from backend
