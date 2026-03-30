export interface Conversation {
  threadId: string;
  title: string;
  updatedAt: Date;
}

export interface ChatHistoryEvent {
  conversations: Conversation[];
  type: 'initial' | 'update';
}
