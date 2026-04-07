# Skill: E2E Test

You are writing or running **end-to-end tests** using Playwright against a fully
deployed environment (frontend + backend + database).

---

## Framework & Configuration

Tests use **Playwright Test**. Configuration is in `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  timeout: 30_000,
  retries: 1,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
```

The `BASE_URL` is derived from your `TASK_ID`:
```bash
export BASE_URL="http://env-${TASK_ID}.internal"
```

---

## Test File Location & Naming

```
e2e/
  {feature}/
    {feature}.spec.ts           # Test file
    {feature}.page.ts           # Page object
  fixtures/
    auth.fixture.ts             # Shared auth fixture
  helpers/
    wait-for-api.ts             # Shared utility helpers
```

---

## Page Object Pattern

Every page or major component gets a page object:

```typescript
import { Page, Locator } from '@playwright/test';

export class FeatureListPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createButton: Locator;
  readonly dataGrid: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /features/i });
    this.createButton = page.getByTestId('create-feature-button');
    this.dataGrid = page.getByTestId('features-data-grid');
    this.searchInput = page.getByTestId('feature-search-input');
  }

  async navigate(): Promise<void> {
    await this.page.goto('/features');
    await this.heading.waitFor({ state: 'visible' });
  }

  async clickCreate(): Promise<void> {
    await this.createButton.click();
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    // Wait for debounced search to trigger
    await this.page.waitForResponse(resp =>
      resp.url().includes('/api/features') && resp.status() === 200
    );
  }

  async getRowCount(): Promise<number> {
    return this.dataGrid.locator('[role="row"]').count() - 1; // Subtract header
  }
}
```

---

## Selector Strategy

Use selectors in this priority order:

1. **`data-testid`** (preferred) — Stable, decoupled from styling and text.
   ```typescript
   page.getByTestId('submit-button')
   ```

2. **Role** — For standard interactive elements.
   ```typescript
   page.getByRole('button', { name: 'Submit' })
   page.getByRole('heading', { level: 1 })
   ```

3. **Label** — For form fields.
   ```typescript
   page.getByLabel('Email address')
   ```

4. **Text** — Last resort, fragile to copy changes.
   ```typescript
   page.getByText('Welcome back')
   ```

**Never use:**
- CSS class selectors (`.MuiButton-root`)
- XPath
- DOM structure-dependent selectors (`div > div > button`)

---

## Test Writing Pattern

```typescript
import { test, expect } from '@playwright/test';
import { FeatureListPage } from './feature-list.page';

test.describe('Feature List', () => {
  let featureList: FeatureListPage;

  test.beforeEach(async ({ page }) => {
    featureList = new FeatureListPage(page);
    await featureList.navigate();
  });

  test('should display the features heading', async () => {
    await expect(featureList.heading).toBeVisible();
  });

  test('should show create button', async () => {
    await expect(featureList.createButton).toBeVisible();
    await expect(featureList.createButton).toBeEnabled();
  });

  test('should filter results when searching', async ({ page }) => {
    await featureList.search('billing');
    const count = await featureList.getRowCount();
    expect(count).toBeGreaterThan(0);
  });
});
```

---

## Console & Network Monitoring

Capture browser errors and failed network requests:

```typescript
test.beforeEach(async ({ page }) => {
  // Collect console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Collect failed requests
  const failedRequests: string[] = [];
  page.on('response', response => {
    if (response.status() >= 500) {
      failedRequests.push(`${response.status()} ${response.url()}`);
    }
  });

  // After test, assert no unexpected errors
  test.afterEach(() => {
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
```

---

## Screenshot Capture

Capture screenshots for visual review and debugging:

```typescript
// Capture at specific breakpoints for design review
const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

for (const bp of breakpoints) {
  test(`visual check at ${bp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: bp.width, height: bp.height });
    await featureList.navigate();
    await page.screenshot({
      path: `screenshots/${bp.name}-feature-list.png`,
      fullPage: true,
    });
  });
}
```

---

## Running Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific feature tests
npx playwright test e2e/features/

# Run with UI mode (for debugging locally)
npx playwright test --ui

# Run with specific base URL
BASE_URL=http://env-task-123.internal npx playwright test

# Run headed (visible browser)
npx playwright test --headed

# View test report
npx playwright show-report
```

---

## Waiting Strategies

- **Never use `page.waitForTimeout()`** (arbitrary delays are flaky).
- Wait for specific conditions:

```typescript
// Wait for navigation
await page.waitForURL('/features/123');

// Wait for network response
await page.waitForResponse(resp => resp.url().includes('/api/features'));

// Wait for element state
await expect(page.getByTestId('loading')).toBeHidden();
await expect(page.getByTestId('data-grid')).toBeVisible();

// Wait for specific content
await expect(page.getByText('Feature created')).toBeVisible();
```

---

## Debugging Failures

1. **View trace** — `npx playwright show-trace trace.zip` (traces are saved on failure)
2. **View screenshots** — Check `test-results/` directory for failure screenshots.
3. **Check environment health** — `task env:health TASK_ID=$TASK_ID`
4. **Check backend logs** — `task env:logs TASK_ID=$TASK_ID SERVICE=backend`
5. **Run headed** — `npx playwright test --headed --debug` to step through.
