import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTheme } from './use-theme';
import { ThemeApi } from './theme.api';

vi.mock('./theme.api');
vi.mock('@/features/keycloak-auth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));
vi.mock('@/features/mui-theme', () => ({
  useThemeContext: () => ({
    mode: 'dark',
    setMode: vi.fn(),
  }),
}));

describe('useTheme', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch theme on mount', async () => {
    const mockGetTheme = vi.fn().mockResolvedValue({
      theme: 'dark',
      userId: 'test-user',
    });
    vi.mocked(ThemeApi.getTheme).mockImplementation(mockGetTheme);

    const { result } = renderHook(() => useTheme());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetTheme).toHaveBeenCalled();
  });

  it('should toggle theme and persist', async () => {
    const mockUpdateTheme = vi.fn().mockResolvedValue({
      theme: 'light',
      userId: 'test-user',
    });
    vi.mocked(ThemeApi.updateTheme).mockImplementation(mockUpdateTheme);

    const { result } = renderHook(() => useTheme());

    await result.current.toggleTheme();

    await waitFor(() => {
      expect(mockUpdateTheme).toHaveBeenCalledWith('light');
    });
  });
});
