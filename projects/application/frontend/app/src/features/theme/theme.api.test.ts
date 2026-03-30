import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeApi } from './theme.api';
import api from '@/features/api-client';

vi.mock('@/features/api-client', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('ThemeApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTheme', () => {
    it('should fetch theme preference', async () => {
      const mockResponse = {
        data: { theme: 'dark' as const, userId: 'test-user' },
      };
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await ThemeApi.getTheme();

      expect(result).toEqual(mockResponse.data);
      expect(api.get).toHaveBeenCalledWith('/theme');
    });
  });

  describe('updateTheme', () => {
    it('should update theme preference', async () => {
      const mockResponse = {
        data: { theme: 'light' as const, userId: 'test-user' },
      };
      vi.mocked(api.put).mockResolvedValue(mockResponse);

      const result = await ThemeApi.updateTheme('light');

      expect(result).toEqual(mockResponse.data);
      expect(api.put).toHaveBeenCalledWith('/theme', { theme: 'light' });
    });
  });
});
