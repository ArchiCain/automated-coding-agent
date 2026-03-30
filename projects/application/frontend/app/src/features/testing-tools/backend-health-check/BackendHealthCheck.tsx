import { Card, CardContent, Box, Typography, Button, CircularProgress, Alert } from '@mui/material';
import { useBackendHealthCheck } from './useBackendHealthCheck';
import { HealthStatus } from './types';

interface BackendHealthCheckProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
  showTimestamp?: boolean;
  showRefreshButton?: boolean;
}

export function BackendHealthCheck({
  autoRefresh = true,
  refreshInterval = 30000,
  showTimestamp = true,
  showRefreshButton = true
}: BackendHealthCheckProps) {
  const { data, loading, error, lastChecked, refresh } = useBackendHealthCheck(autoRefresh, refreshInterval);

  const getStatusBgColor = (_status: HealthStatus['status']) => {
    // Always use neutral background
    return 'background.paper';
  };

  const getStatusIcon = (status: HealthStatus['status']) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading && !data) {
    return (
      <Card elevation={1}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={20} />
            <Typography color="text.secondary">Checking backend health...</Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      elevation={1}
      sx={{
        bgcolor: getStatusBgColor(data?.status || 'unknown'),
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h5">{data ? getStatusIcon(data.status) : '❓'}</Typography>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                Backend Status: {data?.status === 'healthy' ? 'Healthy' : data?.status === 'unhealthy' ? 'Unhealthy' : 'Unknown'}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {data?.message || 'No status available'}
              </Typography>
              {data?.version && (
                <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 0.5 }}>
                  Version: {data.version}
                </Typography>
              )}
              {data?.uptime && (
                <Typography variant="caption" sx={{ opacity: 0.6, display: 'block' }}>
                  Uptime: {data.uptime}
                </Typography>
              )}
            </Box>
          </Box>

          {showRefreshButton && (
            <Button
              onClick={refresh}
              disabled={loading}
              size="small"
              variant="outlined"
            >
              {loading ? 'Checking...' : 'Refresh'}
            </Button>
          )}
        </Box>

        {showTimestamp && lastChecked && (
          <Typography variant="caption" sx={{ opacity: 0.6, display: 'block', mt: 1 }}>
            Last checked: {formatTimestamp(lastChecked)}
          </Typography>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Error:</strong> {error}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
