import React from 'react';
import { cn } from '../utils/cn';
import { HistoryProvider } from './HistoryProvider';
import { ConversationSidebar } from './conversation-sidebar';

interface MastraChatHistoryProps {
  userId: string;
  activeThreadId: string;
  onSelectConversation: (threadId: string) => void;
  onNewConversation: () => void;
  className?: string;
}

export const MastraChatHistory: React.FC<MastraChatHistoryProps> = ({
  userId,
  activeThreadId,
  onSelectConversation,
  onNewConversation,
  className,
}) => {
  const handleDeleteConversation = (threadId: string) => {
    // If we deleted the active conversation, create a new one
    if (threadId === activeThreadId) {
      onNewConversation();
    }
  };

  return (
    <HistoryProvider userId={userId}>
      <ConversationSidebar
        activeThreadId={activeThreadId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        onDeleteConversation={handleDeleteConversation}
        className={cn('h-full', className)}
      />
    </HistoryProvider>
  );
};
