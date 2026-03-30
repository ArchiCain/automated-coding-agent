import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Container, CircularProgress, Fade, alpha } from "@mui/material";
import { useAuth } from "../hooks/use-auth";
import LoginForm from "./login-form";

export default function Login() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate("/");
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: (theme) => theme.palette.mode === 'dark'
            ? 'linear-gradient(135deg, #0A1929 0%, #1A2332 100%)'
            : 'linear-gradient(135deg, #F3F6F9 0%, #E7EBF0 100%)',
        }}
      >
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #0A1929 0%, #1A2332 50%, #0A1929 100%)'
          : 'linear-gradient(135deg, #F3F6F9 0%, #E7EBF0 50%, #F3F6F9 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '80%',
          height: '150%',
          background: (theme) => `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 70%)`,
          transform: 'rotate(-15deg)',
          pointerEvents: 'none',
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          bottom: '-50%',
          left: '-20%',
          width: '80%',
          height: '150%',
          background: (theme) => `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 70%)`,
          transform: 'rotate(15deg)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
          zIndex: 1,
        }}
      >
        <Fade in timeout={600}>
          <Box sx={{ width: '100%' }}>
            <LoginForm />
          </Box>
        </Fade>
      </Container>
    </Box>
  );
}
