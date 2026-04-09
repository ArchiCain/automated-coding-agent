# 14 — Design Validation & Designer Role

## Goal

Implement the designer role — a full creative and engineering role that builds frontend UI, writes Playwright E2E tests, enforces the design system, validates responsive layouts, and catches accessibility violations. The design review gate is a first-class validation gate with the same rigor as unit tests.

## Current State

- Playwright is set up in `projects/application/e2e/`
- The application frontend uses React 19 + Material-UI 6.5
- No automated design validation
- No accessibility auditing
- No screenshot comparison workflow
- No design system rules document

## Target State

- Comprehensive `design-review` skill document encoding all MUI design rules
- `e2e-test` skill document with Playwright patterns
- Designer role runs in the execution loop for frontend-touching tasks
- Design review gate captures screenshots at all breakpoints
- Accessibility gate runs axe-core WCAG AA checks
- E2E gate runs Playwright tests against deployed environments
- Visual regression detection (before/after comparison)

## Implementation Steps

### Step 1: Create Design System Rules Skill

Create `skills/design-review/SKILL.md` with comprehensive rules. This is the single source of truth for visual standards. Content derived from the architecture doc:

```markdown
# Design Review Skill

## Your Role
You are the designer for THE Dev Team. You are responsible for:
1. Implementing frontend UI using React and Material-UI
2. Writing Playwright E2E tests
3. Enforcing the design system
4. Validating responsive layouts
5. Ensuring WCAG AA accessibility compliance

## Design System Rules

### Spacing
- Page margins: 24px desktop, 16px mobile
- Card padding: 16px
- Section spacing: 32px between sections, 8px between related elements
- Always use `theme.spacing()` — no hardcoded pixel values

### Typography
- Page titles: h4 (34px), font-weight 400
- Section headers: h6 (20px), font-weight 500
- Body text: body1 (16px)
- Captions: caption (12px), `text.secondary` color
- Maximum 3 type sizes per view
- All typography via `theme.typography.*`

### Colors
- Primary actions: `theme.palette.primary`
- Destructive actions: `theme.palette.error`
- Success states: `theme.palette.success`
- Max 2 background colors per view
- All text on colored backgrounds: WCAG AA contrast (4.5:1)
- No hardcoded color values

### Layout
- Max content width: 1200px, centered
- Card grids: consistent heights per row
- Forms: labels above inputs
- Tables: right-align numbers, left-align text
- Empty states: centered illustration + message + CTA

### Components (MUI)
- Data lists: MUI DataGrid
- Forms: controlled TextField with validation states
- Navigation: AppBar + Drawer
- Modals: max 600px width, always have close button
- Loading: skeleton placeholders, never spinners
- Toasts: bottom-left, auto-dismiss 5s (except errors)

### Things That Are Always Wrong
- Horizontal scrolling on any viewport
- Text truncation without tooltip
- Clickable elements < 44x44px touch target
- More than 3 levels of visual nesting
- Inconsistent border-radius (standard: 8px)
- Mixed icon libraries
- Orphaned labels/headings with no content
- Icon-only buttons without aria-label
- Raw HTML where MUI components exist
- Inline style= with hardcoded values
- Direct color hex/rgb values
- Inline font styles

## Review Process

### Step 1: Code-Level Check
Scan React/MUI code for:
- No raw HTML elements where MUI components exist
- No inline style props with hardcoded values
- No direct color hex/rgb values
- All spacing via theme.spacing() or sx prop
- Correct MUI component variant usage

### Step 2: Screenshot Capture
Capture at all breakpoints:
- Mobile: 375x812
- Tablet: 768x1024
- Desktop: 1440x900

### Step 3: Visual Review
Review each screenshot against design rules.
For each violation, report:
1. What rule is violated
2. Where on the page
3. What the fix should be
4. Severity: blocking vs advisory

### Step 4: UI State Coverage
Validate all states:
- Loading state (skeleton placeholders)
- Empty state (centered message + CTA)
- Error state (user-friendly message + retry)
- Form validation states

### Step 5: Accessibility
Run axe-core WCAG AA audit. Zero violations required.
```

### Step 2: Create E2E Test Skill

Create `skills/e2e-test/SKILL.md`:

```markdown
# E2E Test Skill

## Your Role
Write Playwright E2E tests that validate user flows against the live deployed environment.

## Test Patterns

### Page Object Pattern
```typescript
class ProfilePage {
  constructor(private page: Page) {}

  async navigate() {
    await this.page.goto('/profile');
  }

  async fillForm(data: ProfileData) {
    await this.page.fill('[data-testid="name-input"]', data.name);
    await this.page.fill('[data-testid="email-input"]', data.email);
  }

  async submit() {
    await this.page.click('[data-testid="submit-button"]');
  }
}
```

### Test Structure
- Use data-testid attributes for selectors
- Each test should be independent (no shared state)
- Test happy path first, then edge cases
- Always clean up test data

### Running Against Deployed Environments
```typescript
const baseUrl = `http://app.env-${process.env.TASK_ID}.svc.cluster.local`;
```

### Console and Network Monitoring
Always monitor for errors during E2E tests.
```

### Step 3: Implement E2E Test Gate

Create `src/agents/gates/e2e-test.gate.ts`:

```typescript
export class E2ETestGate implements ValidationGate {
  name = 'e2e-tests';
  description = 'Playwright E2E tests pass against deployed environment';
  phase = 2 as const;
  applicableTo = 'frontend' as const;

  async run(context: GateContext): Promise<GateResult> {
    try {
      const output = await exec(
        `npx playwright test --reporter=json`,
        {
          cwd: path.join(context.worktreePath, 'projects/application/e2e'),
          env: {
            ...process.env,
            BASE_URL: `http://app.env-${context.taskId}.svc.cluster.local`,
            TASK_ID: context.taskId,
          },
        },
      );

      const results = JSON.parse(output);
      const passed = results.suites.every((s: any) =>
        s.specs.every((spec: any) => spec.ok)
      );

      return {
        gate: this.name,
        passed,
        output: `${results.stats.expected} passed, ${results.stats.unexpected} failed`,
        details: results.stats,
        durationMs: 0,
        attempt: 0,
      };
    } catch (error) {
      return { gate: this.name, passed: false, output: String(error), durationMs: 0, attempt: 0 };
    }
  }
}
```

### Step 4: Implement Accessibility Gate

Create `src/agents/gates/accessibility.gate.ts`:

```typescript
export class AccessibilityGate implements ValidationGate {
  name = 'accessibility';
  description = 'axe-core WCAG AA audit passes with zero violations';
  phase = 2 as const;
  applicableTo = 'frontend' as const;

  async run(context: GateContext): Promise<GateResult> {
    // This gate is run BY the designer role using Playwright + axe-core
    // The designer writes the test, runs it, and reports results
    // Check if accessibility results exist in gate-results
    const resultsPath = path.join(
      '.the-dev-team/state', context.taskId,
      'gate-results', 'accessibility-raw.json'
    );

    try {
      const raw = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
      const violations = raw.violations || [];
      return {
        gate: this.name,
        passed: violations.length === 0,
        output: violations.length === 0
          ? 'WCAG AA: 0 violations'
          : violations.map((v: any) => `${v.id}: ${v.description} (${v.impact})`).join('\n'),
        details: { violationCount: violations.length, violations },
        durationMs: 0,
        attempt: 0,
      };
    } catch {
      return { gate: this.name, passed: false, output: 'Accessibility results not found', durationMs: 0, attempt: 0 };
    }
  }
}
```

### Step 5: Implement Design Review Gate

The design review gate is special — it uses Claude Vision to analyze screenshots:

```typescript
export class DesignReviewGate implements ValidationGate {
  name = 'design-review';
  description = 'Visual design passes design system validation';
  phase = 2 as const;
  applicableTo = 'frontend' as const;

  async run(context: GateContext): Promise<GateResult> {
    // The designer role captures screenshots and writes findings
    // This gate checks if blocking design findings exist
    const findingsPath = path.join(
      '.the-dev-team/state', context.taskId,
      'findings', 'designer.md'
    );

    try {
      const findings = await fs.readFile(findingsPath, 'utf-8');
      const hasBlockingIssues = findings.includes('## Blocking Issues') &&
        findings.split('## Blocking Issues')[1]?.trim().length > 0;

      return {
        gate: this.name,
        passed: !hasBlockingIssues,
        output: hasBlockingIssues ? findings : 'Design review passed',
        durationMs: 0,
        attempt: 0,
      };
    } catch {
      return { gate: this.name, passed: true, output: 'No design findings', durationMs: 0, attempt: 0 };
    }
  }
}
```

### Step 6: Screenshot Capture Utility

The designer role uses Playwright to capture screenshots. Create a utility script:

Create `scripts/capture-screenshots.ts`:

```typescript
import { chromium } from 'playwright';

const breakpoints = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

async function captureScreenshots(baseUrl: string, pages: string[], outputDir: string) {
  const browser = await chromium.launch();

  for (const pagePath of pages) {
    for (const bp of breakpoints) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(`${baseUrl}${pagePath}`);
      await page.waitForLoadState('networkidle');
      await page.screenshot({
        path: `${outputDir}/${bp.name}-${pagePath.replace(/\//g, '-')}.png`,
        fullPage: true,
      });
      await page.close();
    }
  }

  await browser.close();
}
```

### Step 7: Visual Regression Comparison

For modified pages, compare before (main branch) and after (agent branch):

```typescript
async compareScreenshots(taskId: string, pagePath: string): Promise<ComparisonResult> {
  // Capture "before" from main branch deployment
  const beforeDir = `.the-dev-team/state/${taskId}/screenshots/before`;
  await captureScreenshots('http://app.app.svc.cluster.local', [pagePath], beforeDir);

  // Capture "after" from agent's sandbox
  const afterDir = `.the-dev-team/state/${taskId}/screenshots/after`;
  await captureScreenshots(`http://app.env-${taskId}.svc.cluster.local`, [pagePath], afterDir);

  // The designer role compares visually using Claude Vision
  return { beforeDir, afterDir };
}
```

## Verification

- [ ] `design-review/SKILL.md` exists with comprehensive rules
- [ ] `e2e-test/SKILL.md` exists with Playwright patterns
- [ ] Designer role loads both skills in its system prompt
- [ ] E2E tests run against deployed sandbox environment
- [ ] axe-core WCAG AA audit runs and reports violations
- [ ] Screenshots are captured at all 3 breakpoints
- [ ] Design review gate blocks PR on "blocking" violations
- [ ] Advisory violations are included in PR description
- [ ] Visual regression comparison works for modified pages

## Open Questions

- **axe-core integration:** Install `@axe-core/playwright` as a project dependency or have the designer role install it at runtime? Project dependency is more reliable.
- **Screenshot storage:** Screenshots can be large. Store in the worktree (committed to branch for PR), or in the state directory (not committed)? Committing to the branch makes them visible in the PR.
- **Designer model requirements:** The designer needs vision capabilities. If using Claude, this works. If using OpenCode with a non-vision model, the design review gate can't function. Enforce vision-capable model for designer role in config validation.
