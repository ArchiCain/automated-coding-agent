import { useEffect, useState, useCallback } from 'react';
import { useThemeContext } from '@/features/mui-theme';
import { ThemeApi } from './theme.api';
import { useAuth } from '@/features/keycloak-auth';

interface UseThemeReturn {
  theme: 'light' | 'dark';
  toggleTheme: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useTheme(): UseThemeReturn {
  const { mode, setMode } = useThemeContext();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setMode('dark');
      return;
    }

    const fetchTheme = async () => {
      try {
        setIsLoading(true);
        const { theme } = await ThemeApi.getTheme();
        setMode(theme);
      } catch (err) {
        console.error('Failed to fetch theme preference:', err);
        setMode('dark');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTheme();
  }, [isAuthenticated, setMode]);

  const toggleTheme = useCallback(async () => {
    if (!isAuthenticated) {
      setMode(mode === 'light' ? 'dark' : 'light');
      return;
    }

    const previousMode = mode;
    const newMode = mode === 'light' ? 'dark' : 'light';

    setMode(newMode);
    setError(null);

    try {
      setIsLoading(true);
      await ThemeApi.updateTheme(newMode);
    } catch (err) {
      console.error('Failed to update theme:', err);
      setMode(previousMode);
      setError('Failed to save theme preference');
    } finally {
      setIsLoading(false);
    }
  }, [mode, setMode, isAuthenticated]);

  return {
    theme: mode,
    toggleTheme,
    isLoading,
    error,
  };
}
