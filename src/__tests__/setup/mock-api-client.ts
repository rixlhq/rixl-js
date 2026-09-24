/**
 * API Client Mock Factory
 *
 * USAGE IN TEST FILES:
 * ```typescript
 * import {vi} from "vitest";
 * import {createApiClientMock} from "../setup/mock-api-client";
 *
 * // Call the factory directly inside vi.mock() - this works!
 * vi.mock("@/api/client", () => createApiClientMock());
 * ```
 */

import {vi} from "vite-plus/test";

/**
 * Creates a standardized API client mock
 *
 * @returns Mock implementation for the API client module
 */
// Define ApiError class outside the function for type reference
class ApiErrorClass extends Error {
  constructor(
    message: string,
    public status: number,
    public endpoint: string,
    public data?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createApiClientMock(): {
  publicFetch: ReturnType<typeof vi.fn>;
  authenticatedFetch: ReturnType<typeof vi.fn>;
  ApiError: typeof ApiErrorClass;
  handleApiError: (error: unknown, statusHandlers: Record<number, () => Error>) => never;
  err: (message: string) => () => Error;
  commonErrors: {
    unauthorized: () => Error;
    badRequest: () => Error;
    notFound: () => Error;
    conflict: () => Error;
    forbidden: () => Error;
    tooManyRequests: () => Error;
  };
} {
  const ApiError = ApiErrorClass;

  return {
    publicFetch: vi.fn(),
    authenticatedFetch: vi.fn(),
    ApiError,
    handleApiError: (error: unknown, statusHandlers: Record<number, () => Error>): never => {
      if (error instanceof ApiError) {
        const handler = statusHandlers[error.status];
        if (handler) {
          throw handler();
        }
        throw error;
      }
      throw error;
    },
    err: (message: string) => () => new Error(message),
    commonErrors: {
      unauthorized: () => new Error("User is not authorized"),
      badRequest: () => new Error("Bad request"),
      notFound: () => new Error("Not found"),
      conflict: () => new Error("Resource already exists"),
      forbidden: () => new Error("Forbidden"),
      tooManyRequests: () => new Error("Too many requests"),
    },
  };
}
