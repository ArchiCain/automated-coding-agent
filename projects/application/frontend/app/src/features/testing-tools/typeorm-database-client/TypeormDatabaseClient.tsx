import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useTypeormDatabaseClient } from './useTypeormDatabaseClient';
import { TestStep } from './types';

interface TypeormDatabaseClientProps {
  showDetails?: boolean;
}

export function TypeormDatabaseClient({
  showDetails = true
}: TypeormDatabaseClientProps) {
  const {
    isRunning,
    result,
    currentStep,
    error,
    lastRun,
    createdRecords,
    updatedRecord,
    deletedRecord,
    runSmokeTest
  } = useTypeormDatabaseClient();

  const getStepStatusIcon = (step: TestStep) => {
    switch (step.status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'running':
        return '⏳';
      default:
        return '⏸️';
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getOverallStatus = () => {
    if (isRunning) return { status: 'running', icon: '⏳' };
    if (error) return { status: 'error', icon: '❌' };
    if (result?.success) return { status: 'success', icon: '✅' };
    return { status: 'ready', icon: '🧪' };
  };

  const overallStatus = getOverallStatus();

  return (
    <Card
      elevation={1}
      sx={{
        bgcolor: 'background.paper',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          boxShadow: 2,
        },
      }}
    >
      <CardContent>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h5">{overallStatus.icon}</Typography>
            <Box>
              <Typography variant="subtitle1" fontWeight="bold">
                TypeORM Database Smoke Test
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                {isRunning
                  ? `Running... (Step ${currentStep + 1}/${result?.totalSteps || 8})`
                  : result?.success
                    ? `✅ All tests passed in ${formatDuration(result.duration)}`
                    : error
                      ? `❌ Test failed: ${error}`
                      : 'Ready to run comprehensive CRUD tests'
                }
              </Typography>
            </Box>
          </Box>

          <Button
            onClick={runSmokeTest}
            disabled={isRunning}
            variant="outlined"
            size="small"
          >
            {isRunning ? 'Running Tests...' : 'Run Smoke Test'}
          </Button>
        </Box>

        {/* Test Results Summary */}
        {result && (
          <Box
            sx={{
              mb: 2,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Typography variant="body2">Total Steps: {result.totalSteps}</Typography>
                <Typography variant="body2" color="success.main">
                  ✅ Passed: {result.completedSteps}
                </Typography>
                {result.failedSteps > 0 && (
                  <Typography variant="body2" color="error.main">
                    ❌ Failed: {result.failedSteps}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2">Duration: {formatDuration(result.duration)}</Typography>
            </Box>
          </Box>
        )}

        {/* Test Steps */}
        {result && showDetails && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium" color="text.secondary" sx={{ mb: 1 }}>
              Test Steps:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {result.steps.map((step, index) => {
                const isCurrentStep = isRunning && index === currentStep;
                return (
                  <Box
                    key={index}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      border: 1,
                      borderColor: isCurrentStep ? 'primary.main' : 'divider',
                      bgcolor: isCurrentStep ? 'action.hover' : 'background.paper',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{getStepStatusIcon(step)}</span>
                        <Typography variant="body2" fontWeight="medium">
                          {step.name}
                        </Typography>
                      </Box>
                      {step.duration && (
                        <Chip
                          label={formatDuration(step.duration)}
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ ml: 3, mt: 0.5, opacity: 0.8 }}>
                      {step.message}
                    </Typography>
                    {step.details && step.status === 'success' && (
                      <Box sx={{ ml: 3, mt: 1 }}>
                        <details style={{ cursor: 'pointer' }}>
                          <summary><Typography variant="caption">Details</Typography></summary>
                          <Box
                            component="pre"
                            sx={{
                              mt: 1,
                              fontSize: '0.75rem',
                              bgcolor: 'action.hover',
                              p: 1,
                              borderRadius: 1,
                              overflow: 'auto',
                            }}
                          >
                            {JSON.stringify(step.details, null, 2)}
                          </Box>
                        </details>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Test Data Summary */}
        {(createdRecords.length > 0 || updatedRecord || deletedRecord) && showDetails && (
          <Box
            sx={{
              mt: 2,
              p: 2,
              bgcolor: 'background.paper',
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" fontWeight="medium" color="text.secondary" sx={{ mb: 1 }}>
              Test Data Summary:
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {createdRecords.length > 0 && (
                <Box>
                  <Typography variant="body2">
                    <strong>Created Records:</strong> {createdRecords.length}
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 2, opacity: 0.7, display: 'block', mt: 0.5 }}>
                    IDs: {createdRecords.map(r => r.id.substring(0, 8)).join(', ')}...
                  </Typography>
                </Box>
              )}
              {updatedRecord && (
                <Box>
                  <Typography variant="body2">
                    <strong>Updated Record:</strong> {updatedRecord.id.substring(0, 8)}...
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 2, opacity: 0.7, display: 'block', mt: 0.5 }}>
                    Description: "{updatedRecord.description}"
                  </Typography>
                </Box>
              )}
              {deletedRecord && (
                <Box>
                  <Typography variant="body2">
                    <strong>Deleted Record:</strong> {deletedRecord.id.substring(0, 8)}...
                  </Typography>
                  <Typography variant="caption" sx={{ ml: 2, opacity: 0.7, display: 'block', mt: 0.5 }}>
                    Name: "{deletedRecord.name}"
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Last Run Timestamp */}
        {lastRun && (
          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.6 }}>
            Last run: {formatTimestamp(lastRun)}
          </Typography>
        )}

        {/* Error Details */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <strong>Error:</strong> {error}
          </Alert>
        )}

        {/* Loading Indicator */}
        {isRunning && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="info.main">
              Running comprehensive CRUD tests...
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
