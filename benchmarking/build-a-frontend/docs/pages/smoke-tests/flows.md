# Smoke Tests Page — Flows

## Flow 1: Initial Load

1. Authenticated user navigates to `/smoke-tests`
2. Page shows "Smoke Tests" heading
3. Loading spinner appears in the health card
4. `GET /api/health` is called
5. Response: `{ status: "ok", timestamp: "2026-04-17T08:00:00.000Z", service: "backend" }`
6. Card displays:
   - Green status dot
   - Service: "backend"
   - Status: "ok"
   - Timestamp: "just now"
7. "Last checked" shows current time
8. Auto-refresh timer starts (30s interval)

## Flow 2: Check Now (Manual Refresh)

1. User clicks "Check Now" button
2. Button becomes disabled, shows loading state
3. `GET /api/health` is called
4. Response received — card updates with new data
5. Button re-enables
6. "Last checked" updates to current time
7. Auto-refresh timer resets

## Flow 3: Auto-Refresh

1. 30 seconds pass since last check
2. `GET /api/health` is called automatically (no loading indicator on auto-refresh)
3. Card updates with new data
4. "Last checked" updates
5. Cycle repeats every 30 seconds

## Flow 4: Backend Down

1. User navigates to `/smoke-tests`
2. `GET /api/health` fails (timeout or 5xx)
3. Card displays:
   - Red status dot
   - Status: "unreachable" or error message
4. "Check Now" button is still available for retry
5. Auto-refresh continues — will update when backend recovers

## Flow 5: Timestamp Display

1. Health check returns with timestamp `2026-04-17T08:00:00.000Z`
2. Display shows relative time: "2 minutes ago"
3. User hovers over the relative time
4. Tooltip shows exact time: "Apr 17, 2026, 8:00:00 AM"
