import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  envDir: '../../../',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts', './test/axios-setup.ts'],
    include: ['**/*.integration.test.{ts,tsx}'],
    exclude: ['node_modules'],
    testTimeout: 60000, // Integration tests need more time for real backend calls
    silent: true, // Suppress stdout/stderr from application code
    pool: 'forks', // Use forks instead of threads to avoid DataCloneError with axios config
    poolOptions: {
      forks: {
        singleFork: true, // Run all tests in single fork to avoid clone errors
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
