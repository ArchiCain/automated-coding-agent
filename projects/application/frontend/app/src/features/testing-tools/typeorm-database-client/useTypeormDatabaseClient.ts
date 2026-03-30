import { useState, useCallback } from 'react';
import api from '@/features/api-client/api-client';
import { 
  ExampleEntity, 
  CreateExampleDto, 
  UpdateExampleDto, 
  TestState, 
  TestStep
} from './types';

const DEFAULT_TEST_STEPS: TestStep[] = [
  { name: 'Initial Data Load', status: 'pending', message: 'Loading existing records from database' },
  { name: 'Create Test Records', status: 'pending', message: 'Creating 5 test records' },
  { name: 'Verify Created Records', status: 'pending', message: 'Verifying all records were created successfully' },
  { name: 'Update Test Record', status: 'pending', message: 'Updating one test record' },
  { name: 'Verify Updated Record', status: 'pending', message: 'Verifying record was updated correctly' },
  { name: 'Delete Test Record', status: 'pending', message: 'Soft deleting one test record' },
  { name: 'Verify Deleted Record', status: 'pending', message: 'Verifying record was soft deleted' },
  { name: 'Cleanup Test Data', status: 'pending', message: 'Cleaning up remaining test records' },
];

export function useTypeormDatabaseClient() {
  const [state, setState] = useState<TestState>({
    isRunning: false,
    result: null,
    currentStep: 0,
    error: null,
    lastRun: null,
    createdRecords: [],
    updatedRecord: null,
    deletedRecord: null,
  });

  // Helper function to update a specific test step
  const updateStep = useCallback((stepIndex: number, updates: Partial<TestStep>) => {
    setState(prev => ({
      ...prev,
      result: prev.result ? {
        ...prev.result,
        steps: prev.result.steps.map((step, index) => 
          index === stepIndex ? { ...step, ...updates } : step
        )
      } : null
    }));
  }, []);

  // API functions
  const getAllExamples = async (): Promise<ExampleEntity[]> => {
    const response = await api.get('/examples');
    return response.data;
  };

  const createExample = async (data: CreateExampleDto): Promise<ExampleEntity> => {
    const response = await api.post('/examples', data);
    return response.data;
  };

  const updateExample = async (id: string, data: UpdateExampleDto): Promise<ExampleEntity> => {
    const response = await api.put(`/examples/${id}`, data);
    return response.data;
  };

  const deleteExample = async (id: string): Promise<void> => {
    await api.delete(`/examples/${id}`);
  };

  const getExampleById = async (id: string): Promise<ExampleEntity> => {
    const response = await api.get(`/examples/${id}`);
    return response.data;
  };

  const getExampleCount = async (): Promise<number> => {
    const response = await api.get('/examples/meta/count');
    return response.data.count;
  };

  // Main test runner
  const runSmokeTest = useCallback(async () => {
    const startTime = Date.now();
    let createdRecords: ExampleEntity[] = [];
    let updatedRecord: ExampleEntity | null = null;
    let deletedRecord: ExampleEntity | null = null;

    setState(prev => ({
      ...prev,
      isRunning: true,
      currentStep: 0,
      error: null,
      result: {
        success: false,
        totalSteps: DEFAULT_TEST_STEPS.length,
        completedSteps: 0,
        failedSteps: 0,
        duration: 0,
        steps: [...DEFAULT_TEST_STEPS]
      },
      createdRecords: [],
      updatedRecord: null,
      deletedRecord: null,
    }));

    try {
      // Step 1: Initial Data Load
      setState(prev => ({ ...prev, currentStep: 0 }));
      updateStep(0, { status: 'running', message: 'Loading existing records...' });
      
      const stepStart = Date.now();
      const initialRecords = await getAllExamples();
      const stepDuration = Date.now() - stepStart;
      
      updateStep(0, { 
        status: 'success', 
        message: `Found ${initialRecords.length} existing records`,
        duration: stepDuration,
        details: { count: initialRecords.length }
      });

      // Step 2: Create Test Records
      setState(prev => ({ ...prev, currentStep: 1 }));
      updateStep(1, { status: 'running', message: 'Creating 5 test records...' });
      
      const createStart = Date.now();
      const testRecords: CreateExampleDto[] = [
        { 
          name: `Test Record 1 - ${Date.now()}`, 
          description: 'First smoke test record',
          metadata: { testRun: Date.now(), type: 'smoke-test', index: 1 }
        },
        { 
          name: `Test Record 2 - ${Date.now()}`, 
          description: 'Second smoke test record',
          metadata: { testRun: Date.now(), type: 'smoke-test', index: 2 }
        },
        { 
          name: `Test Record 3 - ${Date.now()}`, 
          description: 'Third smoke test record',
          metadata: { testRun: Date.now(), type: 'smoke-test', index: 3 }
        },
        { 
          name: `Test Record 4 - ${Date.now()}`, 
          description: 'Fourth smoke test record',
          metadata: { testRun: Date.now(), type: 'smoke-test', index: 4 }
        },
        { 
          name: `Test Record 5 - ${Date.now()}`, 
          description: 'Fifth smoke test record',
          metadata: { testRun: Date.now(), type: 'smoke-test', index: 5 }
        },
      ];

      for (let i = 0; i < testRecords.length; i++) {
        const record = await createExample(testRecords[i]);
        createdRecords.push(record);
        updateStep(1, { 
          message: `Creating test records... (${i + 1}/5)`,
        });
      }

      const createDuration = Date.now() - createStart;
      updateStep(1, { 
        status: 'success', 
        message: `Successfully created ${createdRecords.length} test records`,
        duration: createDuration,
        details: { createdIds: createdRecords.map(r => r.id) }
      });

      setState(prev => ({
        ...prev,
        createdRecords
      }));

      // Step 3: Verify Created Records
      setState(prev => ({ ...prev, currentStep: 2 }));
      updateStep(2, { status: 'running', message: 'Verifying created records...' });
      
      const verifyStart = Date.now();
      const allRecordsAfterCreate = await getAllExamples();
      const verifyDuration = Date.now() - verifyStart;
      
      const expectedCount = initialRecords.length + 5;
      if (allRecordsAfterCreate.length >= expectedCount) {
        updateStep(2, { 
          status: 'success', 
          message: `Verification successful: ${allRecordsAfterCreate.length} total records found`,
          duration: verifyDuration,
          details: { expected: expectedCount, actual: allRecordsAfterCreate.length }
        });
      } else {
        throw new Error(`Expected at least ${expectedCount} records, but found ${allRecordsAfterCreate.length}`);
      }

      // Step 4: Update Test Record
      setState(prev => ({ ...prev, currentStep: 3 }));
      updateStep(3, { status: 'running', message: 'Updating a test record...' });
      
      const updateStart = Date.now();
      const recordToUpdate = createdRecords[0];
      const updateData: UpdateExampleDto = {
        description: `Updated description - ${Date.now()}`,
        metadata: { 
          ...recordToUpdate.metadata, 
          updated: true, 
          updateTime: Date.now() 
        }
      };
      
      updatedRecord = await updateExample(recordToUpdate.id, updateData);
      const updateDuration = Date.now() - updateStart;
      
      updateStep(3, { 
        status: 'success', 
        message: `Successfully updated record ${recordToUpdate.id}`,
        duration: updateDuration,
        details: { recordId: recordToUpdate.id, changes: updateData }
      });

      setState(prev => ({
        ...prev,
        updatedRecord
      }));

      // Step 5: Verify Updated Record
      setState(prev => ({ ...prev, currentStep: 4 }));
      updateStep(4, { status: 'running', message: 'Verifying updated record...' });
      
      const verifyUpdateStart = Date.now();
      const fetchedUpdatedRecord = await getExampleById(recordToUpdate.id);
      const verifyUpdateDuration = Date.now() - verifyUpdateStart;
      
      if (fetchedUpdatedRecord.description === updateData.description) {
        updateStep(4, { 
          status: 'success', 
          message: 'Update verification successful',
          duration: verifyUpdateDuration,
          details: { 
            recordId: fetchedUpdatedRecord.id,
            oldDescription: recordToUpdate.description,
            newDescription: fetchedUpdatedRecord.description
          }
        });
      } else {
        throw new Error('Updated record does not match expected values');
      }

      // Step 6: Delete Test Record
      setState(prev => ({ ...prev, currentStep: 5 }));
      updateStep(5, { status: 'running', message: 'Soft deleting a test record...' });
      
      const deleteStart = Date.now();
      const recordToDelete = createdRecords[1];
      await deleteExample(recordToDelete.id);
      deletedRecord = recordToDelete;
      const deleteDuration = Date.now() - deleteStart;
      
      updateStep(5, { 
        status: 'success', 
        message: `Successfully deleted record ${recordToDelete.id}`,
        duration: deleteDuration,
        details: { recordId: recordToDelete.id }
      });

      setState(prev => ({
        ...prev,
        deletedRecord
      }));

      // Step 7: Verify Deleted Record
      setState(prev => ({ ...prev, currentStep: 6 }));
      updateStep(6, { status: 'running', message: 'Verifying soft delete...' });
      
      const verifyDeleteStart = Date.now();
      try {
        await getExampleById(recordToDelete.id);
        throw new Error('Deleted record should not be accessible');
      } catch (error: any) {
        if (error.response?.status === 404 || error.message.includes('not found')) {
          const verifyDeleteDuration = Date.now() - verifyDeleteStart;
          updateStep(6, { 
            status: 'success', 
            message: 'Soft delete verification successful - record is no longer accessible',
            duration: verifyDeleteDuration,
            details: { recordId: recordToDelete.id }
          });
        } else {
          throw error;
        }
      }

      // Step 8: Cleanup Test Data
      setState(prev => ({ ...prev, currentStep: 7 }));
      updateStep(7, { status: 'running', message: 'Cleaning up remaining test records...' });
      
      const cleanupStart = Date.now();
      const recordsToCleanup = createdRecords.filter(r => r.id !== recordToDelete.id);
      
      for (let i = 0; i < recordsToCleanup.length; i++) {
        await deleteExample(recordsToCleanup[i].id);
        updateStep(7, { 
          message: `Cleaning up test records... (${i + 1}/${recordsToCleanup.length})`,
        });
      }
      
      const cleanupDuration = Date.now() - cleanupStart;
      updateStep(7, { 
        status: 'success', 
        message: `Successfully cleaned up ${recordsToCleanup.length} test records`,
        duration: cleanupDuration,
        details: { cleanedUpIds: recordsToCleanup.map(r => r.id) }
      });

      // Test completed successfully
      const totalDuration = Date.now() - startTime;
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        lastRun: new Date(),
        result: prev.result ? {
          ...prev.result,
          success: true,
          completedSteps: DEFAULT_TEST_STEPS.length,
          failedSteps: 0,
          duration: totalDuration
        } : null
      }));

    } catch (error: any) {
      const totalDuration = Date.now() - startTime;
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error occurred';
      
      // Mark current step as failed
      if (state.currentStep < DEFAULT_TEST_STEPS.length) {
        updateStep(state.currentStep, { 
          status: 'error', 
          message: `Failed: ${errorMessage}`,
          details: error.response?.data || error
        });
      }

      setState(prev => ({
        ...prev,
        isRunning: false,
        error: errorMessage,
        lastRun: new Date(),
        result: prev.result ? {
          ...prev.result,
          success: false,
          completedSteps: prev.currentStep,
          failedSteps: 1,
          duration: totalDuration
        } : null
      }));

      // Try to cleanup any created records in case of failure
      try {
        for (const record of createdRecords) {
          await deleteExample(record.id).catch(() => {}); // Ignore cleanup errors
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
  }, [state.currentStep, updateStep]);

  return {
    ...state,
    runSmokeTest,
    // Individual API methods for manual testing
    getAllExamples,
    createExample,
    updateExample,
    deleteExample,
    getExampleById,
    getExampleCount,
  };
}
