/**
 * AuthStore Mock Factory
 *
 * Provides individual factory functions for each module that needs mocking.
 * Each function can be called directly inside vi.mock() to avoid hoisting issues.
 */

import {vi} from "vite-plus/test";

/**
 * Creates mock for the api module
 * Usage: vi.mock("../../auth/api", () => createApiMock());
 */
export function createApiMock(): {refreshTokens: ReturnType<typeof vi.fn>} {
  return {
    refreshTokens: vi.fn(),
  };
}

/**
 * Creates mock for the providers module
 * Usage: vi.mock("../../auth/providers", () => createProvidersMock());
 */
export function createProvidersMock(): {
  appleAuthUrl: {get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>};
  googleAuthUrl: {get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>};
  microsoftAuthUrl: {get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>};
  telegramAuthUrl: {get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>};
  AuthProvider: {BEARER: string};
} {
  return {
    appleAuthUrl: {get: vi.fn(() => "https://apple.com/auth"), set: vi.fn()},
    googleAuthUrl: {get: vi.fn(() => "https://google.com/auth"), set: vi.fn()},
    microsoftAuthUrl: {get: vi.fn(() => "https://microsoft.com/auth"), set: vi.fn()},
    telegramAuthUrl: {get: vi.fn(() => "https://telegram.com/auth"), set: vi.fn()},
    AuthProvider: {BEARER: "bearer"},
  };
}

/**
 * Creates mock for the cookie module
 * Usage: vi.mock("../../auth/cookie", () => createCookieMock());
 */
export function createCookieMock(): {
  initVals: Record<string, never>;
  setStoreCookie: ReturnType<typeof vi.fn>;
} {
  return {
    initVals: {},
    setStoreCookie: vi.fn(),
  };
}

/**
 * Usage in test files:
 *
 * ```typescript
 * import {createApiMock, createProvidersMock, createCookieMock} from "../setup/authstore-mock-factory";
 *
 * vi.mock("../../auth/api", () => createApiMock());
 * vi.mock("../../auth/providers", () => createProvidersMock());
 * vi.mock("../../auth/cookie", () => createCookieMock());
 * ```
 */
