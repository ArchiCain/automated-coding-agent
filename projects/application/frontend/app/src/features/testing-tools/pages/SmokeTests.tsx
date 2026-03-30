import { Container, Box, Typography } from '@mui/material';
import { BackendHealthCheck } from '@/features/testing-tools/backend-health-check';
import { TypeormDatabaseClient } from '@/features/testing-tools/typeorm-database-client';

export default function SmokeTests() {
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ maxWidth: 896, mx: 'auto' }}>
        <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
          Smoke Tests
        </Typography>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom>
            System Status
          </Typography>
          <BackendHealthCheck
            autoRefresh={true}
            refreshInterval={30000}
            showTimestamp={true}
            showRefreshButton={true}
          />
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" component="h2" fontWeight="semibold" gutterBottom>
            Database Connectivity Test
          </Typography>
          <TypeormDatabaseClient
            showDetails={true}
          />
        </Box>
      </Box>
    </Container>
  );
}
