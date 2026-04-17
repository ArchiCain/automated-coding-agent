import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import GroupIcon from '@mui/icons-material/Group';
import { useTickets } from './use-tickets';
import { AgentRoster } from './agent-roster';
import { TicketBoard } from './ticket-board';
import { TicketDetail } from './ticket-detail';
import { AgentDetail } from './agent-detail';
import { ChatBubble } from './chat-bubble';

export function TeamPage() {
  const {
    tickets,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    selectedAgentSessionId,
    setSelectedAgentSessionId,
    activeAgents,
    stopTicket,
    fetchHandoffs,
  } = useTickets();

  // Find the agent info for the selected session
  const selectedAgent = useMemo(() => {
    if (!selectedAgentSessionId) return null;
    for (const t of tickets) {
      if (t.activeAgent?.sessionId === selectedAgentSessionId) {
        return { ...t.activeAgent, ticketId: t.id, ticketTitle: t.title };
      }
    }
    return null;
  }, [selectedAgentSessionId, tickets]);

  const showDetailPanel = !!(selectedTicket || selectedAgent);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Main content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          p: 2,
          minWidth: 0,
        }}
      >
        {/* Agent Roster */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GroupIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              Active Agents
            </Typography>
            {activeAgents.length > 0 && (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                ({activeAgents.length})
              </Typography>
            )}
          </Box>
          <AgentRoster
            agents={activeAgents}
            selectedSessionId={selectedAgentSessionId}
            onSelect={(sessionId) => {
              setSelectedAgentSessionId(sessionId);
              setSelectedTicketId(null);
            }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Ticket Board */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
            Tickets
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.disabled' }}>
            ({tickets.length})
          </Typography>
        </Box>
        <TicketBoard
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelectTicket={(id) => {
            setSelectedTicketId(id);
            setSelectedAgentSessionId(null);
          }}
          onSelectAgent={(sessionId) => {
            setSelectedAgentSessionId(sessionId);
            setSelectedTicketId(null);
          }}
        />
      </Box>

      {/* Side panel — ticket or agent detail */}
      {showDetailPanel && (
        <Box
          sx={{
            width: 380,
            flexShrink: 0,
            borderLeft: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {selectedAgent ? (
            <AgentDetail
              sessionId={selectedAgent.sessionId}
              agentName={selectedAgent.name}
              agentRole={selectedAgent.role}
              ticketId={selectedAgent.ticketId}
              onClose={() => setSelectedAgentSessionId(null)}
              onStop={() => {
                const agent = selectedAgent;
                if (agent) {
                  stopTicket(agent.ticketId);
                  setSelectedAgentSessionId(null);
                }
              }}
            />
          ) : selectedTicket ? (
            <TicketDetail
              ticket={selectedTicket}
              onClose={() => setSelectedTicketId(null)}
              onStop={() => {
                stopTicket(selectedTicket.id);
              }}
              onSelectAgent={(sessionId) => {
                setSelectedAgentSessionId(sessionId);
                setSelectedTicketId(null);
              }}
              fetchHandoffs={fetchHandoffs}
            />
          ) : null}
        </Box>
      )}

      {/* Floating chat bubble — talk to any agent */}
      <ChatBubble />
    </Box>
  );
}
