import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import Skeleton from '@mui/material/Skeleton';
import { useCluster } from './use-cluster';
import { NamespaceCard } from './namespace-card';

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

export function ClusterPage() {
  const { namespaces, loading, error, lastUpdated, refresh } = useCluster();
  const [sinceText, setSinceText] = useState('');

  useEffect(() => {
    if (!lastUpdated) return;
    setSinceText(timeSince(lastUpdated));
    const id = setInterval(() => setSinceText(timeSince(lastUpdated)), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const totalPods = namespaces.reduce((sum, ns) => sum + ns.pods.length, 0);
  const runningPods = namespaces.reduce(
    (sum, ns) => sum + ns.pods.filter((p) => p.status.toLowerCase() === 'running').length,
    0,
  );
  const failingPods = namespaces.reduce(
    (sum, ns) =>
      sum +
      ns.pods.filter((p) => {
        const s = p.status.toLowerCase();
        return (
          s === 'failed' ||
          s === 'crashloopbackoff' ||
          s === 'imagepullbackoff' ||
          s === 'error'
        );
      }).length,
    0,
  );

  return (
    <Box
      sx={{
        pt: '64px',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Cluster
          </Typography>
          <Chip
            label={`${totalPods} pods`}
            size="small"
            sx={{ bgcolor: 'rgba(88, 166, 255, 0.15)', color: 'primary.main' }}
          />
          {runningPods > 0 && (
            <Chip
              label={`${runningPods} running`}
              size="small"
              sx={{ bgcolor: 'rgba(63, 185, 80, 0.15)', color: 'secondary.main' }}
            />
          )}
          {failingPods > 0 && (
            <Chip
              label={`${failingPods} failing`}
              size="small"
              sx={{ bgcolor: 'rgba(248, 81, 73, 0.15)', color: 'error.main' }}
            />
          )}

          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            {lastUpdated && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Updated {sinceText}
              </Typography>
            )}
            <IconButton size="small" onClick={() => void refresh()} sx={{ color: 'text.secondary' }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Loading skeleton */}
        {loading && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={200}
                sx={{ bgcolor: 'rgba(255,255,255,0.05)' }}
              />
            ))}
          </Box>
        )}

        {/* Namespace cards */}
        {!loading && namespaces.length === 0 && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <Typography sx={{ color: 'text.secondary' }}>
              No cluster data available
            </Typography>
          </Box>
        )}

        {!loading && namespaces.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2,
            }}
          >
            {namespaces.map((ns) => (
              <NamespaceCard key={ns.namespace} group={ns} />
            ))}
          </Box>
        )}

        {/* Inline loading indicator for refreshes */}
        {!loading && lastUpdated && (
          <Box sx={{ display: 'none' }}>
            <CircularProgress size={12} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
