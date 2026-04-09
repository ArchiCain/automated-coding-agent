import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
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

function formatPorts(svc: ServiceInfo): string {
  return svc.ports
    .map((p) => (p.targetPort ? `${p.port}→${p.targetPort}` : `${p.port}`))
    .join(', ');
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
            {group.namespace}
          </Typography>
          <Chip
            label={`${group.pods.length} pod${group.pods.length !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              bgcolor: 'rgba(88, 166, 255, 0.15)',
              color: 'primary.main',
            }}
          />
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
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Ports</TableCell>
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
                        {svc?.name ?? pod.name}
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
                        {svc ? formatPorts(svc) : '-'}
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
