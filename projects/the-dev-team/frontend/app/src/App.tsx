import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MuiThemeProvider } from './features/mui-theme';
import { ChatPage } from './features/chat';
import { ClusterPage } from './features/cluster';
import { NavBar } from './features/navigation';

export default function App() {
  return (
    <MuiThemeProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/cluster" element={<ClusterPage />} />
        </Routes>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}
