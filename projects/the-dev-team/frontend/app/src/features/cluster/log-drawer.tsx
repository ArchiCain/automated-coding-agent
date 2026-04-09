import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import CircularProgress from '@mui/material/CircularProgress';

interface LogDrawerProps {
  open: boolean;
  onClose: () => void;
  namespace: string;
  podName: string;
  serviceName: string;
}

export function LogDrawer({ open, onClose, namespace, podName, serviceName }: LogDrawerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    if (!podName || !namespace) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cluster/logs/${namespace}/${podName}?tail=300`);
      if (res.ok) {
        const data = await res.json();
        setLines(data.lines ?? []);
      }
    } catch {
      setLines(['Failed to fetch logs']);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchLogs();
      const id = setInterval(() => void fetchLogs(), 5000);
      return () => clearInterval(id);
    }
  }, [open, podName, namespace]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          height: '50vh',
          bgcolor: '#0d1117',
          borderTop: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#161b22',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
          {serviceName}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {namespace}/{podName}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {loading && <CircularProgress size={14} sx={{ color: 'text.secondary' }} />}
          <IconButton size="small" onClick={() => void fetchLogs()} sx={{ color: 'text.secondary' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Log content */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 2,
          py: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          color: '#c9d1d9',
          scrollbarWidth: 'thin',
          scrollbarColor: '#30363d #0d1117',
        }}
      >
        {lines.length === 0 && !loading && (
          <Typography sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.75rem' }}>
            No logs available
          </Typography>
        )}
        {lines.map((line, i) => (
          <Box
            key={i}
            sx={{
              '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
              color: line.toLowerCase().includes('error') ? '#f85149' :
                     line.toLowerCase().includes('warn') ? '#d29922' : 'inherit',
            }}
          >
            {line}
          </Box>
        ))}
        <div ref={bottomRef} />
      </Box>
    </Drawer>
  );
}
