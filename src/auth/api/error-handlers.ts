import {ApiError} from "./types";
export {ApiError};

/**
 * Standard error handler for API errors with custom status code handling
 */
export const handleApiError = (error: unknown, statusHandlers: Record<number, () => Error>): never => {
  if (error instanceof ApiError) {
    const handler = statusHandlers[error.status];
    if (handler) {
      throw new ApiError(handler().message, error.status, error.endpoint, error.data);
    }
    throw error;
  }
  throw error;
};
