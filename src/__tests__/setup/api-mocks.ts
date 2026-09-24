import {vi} from "vite-plus/test";
import {ApiError} from "../../auth/api/types";

export const mockPublicFetch = vi.fn();
export const mockAuthenticatedFetch = vi.fn();

export const mockHandleApiError = vi.fn((error: unknown, statusHandlers: Record<number, () => Error>): never => {
  if (error instanceof ApiError) {
    const handler = statusHandlers[error.status];
    if (handler) {
      throw handler();
    }
    throw error;
  }
  throw error as any;
});

export {ApiError};
