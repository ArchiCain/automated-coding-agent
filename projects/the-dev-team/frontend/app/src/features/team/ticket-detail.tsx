import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import StopIcon from '@mui/icons-material/Stop';
import type { Ticket, HandoffNote } from './types';
import { ROLE_COLORS, PRIORITY_COLORS } from './types';

interface TicketDetailProps {
  ticket: Ticket;
  onClose: () => void;
  onStop: () => void;
  onSelectAgent: (sessionId: string) => void;
  fetchHandoffs: (ticketId: string) => Promise<HandoffNote[]>;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function TicketDetail({ ticket, onClose, onStop, onSelectAgent, fetchHandoffs }: TicketDetailProps) {
  const [handoffs, setHandoffs] = useState<HandoffNote[]>([]);

  useEffect(() => {
    fetchHandoffs(ticket.id).then(setHandoffs).catch(() => {});
  }, [ticket.id, fetchHandoffs]);

  const roleColor = ROLE_COLORS[ticket.assignedRole] || '#8b949e';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
              {ticket.id}
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 700 }}>
              {ticket.title}
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Chip label={ticket.status} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
          <Chip
            label={ticket.assignedRole}
            size="small"
            sx={{ height: 20, fontSize: '0.7rem', bgcolor: roleColor + '22', color: roleColor }}
          />
          <Chip
            label={ticket.priority}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.7rem',
              bgcolor: PRIORITY_COLORS[ticket.priority] + '22',
              color: PRIORITY_COLORS[ticket.priority],
            }}
          />
        </Box>
        {ticket.activeAgent && ticket.status !== 'stopped_manually' && (
          <Box sx={{ mt: 1 }}>
            <Button
              size="small"
              color="error"
              startIcon={<StopIcon />}
              onClick={onStop}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Stop Agent
            </Button>
          </Box>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {/* Workspace info */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
          Workspace
        </Typography>
        <Box sx={{ mb: 2, mt: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
          {ticket.branch && <div>Branch: <code>{ticket.branch}</code></div>}
          {ticket.worktreePath && <div>Worktree: <code>{ticket.worktreePath}</code></div>}
          {ticket.sandboxNamespace && <div>Sandbox: {ticket.sandboxNamespace}</div>}
          {ticket.prNumber && <div>PR: #{ticket.prNumber}</div>}
          <div>Target: {ticket.targetBranch}</div>
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Active agent */}
        {ticket.activeAgent && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Active Agent
            </Typography>
            <Box
              sx={{
                mt: 0.5,
                mb: 2,
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
              onClick={() => onSelectAgent(ticket.activeAgent!.sessionId)}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {ticket.activeAgent.name} ({ticket.activeAgent.role})
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Phase: {ticket.activeAgent.phase} — click to view stream
              </Typography>
            </Box>
          </>
        )}

        {/* Agent history */}
        {ticket.agentHistory.length > 0 && (
          <>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Agent History
            </Typography>
            <Box sx={{ mt: 0.5, mb: 2 }}>
              {ticket.agentHistory.map((agent, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.25 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled', minWidth: 40 }}>
                    {formatTime(agent.startedAt)}
                  </Typography>
                  <Typography variant="caption">
                    {agent.name} ({agent.role}) — {agent.phase}
                  </Typography>
                  <Chip
                    label={agent.exitReason || 'unknown'}
                    size="small"
                    sx={{
                      height: 16,
                      fontSize: '0.6rem',
                      bgcolor: agent.exitReason === 'completed' ? '#3fb95022' : '#f8514922',
                      color: agent.exitReason === 'completed' ? '#3fb950' : '#f85149',
                    }}
                  />
                </Box>
              ))}
            </Box>
          </>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Timeline */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
          Timeline
        </Typography>
        <Box sx={{ mt: 0.5, mb: 2 }}>
          {ticket.history.map((event, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.25 }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.disabled', minWidth: 40 }}>
                {formatTime(event.at)}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {event.status}
              </Typography>
              {event.detail && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  — {event.detail}
                </Typography>
              )}
            </Box>
          ))}
        </Box>

        {/* Handoff notes */}
        {handoffs.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
              Handoff Notes
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {handoffs.map((note) => (
                <Box key={note.filename} sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {note.filename}
                  </Typography>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1,
                      bgcolor: 'background.default',
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                      fontSize: '0.75rem',
                      whiteSpace: 'pre-wrap',
                      color: 'text.secondary',
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    {note.content}
                  </Box>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
