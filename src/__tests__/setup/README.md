# Test Setup Utilities

This directory contains reference templates and documentation for test mocking patterns.

## Important: Vitest Hoisting Limitation

**TL;DR:** The 33-line API client mock MUST be inlined in each test file. This duplication is unavoidable due to vitest's design.

### Why Duplication is Unavoidable

Vitest hoists `vi.mock()` calls to run BEFORE all imports. This means:

- ❌ Cannot import and call `createApiClientMock()` inside `vi.mock()`
- ❌ Cannot import constant `API_CLIENT_MOCK` and use it
- ❌ Cannot define `const` in same file and use it (gets hoisted separately)
- ❌ `vi.hoisted()` doesn't solve the problem for our use case

**This is a vitest limitation, not a code quality issue.**

## Available Utilities

### `mock-api-client.ts`

**Purpose:** Reference template for API client mocking.

⚠️ **IMPORTANT:** Do NOT import from this file into `vi.mock()` calls. Copy the mock code instead.

**How to use:**

1. Open `mock-api-client.ts`
2. Copy the commented template code
3. Paste it into your test file after vitest imports
4. Adjust the import path as needed (`"../../api/client"` or `"@/api/client"`)

**Why this approach:**

- Ensures consistency across all test files (same mock structure)
- Provides single source of truth for documentation
- Makes updates easier (update template, then copy to test files)
- Avoids vitest hoisting issues

### Template Example

```typescript
// At top of test file, after imports from 'vite-plus/test'
vi.mock("../../api/client", () => {
  const ApiError = class ApiError extends Error {
    // ... 33 lines of mock code ...
  };
  return {/* mock exports */};
});
```

## Best Practices

1. **Copy the template** from `mock-api-client.ts` - don't rewrite it
2. **Keep mocks consistent** - all test files should have identical mock structure
3. **Document unusual behavior** - add comments if your test needs special mock setup
4. **Update template first** - when API changes, update the template then propagate to test files
5. **Accept the duplication** - it's unavoidable with vitest's architecture
