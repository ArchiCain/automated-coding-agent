import ChatIcon from '@mui/icons-material/Chat';
import { AgentChatBubble } from './agent-chat-bubble';

interface DocsChatBubbleProps {
  activePath?: string | null;
  onDocChanged?: () => void;
}

export function DocsChatBubble({ activePath, onDocChanged }: DocsChatBubbleProps) {
  return (
    <AgentChatBubble
      agentName="docs-assistant"
      title="Docs Assistant"
      icon={<ChatIcon sx={{ fontSize: 18 }} />}
      accentColor="#58a6ff"
      fabPosition={24}
      activePath={activePath}
      onDocChanged={onDocChanged}
    />
  );
}
