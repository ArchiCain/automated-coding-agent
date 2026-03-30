import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './theme-toggle';
import { useTheme } from '../use-theme';

vi.mock('../use-theme');

describe('ThemeToggle', () => {
  it('should render dark mode icon when theme is dark', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: vi.fn(),
      isLoading: false,
      error: null,
    });

    render(<ThemeToggle />);

    expect(screen.getByLabelText('toggle theme')).toBeInTheDocument();
  });

  it('should call toggleTheme when clicked', async () => {
    const mockToggle = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggle,
      isLoading: false,
      error: null,
    });

    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByLabelText('toggle theme'));

    expect(mockToggle).toHaveBeenCalled();
  });

  it('should show loading spinner when loading', () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: 'dark',
      toggleTheme: vi.fn(),
      isLoading: true,
      error: null,
    });

    render(<ThemeToggle />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
