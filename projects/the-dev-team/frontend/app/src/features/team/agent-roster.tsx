import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import PersonIcon from '@mui/icons-material/Person';
import { ROLE_COLORS } from './types';

interface ActiveAgent {
  sessionId: string;
  name: string;
  role: string;
  phase: string;
  startedAt: string;
  ticketId: string;
  ticketTitle: string;
}

interface AgentRosterProps {
  agents: ActiveAgent[];
  selectedSessionId: string | null;
  onSelect: (sessionId: string) => void;
}

function formatDuration(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ${min % 60}m`;
}

export function AgentRoster({ agents, selectedSessionId, onSelect }: AgentRosterProps) {
  if (agents.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled' }}>
          No agents active — create tickets to spawn agents
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
      {agents.map((agent) => {
        const roleColor = ROLE_COLORS[agent.role] || '#8b949e';
        const selected = agent.sessionId === selectedSessionId;
        return (
          <Card
            key={agent.sessionId}
            sx={{
              minWidth: 180,
              maxWidth: 220,
              flex: '0 0 auto',
              bgcolor: selected ? 'action.selected' : 'background.paper',
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
            }}
          >
            <CardActionArea onClick={() => onSelect(agent.sessionId)} sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: '#3fb950',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 1 },
                      '50%': { opacity: 0.4 },
                    },
                  }}
                />
                <PersonIcon sx={{ fontSize: 16, color: roleColor }} />
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {agent.name}
                </Typography>
              </Box>
              <Chip
                label={agent.role}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  mb: 0.5,
                  bgcolor: roleColor + '22',
                  color: roleColor,
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  mt: 0.5,
                }}
              >
                {agent.ticketId}: {agent.ticketTitle}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {agent.phase}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {formatDuration(agent.startedAt)}
                </Typography>
              </Box>
            </CardActionArea>
          </Card>
        );
      })}
    </Box>
  );
}
