import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────

interface MetricSeries {
  metric: Record<string, string>;
  values: [number, string][];
}

interface PrometheusResult {
  status: string;
  data?: { resultType: string; result: MetricSeries[] };
}

interface TimePoint {
  time: number;
  label: string;
  value: number;
}

// ── Helpers ──────────────────────────────────────────────────────

const INFRA_NS = new Set([
  'default', 'dns', 'traefik', 'registry', 'ingress-nginx',
  'kube-system', 'kube-public', 'kube-node-lease', 'monitoring',
]);

const COLORS: Record<string, string> = {
  backend: '#58a6ff',
  frontend: '#3fb950',
  database: '#d29922',
  keycloak: '#bc8cff',
  docs: '#79c0ff',
};

function getColor(service: string): string {
  return COLORS[service] || '#8b949e';
}

function displayNs(ns: string): string {
  if (ns === 'app') return 'app';
  if (ns.startsWith('env-')) return `sandbox-${ns.slice(4)}`;
  return ns;
}

/** Extract service name from pod name by stripping ReplicaSet/StatefulSet suffixes and namespace prefixes */
function podToService(pod: string, namespace?: string): string {
  let name = pod;
  // Strip namespace prefix if pod name starts with it (e.g., "the-dev-team-backend-xxx" → "backend-xxx")
  if (namespace && name.startsWith(`${namespace}-`)) {
    name = name.slice(namespace.length + 1);
  }
  // Also strip env-* prefix for sandbox pods
  const envMatch = name.match(/^env-[^-]+-(.+)$/);
  if (envMatch) name = envMatch[1]!;
  // StatefulSet: "database-0" → "database"
  if (/^[a-z]+-\d+$/.test(name)) return name.replace(/-\d+$/, '');
  // Deployment: "backend-7bd7d4dc5b-849vs" → "backend"
  return name.replace(/-[a-f0-9]+-[a-z0-9]+$/, '').replace(/-[a-f0-9]{8,}$/, '');
}

function formatMem(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes)} B`;
}

function formatCpu(cores: number): string {
  if (cores >= 1) return `${cores.toFixed(1)} cores`;
  return `${(cores * 1000).toFixed(0)} mcores`;
}

function formatTime(epoch: number): string {
  return new Date(epoch * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SORT_ORDER: Record<string, number> = { 'the-dev-team': 0, app: 1 };
function sortNs(a: string, b: string): number {
  const oa = SORT_ORDER[a] ?? (a.startsWith('env-') ? 2 : 3);
  const ob = SORT_ORDER[b] ?? (b.startsWith('env-') ? 2 : 3);
  return oa !== ob ? oa - ob : a.localeCompare(b);
}

// ── Data fetching ────────────────────────────────────────────────

async function fetchRange(query: string, rangeSeconds = 3600, stepSeconds = 60): Promise<MetricSeries[]> {
  const now = Math.floor(Date.now() / 1000);
  const start = now - rangeSeconds;
  const params = new URLSearchParams({
    query,
    start: String(start),
    end: String(now),
    step: String(stepSeconds),
  });
  try {
    const res = await fetch(`/api/cluster/prometheus/query?${params}`);
    if (!res.ok) return [];
    const result: PrometheusResult = await res.json();
    return result.data?.result ?? [];
  } catch {
    return [];
  }
}

/** Aggregate multiple pods into a single service time series */
function aggregateByService(series: MetricSeries[], namespace?: string): Map<string, TimePoint[]> {
  const serviceMap = new Map<string, Map<number, number>>();

  for (const s of series) {
    const svc = podToService(s.metric.pod || 'unknown', namespace);
    if (!serviceMap.has(svc)) serviceMap.set(svc, new Map());
    const svcData = serviceMap.get(svc)!;
    for (const [ts, val] of s.values) {
      svcData.set(ts, (svcData.get(ts) || 0) + parseFloat(val));
    }
  }

  const result = new Map<string, TimePoint[]>();
  for (const [svc, timeMap] of serviceMap) {
    const points = Array.from(timeMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([ts, val]) => ({ time: ts, label: formatTime(ts), value: val }));
    result.set(svc, points);
  }
  return result;
}

// ── Sparkline component ──────────────────────────────────────────

function Sparkline({
  title,
  data,
  color,
  formatter,
  onClick,
  height = 100,
}: {
  title: string;
  data: TimePoint[];
  color: string;
  formatter: (v: number) => string;
  onClick?: () => void;
  height?: number;
}) {
  const latest = data.length > 0 ? data[data.length - 1]!.value : 0;

  return (
    <Box
      onClick={onClick}
      sx={{
        flex: '1 1 0',
        minWidth: 160,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { opacity: 0.85 } : {},
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.25 }}>
        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color }}>{title}</Typography>
        <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700 }}>
          {formatter(latest)}
        </Typography>
      </Box>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip
              contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', fontSize: '0.65rem', padding: '4px 8px' }}
              labelStyle={{ color: '#8b949e' }}
              formatter={(value) => [formatter(value as number), '']}
            />
            <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>—</Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Namespace metrics card ───────────────────────────────────────

function NamespaceMetrics({
  namespace,
  displayName,
  onServiceClick,
}: {
  namespace: string;
  displayName: string;
  onServiceClick: (ns: string, service: string) => void;
}) {
  const [cpuByService, setCpu] = useState<Map<string, TimePoint[]>>(new Map());
  const [memByService, setMem] = useState<Map<string, TimePoint[]>>(new Map());
  const [netByService, setNet] = useState<Map<string, TimePoint[]>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [cpuSeries, memSeries, netSeries] = await Promise.all([
        fetchRange(`sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod!=""}[2m])) by (pod)`),
        fetchRange(`sum(container_memory_working_set_bytes{namespace="${namespace}",pod!=""}) by (pod)`),
        fetchRange(`sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod!=""}[2m])) by (pod)`),
      ]);
      if (cancelled) return;
      setCpu(aggregateByService(cpuSeries, namespace));
      setMem(aggregateByService(memSeries, namespace));
      setNet(aggregateByService(netSeries, namespace));
      setLoading(false);
    }
    void load();
    const id = setInterval(() => void load(), 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [namespace]);

  const services = Array.from(new Set([...cpuByService.keys(), ...memByService.keys()])).sort();
  const formatNet = (v: number) => {
    if (v > 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB/s`;
    if (v > 1024) return `${(v / 1024).toFixed(0)} KB/s`;
    return `${v.toFixed(0)} B/s`;
  };

  return (
    <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>{displayName}</Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {/* CPU row */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                CPU
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {services.map((svc) => (
                  <Sparkline
                    key={`cpu-${svc}`}
                    title={svc}
                    data={cpuByService.get(svc) || []}
                    color={getColor(svc)}
                    formatter={formatCpu}
                    onClick={() => onServiceClick(namespace, svc)}
                  />
                ))}
              </Box>
            </Box>

            {/* Memory row */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                Memory
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {services.map((svc) => (
                  <Sparkline
                    key={`mem-${svc}`}
                    title={svc}
                    data={memByService.get(svc) || []}
                    color={getColor(svc)}
                    formatter={formatMem}
                    onClick={() => onServiceClick(namespace, svc)}
                  />
                ))}
              </Box>
            </Box>

            {/* Network row */}
            <Box>
              <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', mb: 0.5, textTransform: 'uppercase', letterSpacing: 1 }}>
                Network
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                {services.map((svc) => (
                  <Sparkline
                    key={`net-${svc}`}
                    title={svc}
                    data={netByService.get(svc) || []}
                    color={getColor(svc)}
                    formatter={formatNet}
                    onClick={() => onServiceClick(namespace, svc)}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Service detail view ──────────────────────────────────────────

const RANGES = [
  { label: '15m', seconds: 900, step: 15 },
  { label: '1h', seconds: 3600, step: 60 },
  { label: '3h', seconds: 10800, step: 120 },
  { label: '6h', seconds: 21600, step: 300 },
  { label: '24h', seconds: 86400, step: 600 },
];

function DetailChart({
  title,
  data,
  color,
  formatter,
}: {
  title: string;
  data: TimePoint[];
  color: string;
  formatter: (v: number) => string;
}) {
  return (
    <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', mb: 1 }}>
          {title}
        </Typography>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" tick={{ fill: '#8b949e', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} tickFormatter={formatter} width={55} />
              <Tooltip
                contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', fontSize: '0.7rem' }}
                labelStyle={{ color: '#8b949e' }}
                formatter={(value) => [formatter(value as number), '']}
              />
              <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>No data for this range</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceDetail({
  namespace,
  service,
  onBack,
}: {
  namespace: string;
  service: string;
  onBack: () => void;
}) {
  const [rangeIdx, setRangeIdx] = useState(1); // default 1h
  const [cpuData, setCpu] = useState<TimePoint[]>([]);
  const [memData, setMem] = useState<TimePoint[]>([]);
  const [netRxData, setNetRx] = useState<TimePoint[]>([]);
  const [netTxData, setNetTx] = useState<TimePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const range = RANGES[rangeIdx]!;
  const color = getColor(service);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Match all pods for this service using regex
    const podRegex = `${service}(-[a-z0-9]+)*`;
    const [cpu, mem, rx, tx] = await Promise.all([
      fetchRange(`sum(rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`, range.seconds, range.step),
      fetchRange(`sum(container_memory_working_set_bytes{namespace="${namespace}",pod=~"${podRegex}"})`, range.seconds, range.step),
      fetchRange(`sum(rate(container_network_receive_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`, range.seconds, range.step),
      fetchRange(`sum(rate(container_network_transmit_bytes_total{namespace="${namespace}",pod=~"${podRegex}"}[2m]))`, range.seconds, range.step),
    ]);

    const toPoints = (series: MetricSeries[]): TimePoint[] => {
      if (series.length === 0) return [];
      return series[0]!.values
        .map(([ts, val]) => ({ time: ts, label: formatTime(ts), value: parseFloat(val) }))
        .sort((a, b) => a.time - b.time);
    };

    setCpu(toPoints(cpu));
    setMem(toPoints(mem));
    setNetRx(toPoints(rx));
    setNetTx(toPoints(tx));
    setLoading(false);
  }, [namespace, service, range]);

  useEffect(() => {
    void fetchData();
    const id = setInterval(() => void fetchData(), 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const formatNet = (v: number) => {
    if (v > 1024 * 1024) return `${(v / (1024 * 1024)).toFixed(1)} MB/s`;
    if (v > 1024) return `${(v / 1024).toFixed(0)} KB/s`;
    return `${v.toFixed(0)} B/s`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={onBack} sx={{ color: 'text.secondary' }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {displayNs(namespace)}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color }}>
            / {service}
          </Typography>
        </Box>
        <ToggleButtonGroup
          value={rangeIdx}
          exclusive
          onChange={(_, v) => { if (v !== null) setRangeIdx(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { fontSize: '0.7rem', py: 0.25, px: 1, textTransform: 'none' } }}
        >
          {RANGES.map((r, i) => (
            <ToggleButton key={r.label} value={i}>{r.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <DetailChart title="CPU Usage" data={cpuData} color={color} formatter={formatCpu} />
            <DetailChart title="Memory Usage" data={memData} color={color} formatter={formatMem} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <DetailChart title="Network Receive" data={netRxData} color={color} formatter={formatNet} />
            <DetailChart title="Network Transmit" data={netTxData} color={color} formatter={formatNet} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Main panel ───────────────────────────────────────────────────

export function MetricsPanel() {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [drillDown, setDrillDown] = useState<{ ns: string; service: string } | null>(null);

  const fetchNamespaces = useCallback(async () => {
    try {
      const res = await fetch('/api/cluster/namespaces');
      if (!res.ok) return;
      const nsList: string[] = await res.json();
      setNamespaces(nsList.filter((ns) => !INFRA_NS.has(ns)).sort(sortNs));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchNamespaces(); }, [fetchNamespaces]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (drillDown) {
    return (
      <ServiceDetail
        namespace={drillDown.ns}
        service={drillDown.service}
        onBack={() => setDrillDown(null)}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {namespaces.map((ns) => (
        <NamespaceMetrics
          key={ns}
          namespace={ns}
          displayName={displayNs(ns)}
          onServiceClick={(n, s) => setDrillDown({ ns: n, service: s })}
        />
      ))}
    </Box>
  );
}
