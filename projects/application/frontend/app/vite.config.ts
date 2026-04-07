import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  // @ts-expect-error - Vite/Vitest version mismatch in plugin types (known issue, doesn't affect build)
  plugins: [react()],
  envDir: '../../../', // Points to repo root (relative to this config file)
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/*.integration.test.{ts,tsx}', 'node_modules'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.integration.test.{ts,tsx}',
        'test/**',
        'src/main.tsx'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@test": path.resolve(__dirname, "./test"),
    },
  },
  server: {
    // Listen on all interfaces so Tailscale devices can reach the dev server
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '3000'),
    proxy: {
      // Health check endpoint for development
      '/health': {
        target: 'http://localhost',
        changeOrigin: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            if (req.url === '/health') {
              proxyReq.destroy();
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('healthy\n');
            }
          });
        }
      }
    }
  },
  preview: {
    port: parseInt(process.env.PORT || '3000'),
    host: true,
  },
})
