#!/usr/bin/env node

/**
 * Launcher for Playwright MCP that discovers the Chrome CDP WebSocket URL
 * by hitting the /json/version endpoint with the correct Host header,
 * then spawns the actual Playwright MCP server with --cdp-endpoint pointing
 * to the discovered WebSocket URL (rewritten to use the K8s service hostname).
 */

import { spawn } from 'child_process';
import * as http from 'http';
import * as path from 'path';

const CDP_HOST = process.env.CDP_HOST || 'headless-chrome';
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);

function discoverWebSocketUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: CDP_HOST,
        port: CDP_PORT,
        path: '/json/version',
        headers: { Host: 'localhost' }, // Chrome requires Host: localhost
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const info = JSON.parse(data);
            // The returned URL uses "localhost" — rewrite to use the K8s service name
            const wsUrl = info.webSocketDebuggerUrl
              .replace('ws://localhost', `ws://${CDP_HOST}:${CDP_PORT}`)
              .replace(`ws://localhost:${CDP_PORT}`, `ws://${CDP_HOST}:${CDP_PORT}`);
            resolve(wsUrl);
          } catch (err) {
            reject(new Error(`Failed to parse CDP version response: ${data}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('CDP discovery timeout'));
    });
  });
}

async function main() {
  process.stderr.write(`[playwright-cdp-launcher] Starting, CDP_HOST=${CDP_HOST}, CDP_PORT=${CDP_PORT}\n`);
  let wsUrl: string;
  try {
    wsUrl = await discoverWebSocketUrl();
    process.stderr.write(`[playwright-cdp-launcher] Discovered WS URL: ${wsUrl}\n`);
  } catch (err) {
    // Fall back to HTTP endpoint if discovery fails
    wsUrl = `http://${CDP_HOST}:${CDP_PORT}`;
    process.stderr.write(`CDP discovery failed, using fallback: ${wsUrl}\n`);
  }

  const mcpPath = path.join(__dirname, '..', 'node_modules', '@playwright', 'mcp', 'cli.js');

  const child = spawn('node', [mcpPath, '--cdp-endpoint', wsUrl], {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => process.exit(code ?? 1));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
  process.on('SIGINT', () => child.kill('SIGINT'));
}

main().catch((err) => {
  process.stderr.write(`Playwright CDP launcher failed: ${err}\n`);
  process.exit(1);
});
