import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { useCluster } from '../cluster/use-cluster';
import { EnvironmentChatPanel } from './environment-chat-panel';

function statusColor(status: string, ready: string): string {
  const s = status.toLowerCase();
  if (s === 'running') {
    const parts = ready.split('/');
    return parts[0] === parts[1] ? '#3fb950' : '#d29922';
  }
  if (s === 'pending' || s === 'waiting' || s === 'containercreating') return '#d29922';
  if (s === 'failed' || s === 'crashloopbackoff' || s === 'imagepullbackoff' || s === 'error' || s === 'evicted')
    return '#f85149';
  return '#8b949e';
}

export function ApplicationDetailPage() {
  const { name, appName } = useParams<{ name: string; appName: string }>();
  const navigate = useNavigate();
  const cluster = useCluster();
  const [tab, setTab] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const logsRef = useRef<HTMLDivElement>(null);

  // Determine namespace from env name
  const namespace = name === 'main' ? 'app' : name === 'platform' ? 'the-dev-team' : `env-${name}`;

  // Find pods matching this app
  const nsGroup = cluster.namespaces.find((ns) => ns.namespace === namespace);
  const appPods = nsGroup?.pods.filter((p) => p.name.includes(appName || '')) ?? [];
  const appServices = nsGroup?.services.filter((s) => s.name.includes(appName || '')) ?? [];

  // Default role based on app
  const defaultRole = appName?.includes('frontend') ? 'default' : 'default'; // Will be 'frontend-owner' when role exists

  const fetchLogs = useCallback(async () => {
    if (!appPods.length) return;
    setLogsLoading(true);
    try {
      const pod = appPods[0]!;
      const res = await fetch(`/api/cluster/logs/${pod.namespace}/${pod.name}?tail=200`);
      if (res.ok) {
        const text = await res.text();
        setLogs(text.split('\n').filter(Boolean));
      }
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
    }
  }, [appPods.length > 0 ? appPods[0]?.name : '']); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tab === 1) void fetchLogs();
  }, [tab, fetchLogs]);

  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs.length]);

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Breadcrumb */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="text.secondary"
            sx={{ cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => navigate('/')}
          >
            Environments
          </Link>
          <Link
            underline="hover"
            color="text.secondary"
            sx={{ cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => navigate(`/env/${name}`)}
          >
            {name}
          </Link>
          <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {appName}
          </Typography>
        </Breadcrumbs>

        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          {appName}
        </Typography>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            mb: 3,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' },
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Tab label="Overview" />
          <Tab label="Logs" />
        </Tabs>

        {tab === 0 && (
          <>
            {/* Pod status cards */}
            {appPods.length === 0 && (
              <Typography sx={{ color: 'text.secondary' }}>No pods found for {appName}</Typography>
            )}

            {appPods.map((pod) => (
              <Card
                key={pod.name}
                sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', mb: 2 }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: statusColor(pod.status, pod.ready),
                      }}
                    />
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {pod.name}
                    </Typography>
                    <Chip
                      label={pod.status}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.65rem',
                        bgcolor: `${statusColor(pod.status, pod.ready)}20`,
                        color: statusColor(pod.status, pod.ready),
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    <DetailItem label="Ready" value={pod.ready} />
                    <DetailItem label="Restarts" value={String(pod.restarts)} warn={pod.restarts > 0} />
                    <DetailItem label="Age" value={pod.age} />
                    <DetailItem label="Node" value={pod.nodeName} />
                    {pod.cpu && <DetailItem label="CPU" value={pod.cpu} />}
                    {pod.memory && <DetailItem label="Memory" value={pod.memory} />}
                  </Box>

                  {/* Container details */}
                  {pod.containers.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                        Containers
                      </Typography>
                      {pod.containers.map((c) => (
                        <Box key={c.name} sx={{ display: 'flex', gap: 2, mt: 0.5, alignItems: 'center' }}>
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: c.ready ? '#3fb950' : '#f85149',
                            }}
                          />
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                            {c.name}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                            {c.image}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            ))}

            {/* Access URLs */}
            {appServices.length > 0 && (
              <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', mb: 2 }}>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Service Endpoints
                  </Typography>
                  {appServices.map((svc) => (
                    <Box key={svc.name} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {svc.name}
                      </Typography>
                      {svc.ingressHost && (
                        <Link
                          href={`http://${svc.ingressHost}`}
                          target="_blank"
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {svc.ingressHost}
                        </Link>
                      )}
                      {!svc.ingressHost && (
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.7rem' }}>
                          {svc.clusterIP}:{svc.ports.map((p) => p.port).join(', ')}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {tab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2">Pod Logs</Typography>
              <IconButton
                size="small"
                onClick={() => void fetchLogs()}
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
              {logsLoading && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Loading...
                </Typography>
              )}
            </Box>
            <Box
              ref={logsRef}
              sx={{
                bgcolor: '#0d1117',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
                maxHeight: 500,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                lineHeight: 1.6,
                '&::-webkit-scrollbar': { width: 6 },
                '&::-webkit-scrollbar-thumb': { bgcolor: '#30363d', borderRadius: 3 },
              }}
            >
              {logs.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: /error/i.test(line) ? '#f85149' : /warn/i.test(line) ? '#d29922' : '#c9d1d9',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {line}
                </div>
              ))}
              {logs.length === 0 && !logsLoading && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  No logs available
                </Typography>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Chat panel */}
      <EnvironmentChatPanel defaultRole={defaultRole} />
    </Box>
  );
}

function DetailItem({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Box>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: warn ? '#d29922' : 'text.primary' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
