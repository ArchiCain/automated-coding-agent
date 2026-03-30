module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'test',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(jose|@mastra|@sindresorhus|escape-string-regexp|p-map|aggregate-error|clean-stack|indent-string)/)',
  ],
  testEnvironment: 'node',
  testTimeout: 60000, // Increased timeout for integration tests with real services
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
  },
  forceExit: true, // Force exit after tests (handles lingering connections)
};
