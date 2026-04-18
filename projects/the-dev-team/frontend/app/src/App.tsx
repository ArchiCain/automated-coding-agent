import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { MuiThemeProvider } from './features/mui-theme';
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
            overflow: 'hidden',
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Routes>
            <Route path="/docs" element={<DocsPage />} />
            <Route path="*" element={<Navigate to="/docs" replace />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}
