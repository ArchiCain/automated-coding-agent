import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import type { Ticket } from './types';
import { STATUS_COLUMNS, ROLE_COLORS, PRIORITY_COLORS } from './types';

interface TicketBoardProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelectTicket: (id: string) => void;
  onSelectAgent: (sessionId: string) => void;
}

function formatDuration(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ${min % 60}m`;
}

function TicketCard({
  ticket,
  selected,
  onSelect,
  onSelectAgent,
}: {
  ticket: Ticket;
  selected: boolean;
  onSelect: () => void;
  onSelectAgent: (sessionId: string) => void;
}) {
  return (
    <Card
      sx={{
        bgcolor: selected ? 'action.selected' : 'background.paper',
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        mb: 1,
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
            {ticket.id}
          </Typography>
          <Chip
            label={ticket.priority}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: PRIORITY_COLORS[ticket.priority] + '22',
              color: PRIORITY_COLORS[ticket.priority],
            }}
          />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, lineHeight: 1.3 }}>
          {ticket.title}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            label={ticket.assignedRole}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              bgcolor: (ROLE_COLORS[ticket.assignedRole] || '#8b949e') + '22',
              color: ROLE_COLORS[ticket.assignedRole] || '#8b949e',
            }}
          />
          {ticket.activeAgent && (
            <Chip
              label={ticket.activeAgent.name}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAgent(ticket.activeAgent!.sessionId);
              }}
              sx={{
                height: 18,
                fontSize: '0.65rem',
                bgcolor: '#3fb95022',
                color: '#3fb950',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#3fb95044' },
              }}
            />
          )}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {formatDuration(ticket.updatedAt)}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
}

export function TicketBoard({ tickets, selectedTicketId, onSelectTicket, onSelectAgent }: TicketBoardProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', flex: 1, minHeight: 0, pb: 1 }}>
      {Object.entries(STATUS_COLUMNS).map(([columnName, statuses]) => {
        const columnTickets = tickets.filter((t) => statuses.includes(t.status));
        return (
          <Box
            key={columnName}
            sx={{
              minWidth: 240,
              maxWidth: 280,
              flex: '0 0 auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 1,
                px: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
                {columnName}
              </Typography>
              <Chip
                label={columnTickets.length}
                size="small"
                sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'action.hover' }}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                bgcolor: 'background.default',
                borderRadius: 1,
                p: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {columnTickets.length === 0 ? (
                <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', textAlign: 'center', py: 2 }}>
                  No tickets
                </Typography>
              ) : (
                columnTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    selected={ticket.id === selectedTicketId}
                    onSelect={() => onSelectTicket(ticket.id)}
                    onSelectAgent={onSelectAgent}
                  />
                ))
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
