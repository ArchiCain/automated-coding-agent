import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';

interface LogStream {
  stream: Record<string, string>;
  values: [string, string][];
}

interface LokiResult {
  status?: string;
  data?: {
    result: LogStream[];
  };
  error?: string;
}

const PRESETS = [
  { label: 'All app logs', query: '{namespace="app"}' },
  { label: 'All the-dev-team logs', query: '{namespace="the-dev-team"}' },
  { label: 'All sandbox logs', query: '{namespace=~"env-.*"}' },
  { label: 'Errors only', query: '{namespace=~"app|the-dev-team|env-.*"} |~ "(?i)(error|exception|fatal|panic)"' },
  { label: 'Backend logs', query: '{namespace="app", container="backend"}' },
  { label: 'Custom query', query: '' },
];

export function LogsPanel() {
  const [query, setQuery] = useState(PRESETS[0]!.query);
  const [presetIdx, setPresetIdx] = useState(0);
  const [logs, setLogs] = useState<{ timestamp: string; line: string; labels: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit] = useState(200);

  const fetchLogs = useCallback(async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const now = Date.now();
      const start = (now - 3600000) * 1_000_000; // 1 hour ago in nanoseconds
      const end = now * 1_000_000;
      const params = new URLSearchParams({
        query,
        limit: String(limit),
        start: String(start),
        end: String(end),
      });
      const res = await fetch(`/api/cluster/loki/query?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const result: LokiResult = await res.json();
      if (result.error) throw new Error(result.error);

      const entries: { timestamp: string; line: string; labels: string }[] = [];
      for (const stream of result.data?.result ?? []) {
        const labels = Object.entries(stream.stream)
          .filter(([k]) => k === 'namespace' || k === 'container' || k === 'pod')
          .map(([k, v]) => `${k}=${v}`)
          .join(' ');
        for (const [ts, line] of stream.values) {
          const date = new Date(parseInt(ts) / 1_000_000);
          entries.push({
            timestamp: date.toLocaleTimeString(),
            line,
            labels,
          });
        }
      }

      entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      setLogs(entries.slice(0, limit));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [query, limit]);

  return (
    <Card sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Logs</Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Preset</InputLabel>
            <Select
              value={presetIdx}
              label="Preset"
              onChange={(e) => {
                const idx = e.target.value as number;
                setPresetIdx(idx);
                if (PRESETS[idx]?.query) setQuery(PRESETS[idx]!.query);
              }}
              sx={{ fontSize: '0.8rem' }}
            >
              {PRESETS.map((p, i) => (
                <MenuItem key={i} value={i} sx={{ fontSize: '0.8rem' }}>{p.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPresetIdx(PRESETS.length - 1); }}
            placeholder='{namespace="app"}'
            sx={{ flex: 1, minWidth: 300, '& input': { fontSize: '0.8rem', fontFamily: 'monospace' } }}
          />

          <Button
            variant="contained"
            size="small"
            onClick={() => void fetchLogs()}
            disabled={loading || !query}
            sx={{ textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={16} /> : 'Query'}
          </Button>
        </Box>

        {error && (
          <Typography sx={{ color: 'error.main', fontSize: '0.8rem', mb: 1 }}>{error}</Typography>
        )}

        {logs.length === 0 && !loading && !error && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', textAlign: 'center', py: 3 }}>
            Click "Query" to fetch logs from Loki.
          </Typography>
        )}

        {logs.length > 0 && (
          <Box
            sx={{
              maxHeight: 500,
              overflow: 'auto',
              bgcolor: '#0d1117',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              p: 1,
              scrollbarWidth: 'thin',
              scrollbarColor: '#30363d #0d1117',
            }}
          >
            {logs.map((entry, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.25, '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' } }}>
                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {entry.timestamp}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#58a6ff', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {entry.labels}
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.primary', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {entry.line}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
