import { useState, FormEvent } from "react";
import { Box, TextField, Button, Typography, Alert, Paper, InputAdornment, IconButton, CircularProgress, alpha, Checkbox, FormControlLabel, Link, Divider } from "@mui/material";
import { Visibility, VisibilityOff, Login as LoginIcon, AccountCircle } from "@mui/icons-material";
import { useAuth } from "../hooks/use-auth";
import { brandingConfig } from "../../mui-theme/branding-config";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, error } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login({ username, password });
      // Successful login is handled by AuthProvider
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 480 }}>
      <Paper
        component="form"
        onSubmit={handleSubmit}
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          borderRadius: '16px',
          background: (theme) => theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha('#132F4C', 0.9)} 0%, ${alpha('#1A3A52', 0.9)} 100%)`
            : '#ffffff',
          backdropFilter: 'blur(20px)',
          border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
          boxShadow: (theme) => theme.palette.mode === 'dark'
            ? '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(51, 153, 255, 0.1)'
            : '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(25, 118, 210, 0.08)',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: (theme) => theme.palette.mode === 'dark'
              ? '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(51, 153, 255, 0.2)'
              : '0 12px 40px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(25, 118, 210, 0.12)',
          },
        }}
      >
        {/* Platform Branding */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Box
            component="img"
            src={brandingConfig.logoUrl}
            alt={`${brandingConfig.appName} Logo`}
            sx={{
              height: 48,
              mb: 2,
              filter: (theme) => theme.palette.mode === 'dark' ? 'brightness(0) invert(1)' : 'none',
            }}
            onError={(e) => {
              // Hide image if logo doesn't exist, show fallback icon instead
              e.currentTarget.style.display = 'none';
              const fallbackIcon = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallbackIcon) fallbackIcon.style.display = 'block';
            }}
          />
          <AccountCircle
            sx={{
              fontSize: 48,
              mb: 2,
              display: 'none',
              color: 'primary.main',
              opacity: 0.8
            }}
          />
          <Typography
            variant="h5"
            component="h1"
            fontWeight={600}
            gutterBottom
            sx={{ color: 'primary.main', mb: 1 }}
          >
            {brandingConfig.appName}
          </Typography>
          <Typography
            variant="h4"
            component="h2"
            fontWeight={700}
            gutterBottom
            sx={{
              background: (theme) => theme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #E7EBF0 0%, #B2BAC2 100%)'
                : 'linear-gradient(135deg, #1A2027 0%, #3E5060 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Sign In
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter your credentials to access your account
          </Typography>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{
              mb: 3,
              borderRadius: '12px',
              '& .MuiAlert-icon': {
                fontSize: '1.5rem',
              },
            }}
          >
            {error}
          </Alert>
        )}

        <TextField
          id="username"
          label="Username"
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          fullWidth
          margin="normal"
          autoComplete="username"
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: (theme) => alpha(theme.palette.background.default, 0.4),
            },
          }}
        />

        <TextField
          id="password"
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          fullWidth
          margin="normal"
          autoComplete="current-password"
          sx={{
            mb: 4,
            '& .MuiOutlinedInput-root': {
              backgroundColor: (theme) => alpha(theme.palette.background.default, 0.4),
            },
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="toggle password visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  size="small"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Remember Me Checkbox */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                size="small"
                sx={{
                  '&.Mui-checked': {
                    color: 'primary.main',
                  },
                }}
              />
            }
            label={
              <Typography variant="body2" color="text.secondary">
                Remember me
              </Typography>
            }
          />
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              // TODO: Implement forgot password functionality
              console.log('Forgot password clicked');
            }}
            variant="body2"
            sx={{
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            }}
          >
            Forgot password?
          </Link>
        </Box>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={isSubmitting}
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            boxShadow: (theme) => `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
            '&:hover': {
              boxShadow: (theme) => `0 6px 20px ${alpha(theme.palette.primary.main, 0.5)}`,
            },
            '&:disabled': {
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.3),
              color: (theme) => alpha(theme.palette.common.white, 0.7),
            },
          }}
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>

        {/* Sign Up Link */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Divider sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              or
            </Typography>
          </Divider>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // TODO: Implement sign-up navigation
                console.log('Sign up clicked');
              }}
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Sign up here
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
