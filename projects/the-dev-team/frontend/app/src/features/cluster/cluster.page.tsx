import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { useCluster } from './use-cluster';
import { ServiceTable } from './service-table';
import { MetricsPanel } from './metrics-panel';
import { LogsPanel } from './logs-panel';

export function ClusterPage() {
  const cluster = useCluster();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        DevOps
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem' },
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Tab label="Deployments" />
        <Tab label="Metrics" />
        <Tab label="Log Search" />
      </Tabs>

      {tab === 0 && <ServiceTable {...cluster} />}
      {tab === 1 && <MetricsPanel />}
      {tab === 2 && <LogsPanel />}
    </Box>
  );
}
