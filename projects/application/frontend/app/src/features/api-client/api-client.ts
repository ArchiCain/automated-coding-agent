import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL,
  withCredentials: true, // Important for sending cookies with requests
});

// Token refresh configuration
const TOKEN_REFRESH_INTERVAL = 4 * 60 * 1000; // Refresh every 4 minutes (token expires in 5)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes inactivity timeout

// Track refresh state
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Track activity and token refresh timing
let lastActivityTime = Date.now();
let lastTokenRefreshTime = Date.now();
let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;
let inactivityCheckTimer: ReturnType<typeof setInterval> | null = null;

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });

  failedQueue = [];
};

/**
 * Refresh the access token proactively
 */
const refreshTokenProactively = async (): Promise<boolean> => {
  if (isRefreshing) {
    return false;
  }

  // Check if user has been inactive for too long
  const timeSinceActivity = Date.now() - lastActivityTime;
  if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
    // User is inactive, don't refresh - let session expire
    stopSessionManagement();
    return false;
  }

  isRefreshing = true;

  try {
    await api.post("/auth/refresh");
    lastTokenRefreshTime = Date.now();
    processQueue();
    return true;
  } catch (error) {
    // Refresh failed - likely session expired
    processQueue(error as Error);
    stopSessionManagement();
    return false;
  } finally {
    isRefreshing = false;
  }
};

/**
 * Start periodic token refresh and inactivity checking
 */
export const startSessionManagement = () => {
  // Clear any existing timers
  stopSessionManagement();

  // Reset activity tracking
  lastActivityTime = Date.now();
  lastTokenRefreshTime = Date.now();

  // Set up periodic token refresh (every 4 minutes)
  tokenRefreshTimer = setInterval(() => {
    const timeSinceRefresh = Date.now() - lastTokenRefreshTime;
    if (timeSinceRefresh >= TOKEN_REFRESH_INTERVAL) {
      refreshTokenProactively();
    }
  }, 60 * 1000); // Check every minute

  // Set up inactivity check
  inactivityCheckTimer = setInterval(() => {
    const timeSinceActivity = Date.now() - lastActivityTime;
    if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
      // User is inactive - redirect to login
      stopSessionManagement();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }, 60 * 1000); // Check every minute
};

/**
 * Stop session management timers
 */
export const stopSessionManagement = () => {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
  if (inactivityCheckTimer) {
    clearInterval(inactivityCheckTimer);
    inactivityCheckTimer = null;
  }
};

/**
 * Update last activity time (called on user interactions)
 */
export const updateActivityTime = () => {
  lastActivityTime = Date.now();
};

/**
 * Get time until session expires due to inactivity
 */
export const getTimeUntilInactivityExpiry = (): number => {
  const timeSinceActivity = Date.now() - lastActivityTime;
  return Math.max(0, INACTIVITY_TIMEOUT - timeSinceActivity);
};

// Request interceptor to track activity and refresh token when needed
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip activity tracking for auth endpoints
    const isAuthEndpoint =
      config.url?.includes("/auth/login") ||
      config.url?.includes("/auth/logout") ||
      config.url?.includes("/auth/refresh") ||
      config.url?.includes("/auth/check");

    if (!isAuthEndpoint) {
      // Update activity time on every API call
      updateActivityTime();

      // Check if we need to refresh the token proactively
      const timeSinceRefresh = Date.now() - lastTokenRefreshTime;
      if (timeSinceRefresh >= TOKEN_REFRESH_INTERVAL && !isRefreshing) {
        // Refresh token before making the request
        await refreshTokenProactively();
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors and refresh tokens
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't retry on auth endpoints themselves
      if (
        originalRequest.url?.includes("/auth/login") ||
        originalRequest.url?.includes("/auth/logout") ||
        originalRequest.url?.includes("/auth/refresh") ||
        originalRequest.url?.includes("/auth/check")
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => {
            // Mark as retried before attempting again
            originalRequest._retry = true;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh the token
        await api.post("/auth/refresh");
        lastTokenRefreshTime = Date.now();

        // Process queued requests
        processQueue();

        // Retry the original request (already marked with _retry = true)
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, reject all queued requests
        processQueue(refreshError as Error);
        stopSessionManagement();

        // Redirect to login page
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
