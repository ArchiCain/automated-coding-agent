import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Skeleton from '@mui/material/Skeleton';
import { NamespaceCard } from './namespace-card';
import { LogDrawer } from './log-drawer';
import type { NamespaceGroup, PodInfo } from './types';

const INFRA_NAMESPACES = ['default', 'dns', 'traefik', 'registry', 'ingress-nginx', 'monitoring'];

function timeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
}

interface ServiceTableProps {
  namespaces: NamespaceGroup[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  showInfra?: boolean;
  onServiceClick?: (namespace: string, serviceName: string) => void;
}

export function ServiceTable({
  namespaces,
  loading,
  error,
  lastUpdated,
  refresh,
  showInfra = true,
  onServiceClick,
}: ServiceTableProps) {
  const [sinceText, setSinceText] = useState('');
  const [logTarget, setLogTarget] = useState<{ pod: PodInfo; serviceName: string } | null>(null);

  useEffect(() => {
    if (!lastUpdated) return;
    setSinceText(timeSince(lastUpdated));
    const id = setInterval(() => setSinceText(timeSince(lastUpdated)), 1000);
    return () => clearInterval(id);
  }, [lastUpdated]);

  const failingPods = namespaces.reduce(
    (sum, ns) =>
      sum + ns.pods.filter((p) => {
        const s = p.status.toLowerCase();
        return s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error';
      }).length,
    0,
  );

  const appNamespaces = namespaces.filter((ns) => !INFRA_NAMESPACES.includes(ns.namespace));
  const infraNamespaces = namespaces.filter((ns) => INFRA_NAMESPACES.includes(ns.namespace));

  const handlePodClick = (pod: PodInfo, svc: string) => {
    if (onServiceClick) {
      onServiceClick(pod.namespace, svc);
    } else {
      setLogTarget({ pod, serviceName: svc });
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
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

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={200} sx={{ bgcolor: 'rgba(255,255,255,0.05)' }} />
          ))}
        </Box>
      )}

      {!loading && namespaces.length === 0 && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <Typography sx={{ color: 'text.secondary' }}>No cluster data available</Typography>
        </Box>
      )}

      {!loading && namespaces.length > 0 && (
        <>
          {showInfra && infraNamespaces.length > 0 && (
            <Accordion
              defaultExpanded={false}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '4px !important',
                mb: 2,
                '&:before': { display: 'none' },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Cluster Infrastructure
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {infraNamespaces.map((ns) => (
                    <NamespaceCard key={ns.namespace} group={ns} onPodClick={handlePodClick} />
                  ))}
                </Box>
              </AccordionDetails>
            </Accordion>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {appNamespaces.map((ns) => (
              <NamespaceCard key={ns.namespace} group={ns} onPodClick={handlePodClick} />
            ))}
          </Box>
        </>
      )}

      <LogDrawer
        open={!!logTarget}
        onClose={() => setLogTarget(null)}
        namespace={logTarget?.pod.namespace ?? ''}
        podName={logTarget?.pod.name ?? ''}
        serviceName={logTarget?.serviceName ?? ''}
      />
    </>
  );
}
