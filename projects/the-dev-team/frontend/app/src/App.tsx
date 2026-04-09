import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import { MuiThemeProvider } from './features/mui-theme';
import { ChatPage } from './features/chat';
import { ClusterPage } from './features/cluster';
import { DocsPage } from './features/docs';
import { NavBar } from './features/navigation';

export default function App() {
  return (
    <MuiThemeProvider>
      <BrowserRouter>
        <NavBar />
        <Box
          sx={{
            pt: '48px',
            height: '100vh',
            overflow: 'auto',
            bgcolor: 'background.default',
          }}
        >
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/devops" element={<ClusterPage />} />
            <Route path="/docs" element={<DocsPage />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}
