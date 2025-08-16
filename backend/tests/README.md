# Integration Testing Suite

## Overview

This directory contains a comprehensive integration testing suite for the Pathfinder backend API. The tests cover authentication, authorization, security, compliance, performance, and all critical business logic.

## Test Structure

```
tests/
├── helpers/           # Test utilities and helpers
│   ├── database.js   # Database setup and teardown
│   ├── users.js      # User creation and authentication
│   ├── audit.js      # Audit logging helpers
│   └── email.js      # Email notification helpers
├── integration/      # Integration test suites
│   ├── auth.test.js                    # Authentication flows
│   ├── rbac.test.js                    # Role-based access control
│   ├── password-lifecycle.test.js      # Password management
│   ├── user-deletion.test.js           # User deletion and cooling-off
│   ├── site-admin-provisioning.test.js # Site admin workflows
│   ├── audit-logging.test.js           # Audit logging
│   ├── config-management.test.js       # Configuration APIs
│   ├── database-transactions.test.js   # Transaction handling
│   ├── api-versioning.test.js          # API version management
│   ├── security.test.js                # Security vulnerability tests
│   ├── compliance.test.js              # HIPAA/GDPR compliance
│   └── performance.test.js             # Performance and load tests
├── setup.js          # Test environment setup
├── globalSetup.js    # One-time setup before all tests
├── globalTeardown.js # Cleanup after all tests
├── jest.config.js    # Jest configuration
└── README.md         # This file
```

## Running Tests

### Prerequisites

1. **Oracle Database**: Tests require access to an Oracle database
2. **Environment Variables**: Copy `.env.test.example` to `.env.test` and configure:
   ```bash
   DB_USER=your_test_user
   DB_PASSWORD=your_test_password
   DB_CONNECTION_STRING=localhost:1521/XEPDB1
   ORACLE_INSTANT_CLIENT_PATH=/opt/oracle/instantclient
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

### Running All Tests

```bash
# Run all integration tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode (for development)
npm run test:watch
```

### Running Specific Test Suites

```bash
# Run authentication tests only
npm test -- auth.test.js

# Run security tests
npm test -- security.test.js

# Run compliance tests
npm test -- compliance.test.js

# Run performance tests
npm test -- performance.test.js
```

### Running Tests by Category

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run only e2e tests
npm run test:e2e
```

### Debugging Tests

```bash
# Run tests with verbose output
DEBUG_TESTS=true npm test

# Run specific test with node inspector
node --inspect-brk ./node_modules/.bin/jest auth.test.js

# Run with silent mode (minimal output)
SILENT_TESTS=true npm test
```

## Test Coverage

The test suite aims for comprehensive coverage of all critical paths:

- **Authentication & Authorization**: 95%+ coverage
- **RBAC Permissions**: 90%+ coverage
- **Security Vulnerabilities**: All OWASP Top 10 covered
- **Compliance (HIPAA/GDPR)**: All requirements tested
- **Performance**: Load testing, concurrent operations, response times
- **Data Integrity**: Transaction handling, audit logging

### Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Test Data Management

### Test User Hierarchy

The test suite uses a predefined user hierarchy:

- **Site Admin**: Full system access
- **Admin1/Admin2**: Organization-level admin access
- **User1/User2**: Standard user access
- **Regular User**: Basic user for general testing

### Database Isolation

- Tests use a separate test database/schema
- Each test suite cleans up after itself
- Test data is prefixed with `test_` for easy identification
- Automatic cleanup in `globalTeardown.js`

## Writing New Tests

### Test Template

```javascript
const request = require('supertest');
const app = require('../../src/api/app');
const { 
  setupTestDatabase, 
  cleanupTestDatabase, 
  clearTestData 
} = require('../helpers/database');
const { 
  generateTestUsers,
  loginAs
} = require('../helpers/users');

describe('Feature Name', () => {
  let testUsers;
  let testApp;

  beforeAll(async () => {
    await setupTestDatabase();
    testApp = app.getExpressApp();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
    testUsers = await generateTestUsers();
  });

  describe('Specific Functionality', () => {
    test('Should do something', async () => {
      const token = await loginAs(testUsers.regularUser);
      
      const response = await request(testApp)
        .get('/api/endpoint')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
    });
  });
});
```

### Best Practices

1. **Use Test Helpers**: Leverage the helper functions for common operations
2. **Clean State**: Always clean up test data in `beforeEach` or `afterEach`
3. **Descriptive Names**: Use clear, descriptive test names
4. **Test Isolation**: Each test should be independent
5. **Error Cases**: Test both success and failure scenarios
6. **Async Handling**: Properly handle async operations with async/await

## Performance Testing

### Load Testing Scenarios

The performance test suite includes:

- **Concurrent User Registration**: 50+ simultaneous registrations
- **Login Storm**: Multiple concurrent login attempts
- **Data Access**: Parallel read operations
- **Stress Testing**: Sustained load over time
- **Response Time SLAs**: P50 < 100ms, P95 < 500ms, P99 < 1s

### Running Performance Tests

```bash
# Run performance tests only
npm test -- performance.test.js

# Run with memory profiling
node --expose-gc npm test -- performance.test.js
```

## Security Testing

### Vulnerability Coverage

- SQL Injection Prevention
- XSS (Cross-Site Scripting) Protection
- CSRF Protection
- Rate Limiting
- Session Security
- Password Security
- Input Validation
- Error Message Sanitization

### Security Test Execution

```bash
# Run security tests
npm test -- security.test.js

# Run with security audit
npm run test:security-audit
```

## Compliance Testing

### HIPAA Compliance Tests

- PHI encryption at rest
- PHI access logging
- Minimum necessary access
- Business Associate Agreement tracking

### GDPR Compliance Tests

- Right to access (data export)
- Right to erasure (account deletion)
- Right to rectification (data updates)
- Data portability
- Consent management
- Breach notification capability

## CI/CD Integration

### GitHub Actions

```yaml
name: Integration Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### Pre-commit Hooks

```bash
# Install pre-commit hooks
npm run install:hooks

# Run tests before commit
npm run precommit
```

## Troubleshooting

### Common Issues

1. **Oracle Connection Errors**
   - Verify Oracle Instant Client is installed
   - Check database connection string
   - Ensure test user has proper permissions

2. **Test Timeouts**
   - Increase timeout in jest.config.js
   - Check for unresolved promises
   - Verify database queries are optimized

3. **Flaky Tests**
   - Use retry logic for network operations
   - Ensure proper test isolation
   - Check for race conditions

4. **Memory Issues**
   - Run tests with `--maxWorkers=1`
   - Use `--forceExit` flag
   - Check for memory leaks with `--detectLeaks`

## Support

For issues or questions about the test suite:

1. Check this README first
2. Review existing test examples
3. Contact the development team
4. File an issue in the project repository