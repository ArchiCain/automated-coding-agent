import { Provider } from '@angular/core';
import { AgentsService } from './services/agents.service';
import { AgentsWebSocketService } from './services/agents-websocket.service';

export const AGENTS_PROVIDERS: Provider[] = [
  AgentsService,
  AgentsWebSocketService,
];
