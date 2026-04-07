import { Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';

const logger = new Logger('CaptureScreenshots');

/**
 * Viewport breakpoints for responsive screenshot capture.
 */
const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

/**
 * Captures full-page screenshots of the given pages at three responsive
 * breakpoints (mobile 375x812, tablet 768x1024, desktop 1440x900).
 *
 * Uses Playwright (dynamically imported) to launch a headless Chromium browser.
 *
 * @param baseUrl - Base URL of the running application (e.g., "http://localhost:3000")
 * @param pages  - Array of page paths to capture (e.g., ["/", "/dashboard", "/settings"])
 * @param outputDir - Directory where screenshots will be saved
 * @returns Array of file paths for all captured screenshots
 */
export async function captureScreenshots(
  baseUrl: string,
  pages: string[],
  outputDir: string,
): Promise<string[]> {
  // Dynamically require playwright — optional dependency, not installed in base orchestrator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let chromium: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = require('playwright');
    chromium = pw.chromium;
  } catch {
    logger.warn('Playwright not available — skipping screenshot capture');
    return [];
  }

  await fs.mkdir(outputDir, { recursive: true });

  const capturedPaths: string[] = [];
  let browser;

  try {
    browser = await chromium.launch({ headless: true });

    for (const pagePath of pages) {
      const url = `${baseUrl.replace(/\/$/, '')}${pagePath}`;
      const slug = pagePath === '/' ? 'home' : pagePath.replace(/^\//, '').replace(/\//g, '-');

      for (const bp of BREAKPOINTS) {
        const context = await browser.newContext({
          viewport: { width: bp.width, height: bp.height },
        });
        const page = await context.newPage();

        try {
          logger.debug(`Capturing ${slug} at ${bp.name} (${bp.width}x${bp.height})`);

          await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 30_000,
          });

          // Wait a moment for any animations to settle
          await page.waitForTimeout(1000);

          const filename = `${slug}-${bp.name}-${bp.width}x${bp.height}.png`;
          const filepath = path.join(outputDir, filename);

          await page.screenshot({
            path: filepath,
            fullPage: true,
          });

          capturedPaths.push(filepath);
          logger.debug(`Saved screenshot: ${filepath}`);
        } catch (err) {
          logger.warn(
            `Failed to capture ${slug} at ${bp.name}: ${(err as Error).message}`,
          );
        } finally {
          await context.close();
        }
      }
    }
  } catch (err) {
    logger.error(`Screenshot capture failed: ${(err as Error).message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  logger.log(`Captured ${capturedPaths.length} screenshots in ${outputDir}`);
  return capturedPaths;
}
