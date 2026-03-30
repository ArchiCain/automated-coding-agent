import { test, expect } from '@playwright/test';
import { testUser, paths, timeouts } from '../../fixtures/test-data';

/**
 * User Creation and Login E2E Tests
 *
 * Prerequisites:
 * - All services running: task start-local
 * - Keycloak admin user configured (admin/admin)
 *
 * Test Coverage:
 * - Admin can create a new user
 * - Newly created user can log in with temporary password
 */

// Generate unique user data for each test run
const generateTestUser = () => {
  const timestamp = Date.now();
  return {
    email: `testuser-${timestamp}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    temporaryPassword: 'TempPass123!',
    role: 'user',
  };
};

/**
 * Helper function to log in as admin
 */
async function loginAsAdmin(page: any) {
  await page.goto(paths.login);
  await page.waitForLoadState('networkidle');

  // Use more specific selectors to avoid matching visibility toggle button
  await page.locator('input[id="username"], input[name="username"]').fill(testUser.username);
  await page.locator('input[id="password"], input[name="password"], input[type="password"]').first().fill(testUser.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), {
    timeout: timeouts.medium,
  });
}

/**
 * Helper function to log out
 * The logout button is an icon (arrow) in the top-right header area
 */
async function logout(page: any) {
  // The logout button is an icon button in the header, look for it by aria-label or test-id
  // It's the arrow icon next to the user name and dark mode toggle
  const logoutButton = page.locator('button[aria-label*="logout" i], button[aria-label*="sign out" i], [data-testid="logout"], header button:has(svg)').last();

  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
  } else {
    // Alternative: click the rightmost button in the header (likely logout)
    const headerButtons = page.locator('header button, [class*="AppBar"] button');
    const count = await headerButtons.count();
    if (count > 0) {
      // The logout button is typically the last one in the header
      await headerButtons.nth(count - 1).click();
    }
  }

  // Wait for redirect to login page
  await page.waitForURL(/.*login/, { timeout: timeouts.medium });
}

test.describe('User Creation and Login Flow', () => {
  test('should create a new user and login with that user', async ({ page }) => {
    const newUser = generateTestUser();

    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    await loginAsAdmin(page);
    console.log('Admin login successful');

    // Step 2: Navigate to user management
    console.log('Step 2: Navigating to user management...');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');

    // Verify we're on the users page
    await expect(page).toHaveURL(/.*\/admin\/users/);
    console.log('On user management page');

    // Step 3: Click "New User" button
    console.log('Step 3: Creating new user...');
    const newUserButton = page.getByRole('link', { name: /new user|create user|add user/i });
    await expect(newUserButton).toBeVisible({ timeout: timeouts.short });
    await newUserButton.click();

    // Wait for the user form page
    await page.waitForURL(/.*\/admin\/users\/new/, { timeout: timeouts.short });
    console.log('On new user form');

    // Step 4: Fill in the user form
    console.log('Step 4: Filling user form...');
    console.log(`  Email: ${newUser.email}`);

    // Fill email (which is now also the username) - use specific selector
    await page.locator('input[id="email"], input[name="email"]').fill(newUser.email);

    // Fill first name
    await page.locator('input[id="firstName"], input[name="firstName"]').fill(newUser.firstName);

    // Fill last name
    await page.locator('input[id="lastName"], input[name="lastName"]').fill(newUser.lastName);

    // Select role
    const roleSelect = page.getByLabel(/role/i);
    await roleSelect.click();
    await page.getByRole('option', { name: /user/i }).click();

    // Fill temporary password - use specific selector
    await page.locator('input[id="temporaryPassword"], input[name="temporaryPassword"]').fill(newUser.temporaryPassword);

    // Step 5: Submit the form
    console.log('Step 5: Submitting form...');
    await page.getByRole('button', { name: /create user|save/i }).click();

    // Wait for success and redirect to users list
    await page.waitForURL(/.*\/admin\/users$/, { timeout: timeouts.medium });
    console.log('User created successfully, redirected to users list');

    // Verify the user appears in the list (optional verification)
    await page.waitForLoadState('networkidle');

    // Step 6: Logout
    console.log('Step 6: Logging out...');
    await logout(page);
    console.log('Logged out successfully');

    // Step 7: Login as the new user
    console.log('Step 7: Logging in as new user...');
    console.log(`  Username (email): ${newUser.email}`);
    console.log(`  Password: ${newUser.temporaryPassword}`);

    await page.goto(paths.login);
    await page.waitForLoadState('networkidle');

    // Fill login form with new user credentials (use specific selectors)
    await page.locator('input[id="username"], input[name="username"]').fill(newUser.email);
    await page.locator('input[id="password"], input[name="password"], input[type="password"]').first().fill(newUser.temporaryPassword);

    // Submit login
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait and check result
    console.log('Step 8: Checking login result...');

    // Wait for either:
    // 1. Successful redirect (user logged in)
    // 2. Password change required (temporary password)
    // 3. Error message (login failed)

    await page.waitForTimeout(3000); // Give it time to process

    const currentUrl = page.url();
    console.log(`  Current URL after login attempt: ${currentUrl}`);

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/new-user-login-result.png' });

    // Check for various scenarios
    const isOnLoginPage = currentUrl.includes('/login');
    const isOnPasswordChangePage = currentUrl.includes('update-password') ||
                                   currentUrl.includes('required-action') ||
                                   await page.getByText(/update password|change password|new password/i).isVisible().catch(() => false);
    const hasError = await page.getByText(/invalid|error|failed|incorrect/i).isVisible().catch(() => false);

    console.log(`  Still on login page: ${isOnLoginPage}`);
    console.log(`  On password change page: ${isOnPasswordChangePage}`);
    console.log(`  Has error message: ${hasError}`);

    if (hasError) {
      // Capture the error message
      const errorText = await page.locator('[class*="error"], [class*="alert"], [role="alert"]').textContent().catch(() => 'No error element found');
      console.log(`  Error message: ${errorText}`);

      // Also capture any visible text that might be an error
      const pageContent = await page.content();
      if (pageContent.includes('Invalid')) {
        console.log('  Page contains "Invalid" text');
      }
    }

    // If password change is required, that's expected behavior for temporary passwords
    if (isOnPasswordChangePage) {
      console.log('SUCCESS: User logged in but needs to change password (expected for temporary passwords)');
      // This is actually a success case!
      expect(true).toBe(true);
      return;
    }

    // If we're redirected away from login, success!
    if (!isOnLoginPage) {
      console.log('SUCCESS: User logged in successfully!');
      expect(isOnLoginPage).toBe(false);
      return;
    }

    // If still on login page with error, fail the test with details
    if (isOnLoginPage && hasError) {
      throw new Error('Login failed for newly created user. Check console output and screenshot for details.');
    }

    // Assert that login was successful (not on login page anymore)
    expect(isOnLoginPage).toBe(false);
  });

});
