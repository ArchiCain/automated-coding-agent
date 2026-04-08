import { MuiThemeProvider } from './features/mui-theme';
import { ChatPage } from './features/chat';

export default function App() {
  return (
    <MuiThemeProvider>
      <ChatPage />
    </MuiThemeProvider>
  );
}
