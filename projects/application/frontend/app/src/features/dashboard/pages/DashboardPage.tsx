import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Paper,
  Chip,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Science as ScienceIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '@/features/keycloak-auth';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

function MetricCard({ title, value, subtitle, icon: Icon, color = 'primary', trend }: MetricCardProps) {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Icon color={color} sx={{ mr: 1, fontSize: 28 }} />
          <Typography variant="h6" component="h3">
            {title}
          </Typography>
        </Box>
        <Typography variant="h4" component="div" fontWeight="bold" color={`${color}.main`}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
        {trend && (
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
            <TrendingUpIcon
              color={trend.direction === 'up' ? 'success' : 'error'}
              sx={{ fontSize: 16, mr: 0.5, transform: trend.direction === 'down' ? 'scaleY(-1)' : 'none' }}
            />
            <Typography variant="caption" color={trend.direction === 'up' ? 'success.main' : 'error.main'}>
              {trend.value}%
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  color?: 'primary' | 'secondary';
}

function QuickActionCard({ title, description, icon: Icon, onClick, color = 'primary' }: QuickActionProps) {
  return (
    <Card sx={{
            height: '100%',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              elevation: 3,
              transform: 'translateY(-2px)',
            }
          }}
          onClick={onClick}
          elevation={1}>
      <CardContent sx={{ textAlign: 'center', py: 3 }}>
        <Icon color={color} sx={{ fontSize: 40, mb: 2 }} />
        <Typography variant="h6" component="h3" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}

interface SystemStatusProps {
  service: string;
  status: 'healthy' | 'warning' | 'error';
  lastCheck: string;
}

function SystemStatusItem({ service, status, lastCheck }: SystemStatusProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'healthy': return <CheckCircleIcon color="success" />;
      case 'warning': return <WarningIcon color="warning" />;
      case 'error': return <ErrorIcon color="error" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
    }
  };

  return (
    <ListItem>
      <ListItemAvatar>
        <Avatar sx={{ bgcolor: 'transparent' }}>
          {getStatusIcon()}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={service}
        secondary={`Last check: ${lastCheck}`}
      />
      <ListItemSecondaryAction>
        <Chip
          label={status.toUpperCase()}
          color={getStatusColor() as any}
          size="small"
          variant="outlined"
        />
      </ListItemSecondaryAction>
    </ListItem>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const userName = user?.username || user?.email || 'User';

  const handleQuickAction = (action: string) => {
    // TODO: Implement quick actions routing
    console.log(`Quick action clicked: ${action}`);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Welcome Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
          Welcome back, {userName}!
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Here's what's happening with your system today
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Metrics Row */}
        <Grid item xs={12}>
          <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom sx={{ mb: 2 }}>
            System Overview
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Users"
            value="1,234"
            subtitle="Online now"
            icon={PeopleIcon}
            color="primary"
            trend={{ value: 12, direction: 'up' }}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="System Health"
            value="99.9%"
            subtitle="Uptime this month"
            icon={CheckCircleIcon}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="API Requests"
            value="45.2K"
            subtitle="Last 24 hours"
            icon={TrendingUpIcon}
            color="secondary"
            trend={{ value: 8, direction: 'up' }}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Storage Used"
            value="67%"
            subtitle="of allocated space"
            icon={SecurityIcon}
            color="warning"
          />
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} sx={{ mt: 2 }}>
          <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom sx={{ mb: 2 }}>
            Quick Actions
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={3}>
          <QuickActionCard
            title="Run Smoke Tests"
            description="Execute system health checks"
            icon={ScienceIcon}
            onClick={() => handleQuickAction('smoke-tests')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={3}>
          <QuickActionCard
            title="Manage Users"
            description="Add, edit, or remove users"
            icon={AdminIcon}
            onClick={() => handleQuickAction('user-management')}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={3}>
          <QuickActionCard
            title="System Settings"
            description="Configure application settings"
            icon={SettingsIcon}
            onClick={() => handleQuickAction('settings')}
            color="secondary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4} lg={3}>
          <QuickActionCard
            title="View Reports"
            description="Access analytics and reports"
            icon={TrendingUpIcon}
            onClick={() => handleQuickAction('reports')}
            color="secondary"
          />
        </Grid>

        {/* System Status and Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="h3" fontWeight="semibold">
                System Status
              </Typography>
              <IconButton size="small">
                <RefreshIcon />
              </IconButton>
            </Box>
            <List>
              <SystemStatusItem
                service="Backend API"
                status="healthy"
                lastCheck="2 minutes ago"
              />
              <Divider variant="inset" component="li" />
              <SystemStatusItem
                service="Database"
                status="healthy"
                lastCheck="5 minutes ago"
              />
              <Divider variant="inset" component="li" />
              <SystemStatusItem
                service="Authentication"
                status="warning"
                lastCheck="10 minutes ago"
              />
              <Divider variant="inset" component="li" />
              <SystemStatusItem
                service="WebSocket Service"
                status="error"
                lastCheck="1 hour ago"
              />
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: 'fit-content' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" component="h3" fontWeight="semibold">
                Recent Activity
              </Typography>
              <Button variant="text" size="small">
                View All
              </Button>
            </Box>
            <List>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <PeopleIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="New user registered"
                  secondary="john.doe@example.com joined the platform"
                />
                <ListItemSecondaryAction>
                  <Typography variant="caption" color="text.secondary">
                    5 min ago
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'success.main' }}>
                    <CheckCircleIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="System backup completed"
                  secondary="Daily backup finished successfully"
                />
                <ListItemSecondaryAction>
                  <Typography variant="caption" color="text.secondary">
                    1 hour ago
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider variant="inset" component="li" />
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <WarningIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary="High memory usage detected"
                  secondary="Server memory usage reached 85%"
                />
                <ListItemSecondaryAction>
                  <Typography variant="caption" color="text.secondary">
                    2 hours ago
                  </Typography>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Notifications */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'info.light', color: 'info.contrastText' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <NotificationsIcon sx={{ mr: 2 }} />
              <Box>
                <Typography variant="h6" component="h3" fontWeight="semibold">
                  System Maintenance Scheduled
                </Typography>
                <Typography variant="body2">
                  Scheduled maintenance window: Sunday, 2:00 AM - 4:00 AM UTC.
                  Services may be temporarily unavailable.
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}