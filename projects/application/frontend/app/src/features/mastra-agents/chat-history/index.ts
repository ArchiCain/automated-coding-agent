// Export main component
export { MastraChatHistory } from './MastraChatHistory';

// Export provider
export { HistoryProvider, useHistoryContext } from './HistoryProvider';

// Export features
export { ConversationSidebar } from './conversation-sidebar';
export { ConversationList, ConversationItem } from './conversation-list';
export { DeleteConfirmationModal } from './delete-confirmation';

// Export types
export type {
  Conversation,
  ChatHistoryEvent
} from './types';
