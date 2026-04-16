import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Tooltip from '@mui/material/Tooltip';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BuildIcon from '@mui/icons-material/Build';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import { useCluster, ServiceTable } from '../cluster';
import { MetricsPanel } from '../cluster/metrics-panel';
import { LogsPanel } from '../cluster/logs-panel';
import { EnvironmentChatPanel } from './environment-chat-panel';
import { useTaskRunnerContext } from '../task-runner';

const INFRA_NAMESPACES = ['default', 'dns', 'traefik', 'registry', 'ingress-nginx', 'monitoring'];

export function EnvironmentDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const cluster = useCluster();
  const { startTask } = useTaskRunnerContext();
  const [tab, setTab] = useState(0);

  // Filter namespaces to this environment
  const envNamespaces = cluster.namespaces.filter((ns) => {
    if (INFRA_NAMESPACES.includes(ns.namespace)) return false;
    if (name === 'main') return ns.namespace === 'app';
    if (name === 'platform') return ns.namespace === 'the-dev-team';
    return ns.namespace === `env-${name}`;
  });

  const isSandbox = name !== 'main' && name !== 'platform';
  const defaultRole = name === 'platform' ? 'default' : 'default'; // Will be 'devops' when role exists

  const handleAction = (taskName: string, vars?: Record<string, string>) => {
    void startTask(taskName, vars);
  };

  const handleServiceClick = (_namespace: string, serviceName: string) => {
    navigate(`/env/${name}/app/${serviceName}`);
  };

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {/* Breadcrumb */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            underline="hover"
            color="text.secondary"
            sx={{ cursor: 'pointer', fontSize: '0.85rem' }}
            onClick={() => navigate('/')}
          >
            Environments
          </Link>
          <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            {name}
          </Typography>
        </Breadcrumbs>

        {/* Actions bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {name === 'main' ? 'Main Environment' : name === 'platform' ? 'THE Dev Team' : `Sandbox: ${name}`}
          </Typography>

          <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
            {name === 'main' && (
              <ButtonGroup size="small" variant="outlined">
                <Tooltip title="Deploy all services">
                  <Button
                    startIcon={<RocketLaunchIcon />}
                    onClick={() => handleAction('deploy:apply')}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Deploy
                  </Button>
                </Tooltip>
                <Tooltip title="Build all images">
                  <Button
                    startIcon={<BuildIcon />}
                    onClick={() => handleAction('build:all')}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Build
                  </Button>
                </Tooltip>
                <Tooltip title="Show deployment status">
                  <Button
                    startIcon={<InfoIcon />}
                    onClick={() => handleAction('deploy:status')}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Status
                  </Button>
                </Tooltip>
                <Tooltip title="Full reset and redeploy">
                  <Button
                    startIcon={<RestartAltIcon />}
                    onClick={() => handleAction('reset:up')}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                    color="warning"
                  >
                    Reset
                  </Button>
                </Tooltip>
              </ButtonGroup>
            )}

            {isSandbox && (
              <ButtonGroup size="small" variant="outlined">
                <Tooltip title="Deploy sandbox">
                  <Button
                    startIcon={<RocketLaunchIcon />}
                    onClick={() => handleAction('env:deploy', { NAME: name! })}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Deploy
                  </Button>
                </Tooltip>
                <Tooltip title="Check sandbox health">
                  <Button
                    startIcon={<InfoIcon />}
                    onClick={() => handleAction('env:health', { TASK_ID: name! })}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Health
                  </Button>
                </Tooltip>
                <Tooltip title="Destroy sandbox">
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleAction('env:destroy', { TASK_ID: name! })}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                    color="error"
                  >
                    Destroy
                  </Button>
                </Tooltip>
              </ButtonGroup>
            )}
          </Box>
        </Box>

        {/* Tabs */}
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
          <Tab label="Services" />
          <Tab label="Metrics" />
          <Tab label="Logs" />
        </Tabs>

        {tab === 0 && (
          <ServiceTable
            namespaces={envNamespaces}
            loading={cluster.loading}
            error={cluster.error}
            lastUpdated={cluster.lastUpdated}
            refresh={cluster.refresh}
            showInfra={false}
            onServiceClick={handleServiceClick}
          />
        )}
        {tab === 1 && <MetricsPanel />}
        {tab === 2 && <LogsPanel />}
      </Box>

      {/* Chat panel */}
      <EnvironmentChatPanel defaultRole={defaultRole} />
    </Box>
  );
}
