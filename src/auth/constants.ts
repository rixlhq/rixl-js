/**
 * Global constants for the auth library
 */

/** Prefix for all cookies and storage keys */
export const GLOBAL_PREFIX: string = "__rixl_auth";

/** How long a stored cookie lasts after it was last written */
export const COOKIE_LIFETIME_MS: number = 30 * 24 * 60 * 60 * 1000;

/** OAuth state storage key prefix */
export const STATE_STORAGE_KEY_PREFIX: string = GLOBAL_PREFIX + "_state_";
export const PKCE_STORAGE_KEY_PREFIX: string = GLOBAL_PREFIX + "_pkce_";

/** Social connect storage key prefix */
export const SOCIAL_CONNECT_KEY_PREFIX: string = GLOBAL_PREFIX + "_social_connect_";

type HttpStatusMap = Readonly<{
  ACCEPTED: number;
  BAD_REQUEST: number;
  UNAUTHORIZED: number;
  FORBIDDEN: number;
  NOT_FOUND: number;
  CONFLICT: number;
  TOO_MANY_REQUESTS: number;
  INTERNAL_SERVER_ERROR: number;
  BAD_GATEWAY: number;
}>;

/** HTTP Status codes - only codes actually used in the library */
export const HTTP_STATUS: HttpStatusMap = {
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
} as const;
