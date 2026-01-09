/**
 * Jest Test Setup File
 * CSE 470 - Software Quality Assurance
 * 
 * This file runs before each test suite to configure the test environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-unit-testing';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global setup before all tests
beforeAll(async () => {
    console.log('\n🧪 Starting Test Suite...\n');
});

// Global teardown after all tests
afterAll(async () => {
    console.log('\n✅ Test Suite Completed\n');
    
    // Close any open connections
    // This helps prevent Jest from hanging
    await new Promise(resolve => setTimeout(resolve, 500));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
