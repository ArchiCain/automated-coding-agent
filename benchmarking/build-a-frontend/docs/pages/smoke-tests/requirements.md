# Smoke Tests Page

**Route:** `/smoke-tests`
**Auth:** Authenticated (inherited from parent route)
**Feature directory:** `src/app/features/smoke-tests/`

## Purpose

A diagnostic page that displays the backend health status. Simple and minimal — shows whether the backend is reachable and healthy, with manual and auto-refresh capabilities.

## Acceptance Criteria

- [ ] Health result displayed in a `mat-card`
- [ ] Shows: service name, status, and timestamp
- [ ] Status indicator: green dot for "ok", red dot for anything else
- [ ] Timestamp displayed as relative time (e.g. "2 minutes ago") with exact time on hover
- [ ] "Check Now" button triggers a fresh `GET /api/health`
- [ ] "Check Now" shows loading state while request is in flight
- [ ] Auto-refresh every 30 seconds
- [ ] Last-checked timestamp visible
- [ ] Clean, professional diagnostic layout
- [ ] Responsive
