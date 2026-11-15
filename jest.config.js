// Configuración de Jest: pruebas unitarias (tests/unit) y de rutas con MongoDB real (tests/rutas)
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  testTimeout: 30000,
  clearMocks: true,
  restoreMocks: true,
};
