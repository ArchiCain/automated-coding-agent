import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Create and connect to a WebSocket namespace
 * @param namespace - The namespace to connect to (e.g., '/mastra-chat')
 * @param query - Optional query parameters to pass during connection
 * @returns Socket instance that is automatically connected
 */
export const getSocket = (namespace: string, query?: Record<string, string>): Socket => {
  // When BACKEND_URL is a relative path (e.g., "/api"), connect to the current
  // origin with just the namespace. Nginx proxies /socket.io/ to the backend.
  // When it's an absolute URL (e.g., "http://localhost:8085"), connect directly.
  const fullUrl = BACKEND_URL.startsWith('/') ? namespace : `${BACKEND_URL}${namespace}`;

  return io(fullUrl, {
    withCredentials: true,
    query,
    auth: query, // Socket.IO handles this better for namespaces
    // autoConnect: true is the default, socket connects immediately
  });
};
