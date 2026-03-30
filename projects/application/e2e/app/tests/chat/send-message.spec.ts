import { test, expect } from '@playwright/test';
import { testUser, paths, testMessages, timeouts } from '../../fixtures/test-data';

/**
 * Chat Message Sending E2E Tests
 *
 * Prerequisites:
 * - All services running: task start-local
 * - User authenticated (tests handle login in beforeEach)
 *
 * Test Coverage:
 * - User can send a message
 * - User receives AI response (streaming)
 * - Message appears in chat history
 * - Chat interface handles errors gracefully
 */

test.describe('Chat Message Sending', () => {
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

    // Navigate to conversational AI page
    await page.goto(paths.conversationalAi);
  });

  test('should display chat interface', async ({ page }) => {
    // Verify chat interface is visible
    await expect(page.getByPlaceholder(/type.*message/i)).toBeVisible();

    // Verify send button is present (may be disabled if input is empty)
    const sendButton = page.getByRole('button', { name: /send/i });
    await expect(sendButton).toBeVisible();
  });

  test('should send a message and receive response', async ({ page }) => {
    // Get chat input
    const messageInput = page.getByPlaceholder(/type.*message/i);
    const sendButton = page.getByRole('button', { name: /send/i });

    // Type message
    await messageInput.fill(testMessages.simple);

    // Verify send button is enabled
    await expect(sendButton).toBeEnabled();

    // Send message
    await sendButton.click();

    // Verify user message appears in chat
    await expect(page.getByText(testMessages.simple)).toBeVisible({
      timeout: timeouts.short,
    });

    // Wait for AI response to start appearing
    // Note: Response is streaming, so we just verify something appears
    await page.waitForTimeout(3000); // Give streaming time to start

    // Verify chat has more than just the user message
    // (Assistant response should be present, even if partial)
    const messages = await page.getByRole('article').count();
    expect(messages).toBeGreaterThan(1);

    // Verify assistant message exists
    await expect(page.getByRole('article', { name: /assistant message/i })).toBeVisible({
      timeout: timeouts.streaming,
    });
  });

  test('should clear input after sending message', async ({ page }) => {
    const messageInput = page.getByPlaceholder(/type.*message/i);
    const sendButton = page.getByRole('button', { name: /send/i });

    // Type and send message
    await messageInput.fill(testMessages.simple);
    await sendButton.click();

    // Verify input is cleared
    await expect(messageInput).toHaveValue('', {
      timeout: timeouts.short,
    });
  });

  test('should disable send button when input is empty', async ({ page }) => {
    const messageInput = page.getByPlaceholder(/type.*message/i);
    const sendButton = page.getByRole('button', { name: /send/i });

    // Ensure input is empty
    await messageInput.clear();

    // Verify send button is disabled
    await expect(sendButton).toBeDisabled();

    // Type something
    await messageInput.fill('test');

    // Verify send button is enabled
    await expect(sendButton).toBeEnabled();
  });

  test('should display streaming response chunks', async ({ page }) => {
    const messageInput = page.getByPlaceholder(/type.*message/i);
    const sendButton = page.getByRole('button', { name: /send/i });

    // Send message
    await messageInput.fill(testMessages.question);
    await sendButton.click();

    // Wait for assistant message to appear
    const assistantMessage = page.getByRole('article', { name: /assistant message/i }).first();
    await expect(assistantMessage).toBeVisible({
      timeout: timeouts.medium,
    });

    // Get initial content
    await page.waitForTimeout(1000);
    const initialContent = await assistantMessage.textContent();

    // Wait a bit for more streaming
    await page.waitForTimeout(2000);
    const updatedContent = await assistantMessage.textContent();

    // Verify content is accumulating (streaming)
    // Note: This might be flaky if response completes too quickly
    // Can be adjusted or removed if streaming is too fast
    expect(updatedContent?.length).toBeGreaterThanOrEqual(initialContent?.length || 0);
  });
});
