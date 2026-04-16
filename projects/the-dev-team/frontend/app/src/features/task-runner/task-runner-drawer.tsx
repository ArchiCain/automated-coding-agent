import { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CancelIcon from '@mui/icons-material/Cancel';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTaskRunnerContext } from './task-runner-context';
import type { TaskStatus } from './types';

function StatusIcon({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'running':
    case 'pending':
      return <CircularProgress size={14} thickness={5} />;
    case 'completed':
      return <CheckCircleIcon sx={{ fontSize: 16, color: '#3fb950' }} />;
    case 'failed':
      return <ErrorIcon sx={{ fontSize: 16, color: '#f85149' }} />;
    case 'cancelled':
      return <CancelIcon sx={{ fontSize: 16, color: '#d29922' }} />;
  }
}

function statusBorderColor(status: TaskStatus): string {
  switch (status) {
    case 'running':
    case 'pending':
      return '#58a6ff';
    case 'completed':
      return '#3fb950';
    case 'failed':
      return '#f85149';
    case 'cancelled':
      return '#d29922';
  }
}

export function TaskRunnerDrawer() {
  const {
    tasks,
    taskOutput,
    activeTaskId,
    setActiveTaskId,
    drawerOpen,
    setDrawerOpen,
    runningCount,
    cancelTask,
    dismissTask,
  } = useTaskRunnerContext();

  const outputRef = useRef<HTMLDivElement>(null);

  const activeTask = tasks.find((t) => t.id === activeTaskId);
  const activeLines = activeTaskId ? taskOutput.get(activeTaskId) ?? [] : [];

  // Auto-scroll to bottom when output updates
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeLines.length]);

  // Nothing to show
  if (tasks.length === 0) return null;

  // Collapsed bar
  if (!drawerOpen) {
    return (
      <Box
        onClick={() => setDrawerOpen(true)}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: 36,
          bgcolor: '#161b22',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          gap: 1,
          cursor: 'pointer',
          zIndex: 1200,
          '&:hover': { bgcolor: '#1c2128' },
        }}
      >
        <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Tasks
        </Typography>
        {runningCount > 0 && (
          <Chip
            icon={<CircularProgress size={10} thickness={5} />}
            label={`${runningCount} running`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: 'rgba(88, 166, 255, 0.1)',
              color: '#58a6ff',
              '& .MuiChip-icon': { color: '#58a6ff' },
            }}
          />
        )}
        {tasks.filter((t) => t.status === 'completed').length > 0 && (
          <Chip
            label={`${tasks.filter((t) => t.status === 'completed').length} done`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: 'rgba(63, 185, 80, 0.1)',
              color: '#3fb950',
            }}
          />
        )}
        {tasks.filter((t) => t.status === 'failed').length > 0 && (
          <Chip
            label={`${tasks.filter((t) => t.status === 'failed').length} failed`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: 'rgba(248, 81, 73, 0.1)',
              color: '#f85149',
            }}
          />
        )}
      </Box>
    );
  }

  return (
    <Drawer
      anchor="bottom"
      open={drawerOpen}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          height: 320,
          bgcolor: '#0d1117',
          borderTop: '1px solid',
          borderColor: 'divider',
        },
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#161b22',
          minHeight: 36,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 1 }}>
          Tasks
        </Typography>

        {/* Task tabs */}
        <Box sx={{ display: 'flex', gap: 0.5, flex: 1, overflow: 'auto' }}>
          {tasks.map((task) => (
            <Chip
              key={task.id}
              icon={<StatusIcon status={task.status} />}
              label={task.taskName}
              size="small"
              variant={task.id === activeTaskId ? 'filled' : 'outlined'}
              onClick={() => setActiveTaskId(task.id)}
              onDelete={
                task.status !== 'running'
                  ? () => dismissTask(task.id)
                  : undefined
              }
              deleteIcon={<CloseIcon sx={{ fontSize: '14px !important' }} />}
              sx={{
                height: 24,
                fontSize: '0.7rem',
                fontFamily: 'monospace',
                borderColor: task.id === activeTaskId ? statusBorderColor(task.status) : 'divider',
                bgcolor: task.id === activeTaskId ? 'rgba(255,255,255,0.05)' : 'transparent',
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
          {activeTask?.status === 'running' && (
            <Tooltip title="Stop task">
              <IconButton
                size="small"
                onClick={() => cancelTask(activeTask.id)}
                sx={{ color: '#f85149', p: 0.5 }}
              >
                <StopIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          <IconButton
            size="small"
            onClick={() => setDrawerOpen(false)}
            sx={{ color: 'text.secondary', p: 0.5 }}
          >
            <ExpandMoreIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Output area */}
      <Box
        ref={outputRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          color: '#c9d1d9',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#30363d', borderRadius: 3 },
        }}
      >
        {!activeTask && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Select a task to view output
          </Typography>
        )}
        {activeTask && activeLines.length === 0 && activeTask.status === 'running' && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Waiting for output...
          </Typography>
        )}
        {activeLines.map((line, i) => (
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
        {activeTask?.status === 'completed' && (
          <div style={{ color: '#3fb950', marginTop: 8 }}>
            Process exited with code {activeTask.exitCode}
          </div>
        )}
        {activeTask?.status === 'failed' && (
          <div style={{ color: '#f85149', marginTop: 8 }}>
            Process failed with exit code {activeTask.exitCode}
          </div>
        )}
        {activeTask?.status === 'cancelled' && (
          <div style={{ color: '#d29922', marginTop: 8 }}>Process was cancelled</div>
        )}
      </Box>
    </Drawer>
  );
}
