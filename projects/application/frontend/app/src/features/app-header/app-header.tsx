import { useNavigate } from "react-router-dom";
import { AppBar, Toolbar, IconButton, Typography, Box, Avatar, Tooltip, alpha, Chip } from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogOutIcon from "@mui/icons-material/Logout";
import { ThemeToggle } from "@/features/theme";
import { useAuth } from "@/features/keycloak-auth";
import { useLayoutContext } from "@/features/layouts";
import type { AppHeaderProps } from "./types";

/**
 * AppHeader
 *
 * Application header with responsive menu button, branding, and user controls.
 * Enhanced with MUI X design aesthetic - refined and professional.
 */
export function AppHeader({ title = "Conversational AI" }: AppHeaderProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { toggleLeftDrawer } = useLayoutContext();

  // Always show menu button on all viewports for consistent navigation access
  const showMenuButton = true;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  // Get user initials for avatar
  const getUserInitials = (username: string) => {
    return username
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || username.slice(0, 2).toUpperCase();
  };

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backdropFilter: 'blur(20px)',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? alpha('#1A1A1A', 0.8)
            : alpha('#ffffff', 0.8),
        borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        transition: 'all 0.3s ease-in-out',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 64, sm: 70 }, px: { xs: 2, sm: 3 } }}>
        {/* Menu button - Always visible on all viewports */}
        {showMenuButton && (
          <IconButton
            edge="start"
            color="inherit"
            onClick={toggleLeftDrawer}
            aria-label="Toggle navigation menu"
            sx={{
              mr: 2,
              borderRadius: '10px',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.08),
                transform: 'scale(1.05)',
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        )}

        {/* Branding */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            ml: showMenuButton ? 0 : 2,
          }}
        >
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #404040 0%, #2A2A2A 100%)'
                : 'linear-gradient(135deg, #6B6B6B 0%, #4A4A4A 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: (theme) => theme.palette.mode === 'dark'
                ? '0 4px 14px rgba(0, 0, 0, 0.4)'
                : '0 4px 14px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                transform: 'rotate(-5deg) scale(1.05)',
                boxShadow: (theme) => theme.palette.mode === 'dark'
                  ? '0 6px 20px rgba(0, 0, 0, 0.5)'
                  : '0 6px 20px rgba(0, 0, 0, 0.3)',
              },
            }}
          >
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{ color: 'white', fontSize: '1.25rem' }}
            >
              AI
            </Typography>
          </Box>
          <Typography
            variant="h6"
            component="h1"
            fontWeight={700}
            sx={{
              display: { xs: 'none', sm: 'block' },
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #E7EBF0 0%, #B2BAC2 100%)'
                : 'linear-gradient(135deg, #1A2027 0%, #3E5060 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {title}
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* User Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1.5 } }}>
          {user && (
            <Chip
              avatar={
                <Avatar
                  sx={{
                    bgcolor: (theme) => theme.palette.mode === 'dark' ? '#404040' : '#6B6B6B',
                    width: 28,
                    height: 28,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {getUserInitials(user.username)}
                </Avatar>
              }
              label={user.username}
              variant="outlined"
              sx={{
                display: { xs: 'none', md: 'flex' },
                borderRadius: '10px',
                fontWeight: 600,
                borderColor: (theme) => alpha(theme.palette.text.primary, 0.3),
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.text.primary, 0.05),
                  borderColor: (theme) => alpha(theme.palette.text.primary, 0.5),
                },
              }}
            />
          )}

          {user && (
            <Tooltip title={user.username}>
              <Avatar
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  bgcolor: (theme) => theme.palette.mode === 'dark' ? '#404040' : '#6B6B6B',
                  width: 32,
                  height: 32,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                }}
              >
                {getUserInitials(user.username)}
              </Avatar>
            </Tooltip>
          )}

          <ThemeToggle size="small" />

          <Tooltip title="Logout">
            <IconButton
              color="inherit"
              onClick={handleLogout}
              aria-label="Logout"
              sx={{
                borderRadius: '10px',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
                  color: (theme) => theme.palette.error.main,
                  transform: 'scale(1.05)',
                },
              }}
            >
              <LogOutIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
