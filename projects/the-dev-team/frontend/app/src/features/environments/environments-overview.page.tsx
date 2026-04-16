import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useEnvironments } from './use-environments';
import type { HealthStatus } from './types';

function healthColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '#3fb950';
    case 'degraded':
      return '#d29922';
    case 'failing':
      return '#f85149';
    case 'unknown':
      return '#8b949e';
  }
}

function healthLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'degraded':
      return 'Degraded';
    case 'failing':
      return 'Failing';
    case 'unknown':
      return 'Unknown';
  }
}

function statusDotColor(podStatus: string, ready: string): string {
  const s = podStatus.toLowerCase();
  if (s === 'running') {
    const parts = ready.split('/');
    return parts[0] === parts[1] ? '#3fb950' : '#d29922';
  }
  if (s === 'pending' || s === 'waiting' || s === 'containercreating') return '#d29922';
  if (s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error' || s === 'evicted')
    return '#f85149';
  return '#8b949e';
}

export function EnvironmentsOverviewPage() {
  const { environments, loading, error, refresh } = useEnvironments();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Environments
        </Typography>
        <IconButton
          size="small"
          onClick={() => void refresh()}
          sx={{ ml: 'auto', color: 'text.secondary' }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {loading && environments.length === 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="rounded" height={160} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
          <Skeleton variant="rounded" height={120} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
        </Box>
      )}

      {environments.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {environments.map((env) => (
            <Card
              key={env.name}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: env.type === 'main' ? 'primary.dark' : 'divider',
                borderRadius: 1,
              }}
            >
              <CardActionArea onClick={() => navigate(`/env/${env.name}`)}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
                      {env.displayName}
                    </Typography>
                    <Chip
                      label={healthLabel(env.healthStatus)}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        bgcolor: `${healthColor(env.healthStatus)}20`,
                        color: healthColor(env.healthStatus),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{ color: 'text.secondary', ml: 'auto', fontFamily: 'monospace' }}
                    >
                      {env.namespace}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {env.totalPods} pod{env.totalPods !== 1 ? 's' : ''}
                    </Typography>
                    {env.failingPods > 0 && (
                      <Typography variant="caption" sx={{ color: '#f85149' }}>
                        {env.failingPods} failing
                      </Typography>
                    )}
                  </Box>

                  {/* Mini status grid - colored dots per pod */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {env.namespaces.flatMap((ns) =>
                      ns.pods.map((pod) => (
                        <Box
                          key={pod.name}
                          title={pod.name}
                          sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: statusDotColor(pod.status, pod.ready),
                          }}
                        />
                      )),
                    )}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      )}

      {!loading && environments.length === 0 && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <Typography sx={{ color: 'text.secondary' }}>No environments found</Typography>
        </Box>
      )}
    </Box>
  );
}
