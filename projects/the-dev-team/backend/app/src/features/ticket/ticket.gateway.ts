import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Server } from 'socket.io';
import { Ticket } from './ticket.types';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tickets' })
export class TicketGateway {
  @WebSocketServer()
  server: Server;

  @OnEvent('ticket.created')
  handleTicketCreated(ticket: Ticket): void {
    this.server?.emit('ticket:created', ticket);
  }

  @OnEvent('ticket.updated')
  handleTicketUpdated(ticket: Ticket): void {
    this.server?.emit('ticket:updated', ticket);
  }
}
