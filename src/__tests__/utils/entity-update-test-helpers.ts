/**
 * Shared test utilities for entity update tests
 * Provides reusable patterns for testing updateEntityField and performOTPOperation
 */

import {vi, beforeEach, afterEach} from "vite-plus/test";
import * as initialization from "@/initialization";
import {ApiError} from "../../auth/api/types";
import {HTTP_STATUS} from "@/constants.ts";

/**
 * Sets up common mocks for entity update tests
 * @deprecated Use useEntityUpdateTest instead for cleaner setup
 */
export const setupEntityUpdateTest = (authStore: any) => {
  vi.clearAllMocks();
  initialization.initDeferred.promise = Promise.resolve();

  const mockGetToken = vi.spyOn(authStore, "getToken").mockResolvedValue("mock-token");
  const mockSetTokens = vi.spyOn(authStore, "setTokens").mockImplementation(() => {});

  return {mockGetToken, mockSetTokens};
};

/**
 * Hook to manage test lifecycle for entity updates.
 * Call this at the top of your describe block.
 */
export const useEntityUpdateTest = (authStore: any) => {
  const mocks = {
    mockGetToken: undefined as any,
    mockSetTokens: undefined as any,
  };

  beforeEach(() => {
    const m = setupEntityUpdateTest(authStore);
    mocks.mockGetToken = m.mockGetToken;
    mocks.mockSetTokens = m.mockSetTokens;
  });

  afterEach(() => {
    mocks.mockGetToken?.mockRestore();
    mocks.mockSetTokens?.mockRestore();
  });

  return mocks;
};

/**
 * Helper to create an ApiError with a specific status code
 * Eliminates repetitive error creation in tests
 */
export const createApiError = (status: number, endpoint = "/endpoint") => {
  const messages: Record<number, string> = {
    [HTTP_STATUS.BAD_REQUEST]: "Bad Request",
    [HTTP_STATUS.UNAUTHORIZED]: "Unauthorized",
    [HTTP_STATUS.FORBIDDEN]: "Forbidden",
    [HTTP_STATUS.NOT_FOUND]: "Not Found",
    [HTTP_STATUS.CONFLICT]: "Conflict",
    [HTTP_STATUS.TOO_MANY_REQUESTS]: "Too Many Requests",
    [HTTP_STATUS.ACCEPTED]: "Accepted",
  };

  return new ApiError(messages[status] || "Error", status, endpoint);
};
