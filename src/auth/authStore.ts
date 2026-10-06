import {atom, type WritableAtom} from "nanostores";
import {refreshTokens} from "./api/refresh-tokens";
import {appleAuthUrl, AuthProvider, googleAuthUrl, telegramAuthUrl, microsoftAuthUrl} from "./providers";
import {initDeferred} from "./initialization";
import {initVals, setStoreCookie} from "./cookie";
import {user} from "./userStore";
import {clearPermissions} from "./permissionStore";
import type {ProviderType} from "./social/socialConnections";
import {decodeAndSetUser, isTokenExpired} from "./utils/jwt";
import {isLimitedScopeTokenResponse} from "./utils/requires-action";
import type {LoginErrorResponse} from "./auth/types";
import type {RequiresAction} from "./types";
import {shared} from "../shared-runtime";

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
  const result = await refreshTokens(AuthProvider.BEARER, refresh);
  if (!isLimitedScopeTokenResponse(result)) {
    setTokens(result.access_token, result.refresh_token, result.expires_in);
  }
};

const ensureValidAccessToken = async (refresh: string): Promise<void> => {
  const currentAccessToken = accessToken.get();
  if (currentAccessToken && !isTokenExpired(expireAt.get())) {
    return;
  }

  try {
    await refreshAccessToken(refresh);
  } catch (refreshError) {
    // If refresh fails, we should consider the user logged out
    console.error("Token refresh failed in getToken:", refreshError);
    removeTokens();
    throw refreshError;
  }
};

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

      const currentRefreshToken = refreshToken.get();
      if (!currentRefreshToken) return undefined;

      await ensureValidAccessToken(currentRefreshToken);

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
