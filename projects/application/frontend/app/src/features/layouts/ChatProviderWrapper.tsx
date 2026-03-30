import { useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatProvider } from '@/features/mastra-agents';
import { useAuth } from '@/features/keycloak-auth';
import { MastraChatService } from '@/features/mastra-agents/chat/chat.service';

/**
 * Conditional ChatProvider that wraps layout
 * Provides chat context only when on chat page (/)
 */
export function ChatProviderWrapper({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [threadId, setThreadId] = useState<string>('');

  const isChatPage = location.pathname === '/';

  // Initialize thread ID when on chat page
  useEffect(() => {
    if (!isChatPage) return;

    const storedThreadId = sessionStorage.getItem('currentThreadId');
    if (storedThreadId) {
      setThreadId(storedThreadId);
    } else {
      const newThreadId = MastraChatService.generateThreadId();
      sessionStorage.setItem('currentThreadId', newThreadId);
      setThreadId(newThreadId);
    }
  }, [isChatPage]);

  const handleThreadChange = (newThreadId: string) => {
    setThreadId(newThreadId);
    sessionStorage.setItem('currentThreadId', newThreadId);
  };

  // Only provide chat context on chat page
  if (isChatPage && user && threadId) {
    return (
      <ChatProvider
        value={{
          userId: user.id,
          threadId,
          onThreadChange: handleThreadChange,
        }}
      >
        {children}
      </ChatProvider>
    );
  }

  // On non-chat pages, render without context
  return <>{children}</>;
}
