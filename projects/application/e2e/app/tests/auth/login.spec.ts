import { test, expect } from '@playwright/test';
import { testUser, paths, timeouts } from '../../fixtures/test-data';

/**
 * Login Workflow E2E Tests
 *
 * Prerequisites:
 * - All services running: task start-local
 * - Keycloak admin user configured (admin/admin)
 *
 * Test Coverage:
 * - User can navigate to login page
 * - User can log in with valid credentials
 * - User is redirected after successful login
 * - Invalid credentials show error message
 */

test.describe('Login Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    // Navigate to login
    await page.goto(paths.login);

    // Verify login page is displayed
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();

    // Verify form elements are present
    await expect(page.getByLabel(/username/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(paths.login);

    // Fill in login form
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect after login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: timeouts.medium,
    });

    // Verify redirected away from login page
    expect(page.url()).not.toContain('/login');

    // Verify user is authenticated (should see app content, not login)
    await expect(page.getByRole('heading', { name: /login/i })).not.toBeVisible();
  });

  test('should redirect to home after login', async ({ page }) => {
    // Navigate to login page
    await page.goto(paths.login);

    // Perform login
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for navigation
    await page.waitForURL('/', { timeout: timeouts.medium });

    // Verify on home page
    await expect(page).toHaveURL('/');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto(paths.login);

    // Fill in invalid credentials
    await page.getByLabel(/username/i).fill('invalid-user');
    await page.getByLabel(/password/i).fill('wrong-password');

    // Submit form
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message to appear
    await page.waitForTimeout(2000); // Brief wait for error processing

    // Verify still on login page or error is shown
    // Note: Exact error handling depends on your implementation
    // This test may need adjustment based on your error display logic
    const currentUrl = page.url();
    const hasError = await page.getByText(/error|invalid|failed/i).isVisible().catch(() => false);

    // Either still on login page OR error is displayed
    expect(currentUrl.includes('/login') || hasError).toBeTruthy();
  });

  test('should prevent access to protected routes when not logged in', async ({ page }) => {
    // Try to access protected route without logging in
    await page.goto(paths.conversationalAi);

    // Should be redirected to login
    await page.waitForURL(/.*login/, { timeout: timeouts.medium });

    // Verify on login page
    await expect(page).toHaveURL(/.*login/);
    await expect(page.getByRole('heading', { name: /login/i })).toBeVisible();
  });
});
