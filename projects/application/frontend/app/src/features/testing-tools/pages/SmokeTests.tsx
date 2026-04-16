import { Container, Box, Typography, Grid, Paper, Chip, Alert } from '@mui/material';
import { Science as ScienceIcon, Info as InfoIcon } from '@mui/icons-material';
import { BackendHealthCheck } from '@/features/testing-tools/backend-health-check';
import { TypeormDatabaseClient } from '@/features/testing-tools/typeorm-database-client';

export default function SmokeTests() {
  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ScienceIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
          <Box>
            <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom sx={{ mb: 0.5 }}>
              System Smoke Tests
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Comprehensive health checks and diagnostic tools for system validation
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }} icon={<InfoIcon />}>
          <strong>About Smoke Tests:</strong> These automated tests verify critical system functionality and can help identify issues before they impact users.
        </Alert>
      </Box>

      <Grid container spacing={3}>
        {/* System Status Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 2, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom>
                  Backend Health Status
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Real-time monitoring of backend API availability and performance
                </Typography>
              </Box>
              <Chip
                label="Auto Refresh: 30s"
                variant="outlined"
                color="primary"
                size="small"
              />
            </Box>

            <BackendHealthCheck
              autoRefresh={true}
              refreshInterval={30000}
              showTimestamp={true}
              showRefreshButton={true}
            />
          </Paper>
        </Grid>

        {/* Database Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'background.paper' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box>
                <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom>
                  Database Connectivity Test
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete CRUD operations test to verify database functionality
                </Typography>
              </Box>
              <Chip
                label="TypeORM"
                variant="outlined"
                color="secondary"
                size="small"
              />
            </Box>

            <TypeormDatabaseClient
              showDetails={true}
            />
          </Paper>
        </Grid>

        {/* Instructions Section */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, bgcolor: 'action.hover', border: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="h3" fontWeight="semibold" gutterBottom>
              How to Use Smoke Tests
            </Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="semibold" color="primary.main" gutterBottom>
                    1. Monitor Status
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Backend health checks run automatically every 30 seconds to provide real-time status updates.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="semibold" color="primary.main" gutterBottom>
                    2. Run Database Tests
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Click "Run Smoke Test" to execute comprehensive database CRUD operations and verify connectivity.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="subtitle2" fontWeight="semibold" color="primary.main" gutterBottom>
                    3. Review Results
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Check detailed test results and error messages to identify and troubleshoot any issues.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
