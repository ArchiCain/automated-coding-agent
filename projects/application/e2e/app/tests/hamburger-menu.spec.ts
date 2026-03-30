import { test, expect } from '@playwright/test';
import { testUser, paths, timeouts } from '../fixtures/test-data';

/**
 * Hamburger Menu Navigation E2E Tests
 *
 * Prerequisites:
 * - All services running: task start-local
 * - User authenticated (tests handle login in beforeEach)
 *
 * Test Coverage:
 * - Hamburger button is visible on all viewport sizes
 * - Navigation drawer opens when hamburger button is clicked
 * - Navigation drawer closes via close button
 * - Navigation drawer closes via backdrop click
 * - Consistent behavior across mobile, tablet, and desktop viewports
 */

// Viewport configurations for responsive testing
const viewports = {
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
};

test.describe('Hamburger Menu Navigation', () => {
  // Helper function to log in before each test
  async function login(page: any) {
    await page.goto(paths.login);
    await page.getByLabel(/username/i).fill(testUser.username);
    await page.getByLabel(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), {
      timeout: timeouts.medium,
    });
  }

  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await login(page);
  });

  test.describe('Mobile viewport (375px)', () => {
    test.use({ viewport: viewports.mobile });

    test('hamburger button should be visible', async ({ page }) => {
      await page.goto(paths.home);

      // Verify hamburger button is visible
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await expect(menuButton).toBeVisible();
    });

    test('should open navigation drawer when hamburger button is clicked', async ({ page }) => {
      await page.goto(paths.home);

      // Click hamburger button
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open - look for the Navigation heading in the drawer
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });
    });

    test('should close drawer via close button', async ({ page }) => {
      await page.goto(paths.home);

      // Open drawer
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });

      // Click close button
      const closeButton = page.getByRole('button', { name: /close navigation/i });
      await closeButton.click();

      // Verify drawer is closed
      await expect(drawerHeading).not.toBeVisible({ timeout: timeouts.short });
    });

    test('should close drawer via backdrop click', async ({ page }) => {
      await page.goto(paths.home);

      // Open drawer
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });

      // Click the backdrop (MUI modal backdrop)
      const backdrop = page.locator('.MuiBackdrop-root');
      await backdrop.click({ force: true });

      // Verify drawer is closed
      await expect(drawerHeading).not.toBeVisible({ timeout: timeouts.short });
    });
  });

  test.describe('Tablet viewport (768px)', () => {
    test.use({ viewport: viewports.tablet });

    test('hamburger button should be visible', async ({ page }) => {
      await page.goto(paths.home);

      // Verify hamburger button is visible
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await expect(menuButton).toBeVisible();
    });

    test('should open navigation drawer when hamburger button is clicked', async ({ page }) => {
      await page.goto(paths.home);

      // Click hamburger button
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });
    });

    test('should close drawer via close button', async ({ page }) => {
      await page.goto(paths.home);

      // Open drawer
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });

      // Click close button
      const closeButton = page.getByRole('button', { name: /close navigation/i });
      await closeButton.click();

      // Verify drawer is closed
      await expect(drawerHeading).not.toBeVisible({ timeout: timeouts.short });
    });
  });

  test.describe('Desktop viewport (1280px)', () => {
    test.use({ viewport: viewports.desktop });

    test('hamburger button should be visible', async ({ page }) => {
      await page.goto(paths.home);

      // Verify hamburger button is visible on desktop
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await expect(menuButton).toBeVisible();
    });

    test('should open navigation drawer when hamburger button is clicked', async ({ page }) => {
      await page.goto(paths.home);

      // Click hamburger button
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer opens (overlays on desktop)
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });
    });

    test('should close drawer via close button', async ({ page }) => {
      await page.goto(paths.home);

      // Open drawer
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });

      // Click close button
      const closeButton = page.getByRole('button', { name: /close navigation/i });
      await closeButton.click();

      // Verify drawer is closed
      await expect(drawerHeading).not.toBeVisible({ timeout: timeouts.short });
    });

    test('should close drawer via backdrop click', async ({ page }) => {
      await page.goto(paths.home);

      // Open drawer
      const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
      await menuButton.click();

      // Verify drawer is open
      const drawerHeading = page.getByRole('heading', { name: /navigation/i });
      await expect(drawerHeading).toBeVisible({ timeout: timeouts.short });

      // Click the backdrop (MUI modal backdrop)
      const backdrop = page.locator('.MuiBackdrop-root');
      await backdrop.click({ force: true });

      // Verify drawer is closed
      await expect(drawerHeading).not.toBeVisible({ timeout: timeouts.short });
    });
  });

  test.describe('Cross-viewport consistency', () => {
    test('hamburger menu works identically across all viewports', async ({ page }) => {
      // Test each viewport sequentially
      for (const [viewportName, viewportSize] of Object.entries(viewports)) {
        // Set viewport
        await page.setViewportSize(viewportSize);

        // Navigate to home
        await page.goto(paths.home);

        // Verify hamburger button is visible
        const menuButton = page.getByRole('button', { name: /toggle navigation menu/i });
        await expect(
          menuButton,
          `Hamburger button should be visible on ${viewportName}`
        ).toBeVisible();

        // Open drawer
        await menuButton.click();

        // Verify drawer opens
        const drawerHeading = page.getByRole('heading', { name: /navigation/i });
        await expect(
          drawerHeading,
          `Drawer should open on ${viewportName}`
        ).toBeVisible({ timeout: timeouts.short });

        // Close drawer
        const closeButton = page.getByRole('button', { name: /close navigation/i });
        await closeButton.click();

        // Verify drawer closes
        await expect(
          drawerHeading,
          `Drawer should close on ${viewportName}`
        ).not.toBeVisible({ timeout: timeouts.short });
      }
    });
  });
});
