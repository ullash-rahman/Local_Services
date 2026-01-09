/**
 * Jest Configuration for Backend Unit Tests
 * CSE 470 - Software Quality Assurance
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.test.ts'
    ],
    
    // Test timeout (30 seconds for API tests)
    testTimeout: 30000,
    
    // Verbose output for detailed test results
    verbose: true,
    
    // Force exit after tests complete
    forceExit: true,
    
    // Detect open handles
    detectOpenHandles: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Coverage configuration (optional)
    collectCoverageFrom: [
        'controllers/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**'
    ],
    
    // Setup files
    setupFilesAfterEnv: ['./tests/setup.js'],
    
    // Module paths
    moduleDirectories: ['node_modules', 'src'],
    
    // Transform configuration
    transform: {},
    
    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/'
    ]
};
