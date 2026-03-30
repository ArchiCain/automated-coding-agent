import { Routes } from '@angular/router';

export const BRAINSTORM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/brainstorm-list/brainstorm-list').then(
        (m) => m.BrainstormListComponent,
      ),
    title: 'Brainstorm',
    data: {
      chatbotScope: {
        scopeKey: 'brainstorm',
        scopeLabel: 'Brainstorming Assistant',
        instructionsFile: '.agent-prompts/brainstorming.md',
        knowledgeFiles: [],
      },
    },
  },
  {
    path: ':planId',
    loadComponent: () =>
      import('./pages/brainstorm-session/brainstorm-session').then(
        (m) => m.BrainstormSessionComponent,
      ),
    title: 'Brainstorm Session',
    data: {
      chatbotScope: {
        scopeKey: 'brainstorm-session',
        scopeLabel: 'Brainstorming Assistant',
        instructionsFile: '.agent-prompts/brainstorming.md',
        knowledgeFiles: [],
      },
    },
  },
];
