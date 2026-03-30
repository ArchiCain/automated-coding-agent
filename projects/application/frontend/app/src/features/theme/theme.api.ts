import api from '@/features/api-client';

export interface ThemePreference {
  theme: 'light' | 'dark';
  userId: string;
}

export interface UpdateThemeRequest {
  theme: 'light' | 'dark';
}

export const ThemeApi = {
  getTheme: async (): Promise<ThemePreference> => {
    const response = await api.get<ThemePreference>('/theme');
    return response.data;
  },

  updateTheme: async (theme: 'light' | 'dark'): Promise<ThemePreference> => {
    const response = await api.put<ThemePreference>('/theme', { theme });
    return response.data;
  },
};
