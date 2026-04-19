import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Fab from '@mui/material/Fab';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import SyncIcon from '@mui/icons-material/Sync';
import { AgentChatBubble } from './agent-chat-bubble';

interface SyncSetupResult {
  worktreePath: string;
  branch: string;
  featureName: string;
  sandboxName: string;
}

interface SyncChatBubbleProps {
  featurePath: string | null;
  onDocChanged?: () => void;
}

export function SyncChatBubble({ featurePath, onDocChanged }: SyncChatBubbleProps) {
  const [syncSetup, setSyncSetup] = useState<SyncSetupResult | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [redeploying, setRedeploying] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);

  const isDisabled = !featurePath;

  const handleSetup = useCallback(async () => {
    if (!featurePath) return;
    setSettingUp(true);
    setSetupError(null);

    try {
      const res = await fetch('/api/mastra/sync/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featurePath }),
      });

      if (!res.ok) {
        throw new Error(`Setup failed: ${res.statusText}`);
      }

      const result: SyncSetupResult = await res.json();
      setSyncSetup(result);
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : String(err));
    } finally {
      setSettingUp(false);
    }
  }, [featurePath]);

  const handleSyncComplete = useCallback(
    async (data: { worktreePath: string; hasNewCommits: boolean }) => {
      if (!data.hasNewCommits || !syncSetup) return;

      setRedeploying(true);
      try {
        await fetch('/api/task-runner/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskName: 'env:deploy',
            vars: {
              NAME: syncSetup.sandboxName,
              WORKTREE: syncSetup.worktreePath,
            },
          }),
        });
      } catch {
        // Redeploy is best-effort
      } finally {
        setRedeploying(false);
      }
    },
    [syncSetup],
  );

  // If we have a sync setup, show the agent chat bubble
  if (syncSetup) {
    return (
      <>
        <AgentChatBubble
          agentName="sync-agent"
          title={`Sync: ${syncSetup.featureName}`}
          icon={<SyncIcon sx={{ fontSize: 18 }} />}
          accentColor="#3fb950"
          fabPosition={88}
          worktreePath={syncSetup.worktreePath}
          onDocChanged={onDocChanged}
          onSyncComplete={handleSyncComplete}
        />
        {redeploying && (
          <Box
            sx={{
              position: 'fixed',
              bottom: 88,
              right: 88,
              zIndex: 1400,
              bgcolor: '#161b22',
              border: '1px solid',
              borderColor: '#3fb950',
              borderRadius: 1,
              px: 1.5,
              py: 0.75,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <CircularProgress size={12} sx={{ color: '#3fb950' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#3fb950' }}>
              Redeploying sandbox...
            </Typography>
          </Box>
        )}
      </>
    );
  }

  // Setup flow — show FAB that opens a setup panel
  if (!showSetupPanel) {
    return (
      <Fab
        color="primary"
        onClick={() => !isDisabled && setShowSetupPanel(true)}
        title={isDisabled ? 'Navigate to a feature directory to start syncing' : 'Start Sync'}
        sx={{
          position: 'fixed',
          bottom: 24,
          right: 88,
          zIndex: 1300,
          bgcolor: isDisabled ? '#30363d' : '#3fb950',
          '&:hover': { bgcolor: isDisabled ? '#30363d' : '#2ea043' },
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        <SyncIcon />
      </Fab>
    );
  }

  // Setup panel
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 360,
        zIndex: 1300,
        bgcolor: '#0d1117',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: '#161b22',
        }}
      >
        <SyncIcon sx={{ fontSize: 18, color: '#3fb950', mr: 1 }} />
        <Typography sx={{ flex: 1, fontSize: '0.85rem', fontWeight: 600, color: 'text.primary' }}>
          Start Sync
        </Typography>
        <IconButton size="small" onClick={() => setShowSetupPanel(false)} sx={{ color: 'text.secondary' }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1.5 }}>
          This will create an isolated worktree and sandbox for:
        </Typography>

        <Chip
          label={featurePath}
          size="small"
          sx={{
            mb: 2,
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            bgcolor: 'rgba(63, 185, 80, 0.1)',
            color: '#3fb950',
          }}
        />

        {setupError && (
          <Typography sx={{ fontSize: '0.75rem', color: '#f85149', mb: 1.5 }}>
            {setupError}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => setShowSetupPanel(false)}
            sx={{ fontSize: '0.75rem', textTransform: 'none', color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSetup}
            disabled={settingUp}
            startIcon={settingUp ? <CircularProgress size={12} /> : <SyncIcon sx={{ fontSize: 14 }} />}
            sx={{
              fontSize: '0.75rem',
              textTransform: 'none',
              bgcolor: '#3fb950',
              '&:hover': { bgcolor: '#2ea043' },
            }}
          >
            {settingUp ? 'Setting up...' : 'Create Worktree & Deploy'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
