import {
  IconButton,
  Tooltip,
  CircularProgress,
  Box,
} from '@mui/material';
import {
  LightMode as LightModeIcon,
  DarkMode as DarkModeIcon,
} from '@mui/icons-material';
import { useTheme } from '../use-theme';

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function ThemeToggle({ size = 'medium', className }: ThemeToggleProps) {
  const { theme, toggleTheme, isLoading } = useTheme();

  const handleClick = () => {
    toggleTheme();
  };

  const tooltipTitle = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <Tooltip title={tooltipTitle} arrow>
      <Box className={className} component="span">
        <IconButton
          onClick={handleClick}
          disabled={isLoading}
          size={size}
          color="inherit"
          aria-label="toggle theme"
        >
          {isLoading ? (
            <CircularProgress size={20} color="inherit" />
          ) : theme === 'light' ? (
            <LightModeIcon />
          ) : (
            <DarkModeIcon />
          )}
        </IconButton>
      </Box>
    </Tooltip>
  );
}
