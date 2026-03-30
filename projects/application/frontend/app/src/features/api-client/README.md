# api-client

HTTP client for the frontend application with built-in session management, token refresh, and WebSocket support.

## Purpose

The api-client package provides a centralized HTTP client configuration with intelligent token refresh mechanisms and session management. It handles authentication flow, prevents token expiration by proactively refreshing tokens, and manages user activity timeouts to ensure secure sessions.

## Usage

### HTTP Requests

```typescript
import api from '@packages/api-client';

// Simple GET request
const response = await api.get('/health');

// POST request with data
const result = await api.post('/users', { name: 'John' });

// PUT request
await api.put('/users/123', { name: 'Jane' });

// DELETE request
await api.delete('/users/123');
```

### Session Management

```typescript
import {
  startSessionManagement,
  stopSessionManagement,
  updateActivityTime,
  getTimeUntilInactivityExpiry
} from '@packages/api-client';

// Start session management when user logs in
startSessionManagement();

// Update activity on user interactions (keyboard, mouse, etc.)
document.addEventListener('keydown', () => updateActivityTime());
document.addEventListener('mousemove', () => updateActivityTime());

// Get remaining time before session expires
const timeLeft = getTimeUntilInactivityExpiry();
console.log(`Session expires in ${timeLeft}ms`);

// Stop session management when user logs out
stopSessionManagement();
```

### WebSocket Connections

```typescript
import { getSocket } from '@packages/api-client';

// Connect to a WebSocket namespace
const socket = getSocket('/mastra-chat', { userId: '123' });

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('message', (data) => {
  console.log('Received:', data);
});

// Send message
socket.emit('send-message', { text: 'Hello' });

socket.disconnect();
```

## API

| Export | Type | Description |
|--------|------|-------------|
| `api` | AxiosInstance | Default axios instance with interceptors configured |
| `default` | AxiosInstance | Re-export of the main api instance |
| `startSessionManagement` | Function | Start periodic token refresh and inactivity checking |
| `stopSessionManagement` | Function | Clear all session management timers |
| `updateActivityTime` | Function | Update the last activity timestamp (called on user interactions) |
| `getTimeUntilInactivityExpiry` | Function | Get milliseconds remaining before session expires due to inactivity |
| `getSocket` | Function | Create and connect to a WebSocket namespace |

## Features

### Automatic Token Refresh

- Tokens are refreshed proactively every 4 minutes (before the 5-minute expiration)
- Failed requests with 401 status automatically trigger token refresh
- Multiple failed requests queue together to avoid concurrent refresh attempts
- Tokens are refreshed before making API calls when the interval has passed

### Session Management

- **Inactivity timeout**: Sessions expire after 30 minutes of inactivity
- **Activity tracking**: Every API request updates the last activity time
- **Manual tracking**: Use `updateActivityTime()` to track non-API user interactions
- **Automatic redirect**: Inactive users are redirected to `/login` page

### Cookie/Credential Handling

- `withCredentials: true` enables automatic cookie sending with all requests
- Credentials are sent with both HTTP requests and WebSocket connections

### Request/Response Interceptors

- **Request interceptor**: Tracks user activity and checks for token refresh needs
- **Response interceptor**: Handles 401 errors, refreshes tokens, and retries failed requests
- **Queue management**: Failed requests during refresh are queued and retried after successful refresh

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_BACKEND_URL` | Base URL for API requests (e.g., `http://localhost:8085`) | Yes |

### Constants

```typescript
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000;      // 4 minutes
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;         // 30 minutes
```

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Public exports of api instance and session management functions |
| `api-client.ts` | Axios instance configuration with request/response interceptors |
| `websocket-client.ts` | Socket.IO client factory for WebSocket connections |
| `api-client.test.ts` | Unit tests for api client configuration |
| `api-client.integration.test.ts` | Integration tests against real backend |
| `websocket-client.test.ts` | Unit tests for WebSocket client factory |
| `websocket-client.integration.test.ts` | Integration tests for WebSocket connections |

## Dependencies

- **axios** ^1.12.2 - HTTP client for making requests
- **socket.io-client** ^4.8.1 - WebSocket client for real-time communication

## Testing

The package includes both unit and integration tests:

```bash
# Run unit tests
npm run test

# Run integration tests (requires backend at localhost:8085)
npm run test:integration

# Watch mode
npm run test:watch
```

## Integration Points

### Backend Endpoints

The client interacts with these backend endpoints:

- `GET /health` - Health check
- `POST /auth/refresh` - Token refresh (called automatically)
- `POST /auth/login` - User login (activity not tracked)
- `POST /auth/logout` - User logout (activity not tracked)
- `POST /auth/check` - Check auth status (activity not tracked)

### WebSocket Namespaces

- `/mastra-chat` - Chat functionality with optional userId in query parameters
