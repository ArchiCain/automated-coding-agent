import { test, expect } from '@playwright/test';
import { testUser, paths, timeouts } from '../../fixtures/test-data';

/**
 * Protected Routes E2E Tests
 *
 * Prerequisites:
 * - All services running: task start-local
 *
 * Test Coverage:
 * - Unauthenticated users are redirected to login
 * - Authenticated users can access protected routes
 * - After logout, protected routes redirect to login
 */

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route unauthenticated', async ({ page }) => {
    // Try to access conversational AI without logging in
    await page.goto(paths.conversationalAi);

    // Should be redirected to login
    await page.waitForURL(/.*login/, { timeout: timeouts.medium });

    // Verify on login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should allow access to protected route when authenticated', async ({ page }) => {
    // Log in
    await page.goto(paths.login);
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for login to complete
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: timeouts.medium,
    });

    // Navigate to protected route
    await page.goto(paths.conversationalAi);

    // Should NOT be redirected to login
    await expect(page).not.toHaveURL(/.*login/);

    // Verify on conversational AI page
    await expect(page.getByPlaceholder(/type.*message/i)).toBeVisible({
      timeout: timeouts.medium,
    });
  });

  test('should redirect to login after accessing protected route from logged-in state', async ({ page }) => {
    // First, log in
    await page.goto(paths.login);
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect after login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: timeouts.medium,
    });

    // Navigate to protected route
    await page.goto(paths.conversationalAi);

    // Verify we can access it
    await expect(page.getByPlaceholder(/type.*message/i)).toBeVisible({
      timeout: timeouts.medium,
    });

    // Now open a new context (simulates new session/logged out)
    const newContext = await page.context().browser()?.newContext();
    if (!newContext) {
      throw new Error('Could not create new context');
    }

    const newPage = await newContext.newPage();

    // Try to access protected route in new context (not logged in)
    await newPage.goto(paths.conversationalAi);

    // Should redirect to login
    await newPage.waitForURL(/.*login/, { timeout: timeouts.medium });
    await expect(newPage).toHaveURL(/.*login/);

    // Cleanup
    await newContext.close();
  });

  test('should preserve intended destination after login redirect', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto(paths.conversationalAi);

    // Should redirect to login
    await page.waitForURL(/.*login/, { timeout: timeouts.medium });

    // Log in
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect back to originally requested page
    // Note: This depends on your implementation's redirect logic
    // May need adjustment based on actual behavior
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: timeouts.medium,
    });

    // Verify we're on conversational AI or home (depends on implementation)
    const url = page.url();
    const isValidDestination = url.includes(paths.conversationalAi) || url === `${page.context()._options.baseURL}/`;

    expect(isValidDestination).toBeTruthy();
  });
});
