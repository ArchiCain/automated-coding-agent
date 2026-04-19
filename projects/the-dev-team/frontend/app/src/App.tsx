import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import { MuiThemeProvider } from './features/mui-theme';
import { DocsPage } from './features/docs';
import {
  EnvironmentsOverviewPage,
  EnvironmentDetailPage,
  ApplicationDetailPage,
} from './features/environments';
import { NavBar } from './features/navigation';
import { TaskRunnerProvider } from './features/task-runner';

export default function App() {
  return (
    <MuiThemeProvider>
      <BrowserRouter>
        <TaskRunnerProvider>
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
            <Route path="/environments" element={<EnvironmentsOverviewPage />} />
            <Route path="/env/:name" element={<EnvironmentDetailPage />} />
            <Route path="/env/:name/app/:appName" element={<ApplicationDetailPage />} />
            <Route path="*" element={<Navigate to="/docs" replace />} />
          </Routes>
        </Box>
      </TaskRunnerProvider>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}
