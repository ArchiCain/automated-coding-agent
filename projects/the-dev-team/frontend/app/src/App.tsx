import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Box from '@mui/material/Box';
import { MuiThemeProvider } from './features/mui-theme';
import { TeamPage } from './features/team';
import { EnvironmentsOverviewPage, EnvironmentDetailPage, ApplicationDetailPage } from './features/environments';
import { ClusterPage } from './features/cluster';
import { DocsPage } from './features/docs';
import { NavBar } from './features/navigation';
import { TaskRunnerProvider, TaskRunnerDrawer } from './features/task-runner';

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
              <Route path="/" element={<TeamPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/environments" element={<EnvironmentsOverviewPage />} />
              <Route path="/env/:name" element={<EnvironmentDetailPage />} />
              <Route path="/env/:name/app/:appName" element={<ApplicationDetailPage />} />
              <Route path="/devops" element={<ClusterPage />} />
              <Route path="/docs" element={<DocsPage />} />
            </Routes>
          </Box>
          <TaskRunnerDrawer />
        </TaskRunnerProvider>
      </BrowserRouter>
    </MuiThemeProvider>
  );
}
