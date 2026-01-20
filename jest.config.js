module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    testMatch: [
        '**/tests/unit/**/*.test.js',
        '**/tests/integration/**/*.test.js'
    ],
    // Ignore e2e for standard jest run, as playwright has its own runner
    testPathIgnorePatterns: ['/node_modules/', '/tests/e2e/']
};
