import {atom, type WritableAtom} from "nanostores";
import {refreshTokens} from "./api/refresh-tokens";
import {appleAuthUrl, AuthProvider, googleAuthUrl, telegramAuthUrl, microsoftAuthUrl} from "./providers";
import {initDeferred} from "./initialization";
import {initVals, readStoreCookies, setStoreCookie} from "./cookie";
import {user} from "./userStore";
import {clearPermissions} from "./permissionStore";
import type {ProviderType} from "./social/socialConnections";
import {decodeAndSetUser, isTokenExpired} from "./utils/jwt";
import {isLimitedScopeTokenResponse} from "./utils/requires-action";
import type {LoginErrorResponse} from "./auth/types";
import type {RequiresAction} from "./types";
import {shared} from "../shared-runtime";
import {ApiError} from "./api/types";
import {GLOBAL_PREFIX, HTTP_STATUS} from "./constants";
import {onLogoutElsewhere} from "./session-channel";

// Store for authentication state. Shared across copies of this package: a
// duplicate copy would otherwise hydrate its own tokens from the cookie and
// then silently diverge on the first refresh or logout.
//
// Seeded from the cookie only. An OAuth callback in the URL is not evidence of a
// session — the exchange can still fail — so consumers must await initClient()
// before reading this on a callback load rather than trusting an optimistic true.
export const isLogged: WritableAtom<boolean> = shared("isLogged", () => atom(initVals["isLogged"] === "true"));
export const accessToken: WritableAtom<string | undefined> = shared("accessToken", () => atom(initVals["accessToken"]));
export const refreshToken: WritableAtom<string | undefined> = shared("refreshToken", () => atom(initVals["refreshToken"]));
export const expireAt: WritableAtom<number> = shared("expireAt", () => atom(Number(initVals["expireAt"])));

// Store for OAuth/Telegram login errors (403, 409)
export const authError: WritableAtom<LoginErrorResponse | null> = shared("authError", () => atom<LoginErrorResponse | null>(null));

// Store for limited access state (Telegram user without email)
export const requiresAction: WritableAtom<RequiresAction> = shared("requiresAction", () =>
  atom<RequiresAction>((initVals["requiresAction"] as RequiresAction) || null)
);
export const limitedAccessToken: WritableAtom<string | null> = shared("limitedAccessToken", () =>
  atom<string | null>(initVals["limitedAccessToken"] || null)
);

// The in-flight getToken() call, so concurrent callers share one refresh.
// Shared across copies of this package: refresh tokens rotate, so two copies
// refreshing at once would have the slower one present a token the gateway has
// already retired, failing a refresh that should have succeeded.
const inFlight = shared("getTokenPromise", () => ({promise: null as Promise<string | undefined> | null}));

/**
 * Reset the current token promise (for testing purposes)
 * @internal
 */
export const resetTokenPromise = (): void => {
  inFlight.promise = null;
};

// Map providers to their auth URL atoms
const PROVIDER_URL_MAP: Partial<Record<ProviderType, WritableAtom<string | null>>> = {
  google: googleAuthUrl,
  apple: appleAuthUrl,
  microsoft: microsoftAuthUrl,
  telegram: telegramAuthUrl,
};

export const login = async (provider: ProviderType): Promise<void> => {
  await initDeferred.promise;

  const authUrlAtom = PROVIDER_URL_MAP[provider];
  if (!authUrlAtom) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  const authUrl = authUrlAtom.get();
  if (authUrl) {
    window.location.href = authUrl;
  } else {
    throw new Error(`${provider} provider is not configured. Please check your initClient configuration.`);
  }
};

const refreshAccessToken = async (refresh: string): Promise<void> => {
  const result = await refreshTokens(AuthProvider.BEARER, {token: refresh});
  if (!isLimitedScopeTokenResponse(result)) {
    setTokens(result.access_token, result.refresh_token, result.expires_in);
  }
};

const hasValidAccessToken = (): boolean => !!accessToken.get() && !isTokenExpired(expireAt.get());

/**
 * Takes up the session another tab stored after rotating the refresh token.
 * Each tab holds the tokens it read at load, and the gateway accepts a refresh
 * token only once, so presenting the stale copy would be rejected and the
 * resulting logout would clear the cookies every tab shares.
 * @returns Whether a newer session was adopted
 */
const adoptStoredSession = (): boolean => {
  const stored = readStoreCookies();
  const storedRefresh = stored["refreshToken"];
  if (!storedRefresh || storedRefresh === refreshToken.get()) return false;

  accessToken.set(stored["accessToken"] ?? "");
  refreshToken.set(storedRefresh);
  expireAt.set(Number(stored["expireAt"]));
  isLogged.set(true);
  return true;
};

const REFRESH_LOCK = `${GLOBAL_PREFIX}_refresh`;
// Requests have no timeout, so a tab whose refresh hangs would hold the lock and
// stall every other tab behind it.
const REFRESH_LOCK_WAIT_MS = 10_000;

/** Runs the refresh under a lock held across tabs, where the browser has one. */
const acrossTabs = async (task: () => Promise<void>): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.locks) return task();

  let granted = false;
  try {
    await navigator.locks.request(REFRESH_LOCK, {signal: AbortSignal.timeout(REFRESH_LOCK_WAIT_MS)}, () => {
      granted = true;
      return task();
    });
  } catch (error) {
    // Waited too long for the lock: refresh without it, as browsers without locks do.
    if (!granted && error instanceof DOMException && error.name === "TimeoutError") return task();
    throw error;
  }
};

const ensureValidAccessToken = async (): Promise<void> => {
  if (hasValidAccessToken()) return;

  await acrossTabs(async () => {
    // The tab that held the lock before this one may have just refreshed.
    adoptStoredSession();
    if (hasValidAccessToken()) return;

    const refresh = refreshToken.get();
    if (!refresh) return;

    try {
      await refreshAccessToken(refresh);
    } catch (refreshError) {
      console.error("Token refresh failed in getToken:", refreshError);
      // Without a lock, another tab can rotate the token while this request is in flight.
      if (adoptStoredSession()) return;
      if (isRejectedRefresh(refreshError)) removeTokens();
      throw refreshError;
    }
  });
};

/**
 * Whether the gateway refused the refresh token itself, which ends the session.
 * It answers 400 for an expired, invalid or already-used token and 401 for an
 * inactive account. A network failure, 429 or 5xx means the token could not be
 * checked, so the session is kept for the next getToken() to retry.
 */
const isRejectedRefresh = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.status === HTTP_STATUS.BAD_REQUEST || error.status === HTTP_STATUS.UNAUTHORIZED || error.status === HTTP_STATUS.FORBIDDEN);

export const getToken = async (): Promise<string | undefined> => {
  // If there's already a getToken operation in progress, return that promise
  if (inFlight.promise) {
    return inFlight.promise;
  }

  // Create a new promise for the getToken operation
  inFlight.promise = (async () => {
    try {
      // Wait for the library to be initialized
      await initDeferred.promise;

      // Users in limited-access flows should not receive full-scope tokens for protected calls
      if (requiresAction.get()) return undefined;

      adoptStoredSession();
      if (!refreshToken.get()) return undefined;

      await ensureValidAccessToken();

      const token = accessToken.get();
      if (token) {
        decodeAndSetUser(token);
      }

      return token;
    } catch (error) {
      console.warn("Failed to getToken(). Error: ", error);
      throw error;
    } finally {
      // Clear the promise reference when done
      inFlight.promise = null;
    }
  })();

  return inFlight.promise;
};
/**
 * Sets authentication tokens in the store
 * @param access The access token
 * @param refresh The refresh token
 * @param expiresIn The token expiration time in seconds
 */
export const setTokens = (access: string, refresh: string, expiresIn: number): void => {
  accessToken.set(access);
  refreshToken.set(refresh);
  expireAt.set(Date.now() + expiresIn * 1000);
  isLogged.set(true);

  // Clear limited access state when full tokens are set
  limitedAccessToken.set(null);
  requiresAction.set(null);

  // Clear any previous authentication errors after successful token set
  authError.set(null);

  // Decode and set user information
  decodeAndSetUser(access);
};

/**
 * Removes authentication tokens from the store
 */
export const removeTokens = (): void => {
  accessToken.set("");
  refreshToken.set("");
  expireAt.set(0);
  isLogged.set(false);
  user.set(undefined);
  clearPermissions();

  // Clear limited access state on logout
  limitedAccessToken.set(null);
  requiresAction.set(null);

  // Clear any existing auth errors to ensure a clean logout state
  authError.set(null);
};

/**
 * Clears the auth error from the store
 */
export const clearAuthError = (): void => {
  authError.set(null);
};

/**
 * Sets limited access state for users requiring additional action (e.g., Telegram users without email)
 * @param token The limited scope access token
 * @param action The required action (e.g., "add_email")
 */
export const setLimitedAccessState = (token: string, action: RequiresAction): void => {
  limitedAccessToken.set(token);
  requiresAction.set(action);
  authError.set(null); // Clear any previous auth errors
  isLogged.set(true); // User is logged in but with limited scope
};

/**
 * Clears the limited access state (after email verification completes or user logs out)
 */
export const clearLimitedAccessState = (): void => {
  limitedAccessToken.set(null);
  requiresAction.set(null);

  // If there are no full tokens, user should no longer be considered logged in
  const hasFullTokens = !!accessToken.get() && !!refreshToken.get();
  if (!hasFullTokens) {
    isLogged.set(false);
  }
};

// Persist state changes to cookies
isLogged.subscribe((value) => setStoreCookie("isLogged", value));
accessToken.subscribe((value) => setStoreCookie("accessToken", value));
refreshToken.subscribe((value) => setStoreCookie("refreshToken", value));
expireAt.subscribe((value) => setStoreCookie("expireAt", value));
requiresAction.subscribe((value) => setStoreCookie("requiresAction", value));
limitedAccessToken.subscribe((value) => setStoreCookie("limitedAccessToken", value));

// The other tabs share this session's cookies, so a logout in one ends it in all.
onLogoutElsewhere(removeTokens);
