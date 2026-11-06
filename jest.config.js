const tsJest = {
  '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', esModuleInterop: true, module: 'commonjs', moduleResolution: 'node10', skipLibCheck: true, strict: true, target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], types: ['node', 'jest', '@testing-library/jest-dom'], isolatedModules: true }, diagnostics: false }]
};

export default {
  projects: [
    {
      displayName: 'backend',
      testEnvironment: 'node',
      roots: ['<rootDir>/src/backend', '<rootDir>/src/shared'],
      testMatch: ['**/__tests__/**/*.test.ts'],
      setupFiles: ['<rootDir>/src/frontend/__tests__/env.ts'],
      transform: tsJest
    },
    {
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      roots: ['<rootDir>/src/frontend'],
      testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
      setupFiles: ['<rootDir>/src/frontend/__tests__/env.ts'],
      setupFilesAfterEnv: ['<rootDir>/src/frontend/__tests__/setup.ts'],
      transform: tsJest
    }
  ]
};
