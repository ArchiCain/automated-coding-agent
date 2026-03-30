import { useState, useEffect, useCallback } from 'react';
import api from '@/features/api-client/api-client';
import { HealthStatus, HealthCheckState } from './types';

export function useBackendHealthCheck(autoRefresh = true, refreshInterval = 30000) {
  const [state, setState] = useState<HealthCheckState>({
    data: null,
    loading: false,
    error: null,
    lastChecked: null,
  });

  const checkHealth = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await api.get('/health');
      
      // Transform the response to our expected format
      const healthData: HealthStatus = {
        status: response.data?.status === 'ok' || response.status === 200 ? 'healthy' : 'unhealthy',
        message: response.data?.message || 'Backend is responding',
        timestamp: new Date().toISOString(),
        uptime: response.data?.uptime,
        version: response.data?.version,
      };

      setState({
        data: healthData,
        loading: false,
        error: null,
        lastChecked: new Date(),
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to connect to backend';
      
      setState({
        data: {
          status: 'unhealthy',
          message: errorMessage,
          timestamp: new Date().toISOString(),
        },
        loading: false,
        error: errorMessage,
        lastChecked: new Date(),
      });
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      checkHealth(); // Initial check
      
      const interval = setInterval(checkHealth, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [checkHealth, autoRefresh, refreshInterval]);

  return {
    ...state,
    checkHealth,
    refresh: checkHealth,
  };
}
