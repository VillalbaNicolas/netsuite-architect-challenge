module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: { '^N/(.*)$': '<rootDir>/__tests__/stubs/$1.js' },
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/stubs/', '/__tests__/helpers/'],
};
