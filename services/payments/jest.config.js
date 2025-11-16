import baseConfig from '../../jest.config.js';

const config = {
  ...baseConfig,
  rootDir: '../..',
  roots: ['<rootDir>/services/payments/src', '<rootDir>/services/payments/test'],
  collectCoverageFrom: ['<rootDir>/services/payments/src/**/*.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/services/payments/tsconfig.json',
      },
    ],
  },
};

export default config;
