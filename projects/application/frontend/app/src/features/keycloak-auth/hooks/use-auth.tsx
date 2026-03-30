import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import { authApi } from "../services/auth.api";
import { User, LoginCredentials, AuthContextType } from "../types";
import type { Permission } from "../permissions/permissions.types";
import { getPermissionsForRoles } from "../permissions/permissions.config";
import {
  startSessionManagement,
  stopSessionManagement,
  updateActivityTime,
} from "../../api-client/api-client";

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component that wraps the app and makes auth object available
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Compute permissions from user roles
  // Memoized to prevent unnecessary recalculations
  const permissions = useMemo<Permission[]>(() => {
    if (!user || !user.roles) {
      return [];
    }
    return getPermissionsForRoles(user.roles);
  }, [user]);

  // Handle activity events to reset inactivity timer
  const handleUserActivity = useCallback(() => {
    if (isAuthenticated) {
      updateActivityTime();
    }
  }, [isAuthenticated]);

  // Set up activity listeners when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Start session management (token refresh timers)
      startSessionManagement();

      // Add activity listeners
      const events = ["mousedown", "keydown", "touchstart", "scroll"];
      events.forEach((event) => {
        window.addEventListener(event, handleUserActivity, { passive: true });
      });

      return () => {
        // Clean up listeners on unmount or when auth changes
        events.forEach((event) => {
          window.removeEventListener(event, handleUserActivity);
        });
        stopSessionManagement();
      };
    } else {
      // Ensure session management is stopped when not authenticated
      stopSessionManagement();
    }
  }, [isAuthenticated, handleUserActivity]);

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuth().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await authApi.login(credentials);
      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);

    try {
      await authApi.logout();
    } catch (error) {
      console.error("Logout failed", error);
      // Continue to clear state even if backend call fails
    } finally {
      // Always clear local auth state, even if API call failed
      // This ensures user is logged out on frontend regardless of backend status
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  // Check authentication status
  const checkAuth = async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const user = await authApi.checkAuth();

      if (user) {
        setUser(user);
        setIsAuthenticated(true);
        return true;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Create the context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    error,
    permissions,
    login,
    logout,
    checkAuth,
  };

  // Provide the context to children
  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Custom hook for using auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
