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
      branches: 40,
      functions: 55,
      lines: 50,
      statements: 50,
    },
  },
};

export default config;
