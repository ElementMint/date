import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@dom/(.*)$': '<rootDir>/src/dom/$1',
    '^@features/(.*)$': '<rootDir>/src/features/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/adapters/**',
    '!src/browser.ts',
  ],
  coverageThreshold: {
    global: {
      // Keep CI honest while matching the current initial-release baseline.
      branches: 50,
      functions: 60,
      lines: 65,
      statements: 65,
    },
  },
};

export default config;
