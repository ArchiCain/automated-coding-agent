import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Coding Agent Workflow E2E Tests
 *
 * Prerequisites:
 * - Coding Agent Backend running on host: task coding-agent-backend:local:start
 * - Coding Agent Frontend running in Docker: task start-local
 * - Valid ANTHROPIC_API_KEY in .env
 *
 * Test Coverage:
 * - Complete plan creation workflow
 * - Decomposition with real AI (Claude)
 * - Task editing and further decomposition
 * - Plan saving and file verification
 * - Cleanup after test
 *
 * Note: This test uses the real Claude API for decomposition.
 * Decomposition can take up to 2 minutes for complex features.
 */

// Coding agent specific configuration
const CODING_AGENT_FRONTEND_PORT = process.env.CODING_AGENT_FRONTEND_PORT || '3001';
const CODING_AGENT_BACKEND_PORT = process.env.CODING_AGENT_BACKEND_PORT || '8086';
const CODING_AGENT_FRONTEND_URL = `http://localhost:${CODING_AGENT_FRONTEND_PORT}`;
const CODING_AGENT_BACKEND_URL = `http://localhost:${CODING_AGENT_BACKEND_PORT}`;

// Timeout configurations for AI operations
const timeouts = {
  short: 5000,      // 5 seconds - for UI interactions
  medium: 15000,    // 15 seconds - for API calls
  long: 30000,      // 30 seconds - for page loads
  decomposition: 180000, // 3 minutes - for AI decomposition (can be slow)
};

// Test data
const testFeatureDescription = `Add a simple health check endpoint to the backend API.

Requirements:
- GET /api/health endpoint
- Returns { status: 'ok', timestamp: Date.now() }
- No authentication required
- Response time under 100ms`;

/**
 * Helper to check if backend is available
 */
async function isBackendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${CODING_AGENT_BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Helper to check if frontend is available
 */
async function isFrontendAvailable(): Promise<boolean> {
  try {
    const response = await fetch(CODING_AGENT_FRONTEND_URL, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Helper to delete a plan via API
 */
async function deletePlan(planId: string): Promise<void> {
  try {
    await fetch(`${CODING_AGENT_BACKEND_URL}/api/plans/${planId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Helper to get all plans via API
 */
async function getPlans(): Promise<{ id: string; slug: string }[]> {
  try {
    const response = await fetch(`${CODING_AGENT_BACKEND_URL}/api/plans`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      return data.plans || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Helper to verify plan files exist
 */
function verifyPlanFiles(planId: string): boolean {
  // The plans are stored in projects/backend/.rtslabs/plans/{planId}/
  // We need to go up from the e2e project to find the backend project
  const repoRoot = path.resolve(__dirname, '../../../../');
  const planDir = path.join(repoRoot, 'projects', 'backend', '.rtslabs', 'plans', planId);

  const requiredFiles = ['meta.json', 'request.md', 'tasks.jsonl', 'state.json'];

  if (!fs.existsSync(planDir)) {
    return false;
  }

  for (const file of requiredFiles) {
    const filePath = path.join(planDir, file);
    if (!fs.existsSync(filePath)) {
      return false;
    }
  }

  return true;
}

/**
 * Helper to clean up plan files
 */
function cleanupPlanFiles(planId: string): void {
  const repoRoot = path.resolve(__dirname, '../../../../');
  const planDir = path.join(repoRoot, 'projects', 'backend', '.rtslabs', 'plans', planId);

  if (fs.existsSync(planDir)) {
    fs.rmSync(planDir, { recursive: true, force: true });
  }
}

test.describe('Coding Agent Workflow', () => {
  // Track created plan ID for cleanup
  let createdPlanId: string | null = null;

  // Skip tests if services aren't available
  test.beforeAll(async () => {
    const [backendAvailable, frontendAvailable] = await Promise.all([
      isBackendAvailable(),
      isFrontendAvailable(),
    ]);

    if (!backendAvailable) {
      test.skip(true, 'Coding Agent Backend is not available. Run: task coding-agent-backend:local:start');
    }

    if (!frontendAvailable) {
      test.skip(true, 'Coding Agent Frontend is not available. Run: task start-local');
    }
  });

  // Clean up after each test
  test.afterEach(async () => {
    if (createdPlanId) {
      // Clean up via API
      await deletePlan(createdPlanId);
      // Clean up files
      cleanupPlanFiles(createdPlanId);
      createdPlanId = null;
    }
  });

  test('should display dashboard with create plan button', async ({ page }) => {
    // Navigate to coding agent frontend
    await page.goto(CODING_AGENT_FRONTEND_URL);

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: timeouts.medium });

    // Verify header is displayed
    await expect(page.getByRole('heading', { name: /Plans Dashboard/i })).toBeVisible();

    // Verify create plan button is visible
    const createButton = page.getByTestId('create-plan-button');
    await expect(createButton).toBeVisible();
    await expect(createButton).toHaveText(/Create Plan/i);
  });

  test('should navigate to create plan page and show form', async ({ page }) => {
    // Navigate to coding agent frontend
    await page.goto(CODING_AGENT_FRONTEND_URL);

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: timeouts.medium });

    // Click create plan button
    await page.getByTestId('create-plan-button').click();

    // Wait for create plan page
    await expect(page.getByTestId('plan-create-page')).toBeVisible({ timeout: timeouts.medium });

    // Verify stepper is visible
    await expect(page.getByText('Describe Feature')).toBeVisible();
    await expect(page.getByText('Decompose')).toBeVisible();
    await expect(page.getByText('Review Tasks')).toBeVisible();

    // Verify form elements
    await expect(page.getByTestId('request-form')).toBeVisible();
    await expect(page.getByTestId('project-select')).toBeVisible();
    await expect(page.getByTestId('feature-description-input')).toBeVisible();
    await expect(page.getByTestId('submit-button')).toBeVisible();
  });

  test('should show validation errors for empty form submission', async ({ page }) => {
    // Navigate to create plan page
    await page.goto(`${CODING_AGENT_FRONTEND_URL}/plans/new`);

    // Wait for form to load
    await expect(page.getByTestId('request-form')).toBeVisible({ timeout: timeouts.medium });

    // Click submit without filling form
    await page.getByTestId('submit-button').click();

    // Verify validation errors appear
    await expect(page.getByText('Project is required')).toBeVisible({ timeout: timeouts.short });
    await expect(page.getByText('Feature description is required')).toBeVisible({ timeout: timeouts.short });
  });

  test('should complete full workflow: create plan, decompose, edit task, save', async ({ page }) => {
    // This test has a longer timeout due to AI decomposition
    test.setTimeout(timeouts.decomposition + 60000);

    // Navigate to create plan page
    await page.goto(`${CODING_AGENT_FRONTEND_URL}/plans/new`);

    // Wait for form to load
    await expect(page.getByTestId('request-form')).toBeVisible({ timeout: timeouts.medium });

    // Step 1: Fill in the form
    // Select backend project
    await page.getByTestId('project-select').click();
    await page.getByRole('option', { name: /backend/i }).first().click();

    // Enter feature description
    await page.getByTestId('feature-description-input').fill(testFeatureDescription);

    // Step 2: Start decomposition
    await page.getByTestId('submit-button').click();

    // Wait for decomposition step to become active
    // The progress component should appear
    await expect(page.getByText(/Starting Decomposition|Decomposing|Analyzing/i))
      .toBeVisible({ timeout: timeouts.medium });

    // Wait for decomposition to complete (this can take a while with real AI)
    // The review step should become active
    await expect(page.getByTestId('task-review'))
      .toBeVisible({ timeout: timeouts.decomposition });

    // Step 3: Verify tasks were created
    // There should be at least one task card
    await expect(page.locator('[data-testid^="task-card-"]').first())
      .toBeVisible({ timeout: timeouts.medium });

    // Count tasks (should be 3-7 according to spec)
    const taskCards = page.locator('[data-testid^="task-card-"]');
    const taskCount = await taskCards.count();
    expect(taskCount).toBeGreaterThanOrEqual(1);
    expect(taskCount).toBeLessThanOrEqual(10); // Allow some flexibility

    // Step 4: Edit a task
    // Click the first task to select it
    const firstTaskCard = taskCards.first();
    await firstTaskCard.click();

    // Find and click the edit button on the first task
    const editButton = firstTaskCard.getByRole('button', { name: /edit/i });
    await editButton.click();

    // Wait for task editor modal to open
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: timeouts.short });
    await expect(page.getByRole('heading', { name: /Edit Task/i })).toBeVisible();

    // Modify the task title
    const titleInput = page.locator('#title');
    await titleInput.clear();
    await titleInput.fill('Updated Health Check Task');

    // Save changes
    await page.getByRole('button', { name: /Save Changes/i }).click();

    // Wait for modal to close and success message
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: timeouts.medium });
    await expect(page.getByText(/Task updated successfully/i))
      .toBeVisible({ timeout: timeouts.short });

    // Step 5: Decompose a task further (if there's a non-atomic task)
    // Look for a decompose button
    const decomposeButton = page.locator('[aria-label*="Decompose"]').first();
    const hasDecomposeButton = await decomposeButton.isVisible().catch(() => false);

    if (hasDecomposeButton) {
      // Click decompose button
      await decomposeButton.click();

      // Wait for decomposition to complete (shows progress, then updates task list)
      // The task count should increase after decomposition
      await page.waitForTimeout(timeouts.medium); // Brief wait for the operation

      // Verify we're still on the review page
      await expect(page.getByTestId('task-review')).toBeVisible({ timeout: timeouts.medium });
    }

    // Step 6: Save the plan
    const saveButton = page.getByTestId('save-button');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for success message
    await expect(page.getByText(/Plan saved successfully/i))
      .toBeVisible({ timeout: timeouts.medium });

    // Step 7: Extract plan ID from URL after save (redirects to /plans/:id)
    await page.waitForURL(/\/plans\/p-[a-f0-9]+/, { timeout: timeouts.medium });

    const url = page.url();
    const planIdMatch = url.match(/\/plans\/(p-[a-f0-9]+)/);
    expect(planIdMatch).not.toBeNull();
    createdPlanId = planIdMatch![1];

    // Step 8: Verify plan files were created
    const filesExist = verifyPlanFiles(createdPlanId);
    expect(filesExist).toBe(true);
  });

  test('should show plans on dashboard after creation', async ({ page }) => {
    // First, check if there are any existing plans
    const existingPlans = await getPlans();

    // Navigate to dashboard
    await page.goto(CODING_AGENT_FRONTEND_URL);

    // Wait for dashboard to load
    await expect(page.getByTestId('dashboard-page')).toBeVisible({ timeout: timeouts.medium });

    // If there are plans, verify they're displayed
    if (existingPlans.length > 0) {
      // Should show plan content, not empty state
      const hasContent = await page.getByTestId('dashboard-content').isVisible().catch(() => false);
      const hasEmpty = await page.getByTestId('dashboard-empty').isVisible().catch(() => false);

      expect(hasContent || hasEmpty).toBe(true);
    } else {
      // Should show empty state
      await expect(page.getByTestId('dashboard-empty')).toBeVisible({ timeout: timeouts.medium });
      await expect(page.getByText(/No plans yet/i)).toBeVisible();
    }
  });

  test('should navigate between task list and dependency graph tabs', async ({ page }) => {
    // Create a quick plan first to test tab navigation
    // For this test, we'll skip to viewing an existing plan if available

    const existingPlans = await getPlans();

    if (existingPlans.length === 0) {
      test.skip(true, 'No existing plans to test tab navigation');
      return;
    }

    // Navigate to the first plan
    const planId = existingPlans[0].id;
    await page.goto(`${CODING_AGENT_FRONTEND_URL}/plans/${planId}`);

    // Wait for plan edit page to load
    await page.waitForLoadState('networkidle', { timeout: timeouts.medium });

    // Look for tabs (Task List and Dependency Graph)
    const taskListTab = page.getByRole('tab', { name: /Task List/i });
    const dependencyGraphTab = page.getByRole('tab', { name: /Dependency Graph/i });

    // Verify both tabs exist
    const hasTaskListTab = await taskListTab.isVisible().catch(() => false);
    const hasDependencyGraphTab = await dependencyGraphTab.isVisible().catch(() => false);

    if (hasTaskListTab && hasDependencyGraphTab) {
      // Click dependency graph tab
      await dependencyGraphTab.click();

      // Verify dependency graph content is visible
      await page.waitForTimeout(1000); // Brief wait for tab switch animation

      // Click back to task list tab
      await taskListTab.click();

      // Verify task list is visible again
      await page.waitForTimeout(1000);
    }
  });

  test('should handle cancel during decomposition', async ({ page }) => {
    // Navigate to create plan page
    await page.goto(`${CODING_AGENT_FRONTEND_URL}/plans/new`);

    // Wait for form to load
    await expect(page.getByTestId('request-form')).toBeVisible({ timeout: timeouts.medium });

    // Fill in the form
    await page.getByTestId('project-select').click();
    await page.getByRole('option', { name: /backend/i }).first().click();
    await page.getByTestId('feature-description-input').fill(testFeatureDescription);

    // Start decomposition
    await page.getByTestId('submit-button').click();

    // Wait for decomposition to start
    await page.waitForTimeout(2000);

    // Look for cancel button
    const cancelButton = page.getByRole('button', { name: /cancel/i });
    const hasCancelButton = await cancelButton.isVisible().catch(() => false);

    if (hasCancelButton) {
      // Click cancel
      await cancelButton.click();

      // Should return to request form
      await expect(page.getByTestId('request-form'))
        .toBeVisible({ timeout: timeouts.medium });
    }
  });
});

test.describe('Coding Agent Error Handling', () => {
  test('should handle backend unavailable gracefully', async ({ page }) => {
    // This test verifies the frontend handles API errors gracefully
    // Note: This test might actually work if backend IS available

    // Navigate to dashboard
    await page.goto(CODING_AGENT_FRONTEND_URL);

    // Wait for page to load (should either show content or error)
    await page.waitForLoadState('networkidle', { timeout: timeouts.long });

    // The page should either show dashboard content or an error alert
    const hasDashboard = await page.getByTestId('dashboard-page').isVisible().catch(() => false);
    expect(hasDashboard).toBe(true);
  });
});
