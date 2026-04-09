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
import type { NamespaceGroup } from './types';

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

interface NamespaceCardProps {
  group: NamespaceGroup;
}

export function NamespaceCard({ group }: NamespaceCardProps) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
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

        {/* Pods table */}
        {group.pods.length > 0 && (
          <Box sx={{ overflowX: 'auto', mb: group.services.length > 0 ? 2 : 0 }}>
            <Table size="small" sx={{ '& td, & th': { border: 0, py: 0.5, px: 1 } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Name</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Status</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Ready</TableCell>
                  <TableCell
                    sx={{ color: 'text.secondary', fontSize: '0.7rem' }}
                    align="right"
                  >
                    Restarts
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>Age</TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }} align="right">
                    CPU
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.7rem' }} align="right">
                    Memory
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.pods.map((pod) => (
                  <TableRow key={pod.name} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                    <TableCell
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {pod.name}
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
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {/* Services */}
        {group.services.length > 0 && (
          <Box>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.5, display: 'block' }}
            >
              Services
            </Typography>
            {group.services.map((svc) => (
              <Box
                key={svc.name}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.25,
                  fontSize: '0.75rem',
                }}
              >
                <Typography
                  sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'text.primary' }}
                >
                  {svc.name}
                </Typography>
                <Chip
                  label={svc.type}
                  size="small"
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'rgba(255,255,255,0.06)' }}
                />
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', ml: 'auto' }}>
                  {svc.ports.map((p) => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ')}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
