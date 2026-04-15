import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import type { NamespaceGroup, PodInfo, ServiceInfo } from './types';

function statusColor(status: string, ready: string): string {
  const s = status.toLowerCase();
  if (s === 'running') {
    const parts = ready.split('/');
    return parts[0] === parts[1] ? '#3fb950' : '#d29922';
  }
  if (s === 'pending' || s === 'waiting' || s === 'containercreating') return '#d29922';
  if (
    s === 'failed' ||
    s === 'crashloopbackoff' ||
    s === 'imagepullbackoff' ||
    s === 'error' ||
    s === 'evicted'
  )
    return '#f85149';
  if (s === 'succeeded' || s === 'completed') return '#8b949e';
  return '#8b949e';
}

/**
 * Match a pod to a service by finding a service whose name is a prefix
 * of the pod name (e.g., service "backend" matches pod "backend-7bd7d4dc5b-849vs").
 */
function findServiceForPod(pod: PodInfo, services: ServiceInfo[]): ServiceInfo | undefined {
  // Sort by name length descending so longer matches win
  const sorted = [...services].sort((a, b) => b.name.length - a.name.length);
  return sorted.find((svc) => pod.name.startsWith(svc.name));
}

function formatAccess(svc: ServiceInfo): string {
  if (svc.ingressHost) return svc.ingressHost;
  return svc.ports.map((p) => `${p.port}`).join(', ');
}

/** Strip the release/namespace prefix from a service name for cleaner display */
function shortServiceName(name: string, namespace: string): string {
  // e.g., "env-testing-features-backend" → "backend" when namespace is "env-testing-features"
  const prefix = `${namespace}-`;
  if (name.startsWith(prefix)) return name.slice(prefix.length);
  return name;
}

const iconButtonSx = {
  p: 0.25,
  '& .MuiSvgIcon-root': { fontSize: '0.85rem' },
  color: 'text.secondary',
  '&:hover': { color: 'text.primary' },
} as const;

function AccessCell({ svc }: { svc: ServiceInfo }) {
  const [copied, setCopied] = useState(false);
  const access = formatAccess(svc);
  const hasIngress = !!svc.ingressHost;

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(access);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`http://${svc.ingressHost}`, '_blank', 'noopener');
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <span>{access}</span>
      {hasIngress && (
        <Tooltip title="Open in new tab">
          <IconButton size="small" sx={iconButtonSx} onClick={handleNavigate}>
            <OpenInNewIcon />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={copied ? 'Copied!' : 'Copy'}>
        <IconButton size="small" sx={iconButtonSx} onClick={handleCopy}>
          <ContentCopyIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

interface NamespaceCardProps {
  group: NamespaceGroup;
  onPodClick?: (pod: PodInfo, serviceName: string) => void;
}

export function NamespaceCard({ group, onPodClick }: NamespaceCardProps) {
  return (
    <Card
      sx={{
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {group.displayName}
          </Typography>
          {(() => {
            const failing = group.pods.filter((p) => {
              const s = p.status.toLowerCase();
              return s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error';
            }).length;
            return failing > 0 ? (
              <Chip
                label={`${failing} failing`}
                size="small"
                sx={{
                  height: 20,
                  fontSize: '0.7rem',
                  bgcolor: 'rgba(248, 81, 73, 0.15)',
                  color: 'error.main',
                }}
              />
            ) : null;
          })()}
        </Box>

        {/* Unified table */}
        {group.pods.length > 0 && (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& td, & th': { border: 0, py: 0.5, px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Service</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Status</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Ready</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Access</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }} align="right">
                    Restarts
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Age</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }} align="right">
                    CPU
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }} align="right">
                    Mem
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.pods.map((pod) => {
                  const svc = findServiceForPod(pod, group.services);
                  return (
                    <TableRow
                      key={pod.name}
                      onClick={() => onPodClick?.(pod, svc?.name ?? pod.name)}
                      sx={{
                        cursor: onPodClick ? 'pointer' : 'default',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                      }}
                    >
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={pod.name}
                      >
                        {shortServiceName(svc?.name ?? pod.name, group.namespace)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: statusColor(pod.status, pod.ready),
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.75rem', color: 'text.secondary' }}
                          >
                            {pod.status}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem' }}>{pod.ready}</TableCell>
                      <TableCell
                        sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {svc ? <AccessCell svc={svc} /> : '-'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontSize: '0.75rem',
                          color: pod.restarts > 0 ? 'warning.main' : 'text.secondary',
                        }}
                      >
                        {pod.restarts}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {pod.age}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {pod.cpu ?? '-'}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary' }}
                      >
                        {pod.memory ?? '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {group.pods.length === 0 && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            No pods
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
