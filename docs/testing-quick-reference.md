# Claude Dashboard Testing - Quick Reference Guide

## Quick Commands

### Running Tests

```bash
# Run all tests
npm test

# Frontend unit tests
npm run test:frontend

# Backend unit tests
npm run test:backend

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# With coverage
npm run test:coverage

# Watch mode (for development)
npm run test:watch

# Specific test file
npm test -- path/to/test.spec.ts
```

### Performance Testing

```bash
# Load test (local)
k6 run tests/performance/load-test.js

# Stress test
k6 run tests/performance/stress-test.js

# With results output
k6 run --out json=results.json tests/performance/load-test.js
```

### Security Testing

```bash
# Dependency scan
npm audit

# Snyk scan
snyk test

# OWASP ZAP scan (requires running app)
docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:5000
```

### Accessibility Testing

```bash
# Automated a11y tests
npm run test:a11y

# pa11y scan
pa11y http://localhost:5000

# axe-core in browser
# Open browser devtools -> Accessibility tab
```

## Test File Templates

### Frontend Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle click', async () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

### Backend Service Test

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MyService } from './my.service';

describe('MyService', () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it('should process data correctly', async () => {
    const result = await service.process({ data: 'test' });
    expect(result).toEqual({ processed: true });
  });
});
```

### E2E Test

```typescript
import { test, expect } from '@playwright/test';

test('user workflow', async ({ page }) => {
  await page.goto('/');
  await page.fill('[name=username]', 'test');
  await page.click('button[type=submit]');
  await expect(page).toHaveURL('/dashboard');
});
```

### Integration Test

```typescript
import request from 'supertest';
import { app } from '../app';

describe('API Integration', () => {
  it('should create resource', async () => {
    const response = await request(app)
      .post('/api/resource')
      .send({ name: 'test' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });
});
```

## Coverage Targets

| Metric | Minimum | Target | Critical Paths |
|--------|---------|--------|----------------|
| Statements | 80% | 85% | 100% |
| Branches | 75% | 80% | 100% |
| Functions | 80% | 85% | 100% |
| Lines | 80% | 85% | 100% |

## Common Testing Patterns

### Mocking API Calls

```typescript
// Vitest
vi.mock('../api', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mock' })
}));

// Jest
jest.mock('../api', () => ({
  fetchData: jest.fn().mockResolvedValue({ data: 'mock' })
}));
```

### Mocking Child Process

```typescript
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

vi.mock('child_process');

const mockProcess = new EventEmitter();
mockProcess.stdout = new EventEmitter();
mockProcess.stderr = new EventEmitter();

(spawn as any).mockReturnValue(mockProcess);
```

### Testing Async Code

```typescript
// Promise-based
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('success');
});

// Callback-based
it('should handle callback', (done) => {
  callbackFunction((err, result) => {
    expect(result).toBe('success');
    done();
  });
});
```

### Testing WebSocket

```typescript
import { io } from 'socket.io-client';

it('should receive websocket messages', (done) => {
  const client = io('http://localhost:5000');

  client.on('message', (data) => {
    expect(data).toBeDefined();
    client.disconnect();
    done();
  });

  client.emit('subscribe', 'test-channel');
});
```

### Testing with Testcontainers

```typescript
import { GenericContainer } from 'testcontainers';

beforeAll(async () => {
  const container = await new GenericContainer('postgres:15')
    .withEnvironment({ POSTGRES_PASSWORD: 'test' })
    .withExposedPorts(5432)
    .start();

  const port = container.getMappedPort(5432);
  // Use port for database connection
});
```

## Debugging Tests

### Debug in VSCode

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["run", "${file}"],
  "console": "integratedTerminal"
}
```

### Debug Playwright Tests

```bash
# Run with inspector
npx playwright test --debug

# Run headed (see browser)
npx playwright test --headed

# Run specific test
npx playwright test tests/e2e/login.spec.ts --debug
```

### View Test Coverage

```bash
# Generate coverage
npm run test:coverage

# Open coverage report
open coverage/index.html
```

## CI/CD Integration

### GitHub Actions Trigger

```yaml
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
```

### Quality Gate Checks

```yaml
- name: Check coverage
  run: |
    COVERAGE=$(cat coverage/summary.json | jq '.total.lines.pct')
    if (( $(echo "$COVERAGE < 80" | bc -l) )); then
      exit 1
    fi
```

## Best Practices

### DO's ✅

- Write tests alongside feature code
- Use descriptive test names
- Keep tests isolated and independent
- Mock external dependencies
- Test edge cases and error scenarios
- Use test factories for data generation
- Clean up resources after tests
- Run tests before committing

### DON'Ts ❌

- Don't share state between tests
- Don't test implementation details
- Don't write flaky tests
- Don't skip tests without good reason
- Don't commit failing tests
- Don't ignore test failures
- Don't test third-party libraries
- Don't write overly complex tests

## Performance Tips

### Optimize Test Execution

```typescript
// Run tests in parallel
test.concurrent('fast test 1', async () => {});
test.concurrent('fast test 2', async () => {});

// Skip slow tests in watch mode
test.skipIf(process.env.WATCH_MODE)('slow test', () => {});
```

### Reduce Test Setup Time

```typescript
// Use beforeAll for expensive setup
beforeAll(async () => {
  await setupDatabase();
});

// Use beforeEach only for test-specific setup
beforeEach(() => {
  mockClear();
});
```

### Mock Heavy Operations

```typescript
// Mock file system operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mock content'),
  writeFile: vi.fn().mockResolvedValue(undefined)
}));

// Mock network requests
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ data: 'mock' })
});
```

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout
it('slow test', async () => {
  // test code
}, 30000); // 30 second timeout

// Or globally
beforeAll(() => {
  jest.setTimeout(30000);
});
```

### Flaky Tests

```bash
# Run test multiple times
npm test -- --run --repeat-each=10

# Check for async issues
# Ensure all promises are awaited
# Ensure proper cleanup
```

### Coverage Not Accurate

```javascript
// Exclude files from coverage
coveragePathIgnorePatterns: [
  '/node_modules/',
  '/__tests__/',
  '/dist/'
]
```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Playwright Documentation](https://playwright.dev)
- [Jest Documentation](https://jestjs.io)
- [Testing Library](https://testing-library.com)
- [k6 Documentation](https://k6.io/docs)
- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref)

## Getting Help

1. Check test output for error messages
2. Review test documentation
3. Search for similar issues
4. Ask in team Slack channel
5. Pair with another developer
6. Review testing strategy document

---

**Last Updated**: 2025-10-05
**Maintained By**: QA Team
