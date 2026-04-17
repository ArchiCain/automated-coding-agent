import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Ticket, HandoffNote } from './types';

export function useTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedAgentSessionId, setSelectedAgentSessionId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Load tickets on mount
  useEffect(() => {
    fetch('/api/tickets')
      .then((res) => res.json())
      .then((data: Ticket[]) => setTickets(data))
      .catch(() => {});
  }, []);

  // Connect to /tickets WebSocket namespace
  useEffect(() => {
    const socket = io('/tickets', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('ticket:created', (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev]);
    });

    socket.on('ticket:updated', (ticket: Ticket) => {
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? ticket : t)));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const stopTicket = useCallback(async (ticketId: string) => {
    await fetch(`/api/tickets/${ticketId}/stop`, { method: 'POST' });
  }, []);

  const createTicket = useCallback(async (dto: Partial<Ticket>) => {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return res.json();
  }, []);

  const fetchHandoffs = useCallback(async (ticketId: string): Promise<HandoffNote[]> => {
    const res = await fetch(`/api/tickets/${ticketId}/handoffs`);
    return res.json();
  }, []);

  // Derived state
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) ?? null;
  const activeAgents = tickets
    .filter((t) => t.activeAgent !== null)
    .map((t) => ({ ...t.activeAgent!, ticketId: t.id, ticketTitle: t.title }));

  return {
    tickets,
    selectedTicketId,
    setSelectedTicketId,
    selectedTicket,
    selectedAgentSessionId,
    setSelectedAgentSessionId,
    activeAgents,
    stopTicket,
    createTicket,
    fetchHandoffs,
  };
}
