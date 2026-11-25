import {ApiError} from "./types";
import {OrgAccessError} from "./org-access-error";
export {ApiError};

/**
 * Standard error handler for API errors with custom status code handling
 */
export const handleApiError = (error: unknown, statusHandlers: Record<number, () => Error>): never => {
  // The request never left: the tab's org is unavailable. A status handler's
  // message would blame the endpoint, so the caller gets the reason itself.
  if (error instanceof OrgAccessError) throw error;

  if (error instanceof ApiError) {
    const handler = statusHandlers[error.status];
    if (handler) {
      throw new ApiError(handler().message, error.status, error.endpoint, error.data);
    }
    throw error;
  }
  throw error;
};
