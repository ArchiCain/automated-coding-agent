import { Routes, Route } from "react-router-dom";
import { MuiThemeProvider } from "./features/mui-theme";
import { Layout } from "./features/layout";
import { OverviewPage } from "./features/overview";
import { TaskBoardPage } from "./features/task-board";
import { AgentDetailPage } from "./features/agent-detail";
import { EnvironmentMapPage } from "./features/environment-map";
import { HistoryBrowserPage } from "./features/history-browser";
import { SessionReplayPage } from "./features/session-replay";
import { MetricsPage } from "./features/metrics";

export default function App() {
  return (
    <MuiThemeProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/tasks" element={<TaskBoardPage />} />
          <Route path="/agents/:taskId" element={<AgentDetailPage />} />
          <Route path="/environments" element={<EnvironmentMapPage />} />
          <Route path="/history" element={<HistoryBrowserPage />} />
          <Route path="/history/:taskId" element={<SessionReplayPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
        </Route>
      </Routes>
    </MuiThemeProvider>
  );
}
