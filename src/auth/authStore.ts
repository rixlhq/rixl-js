import {atom, type WritableAtom} from "nanostores";
import {accessToken, expireAt, isLogged, refreshToken} from "./token-atoms";
import {adoptStoredRefreshToken, forgetSignIn, storeRefreshToken} from "./stored-sign-in";
import {rotateRefreshToken} from "./refresh-rotation";
import {appleAuthUrl, googleAuthUrl, telegramAuthUrl, microsoftAuthUrl, githubAuthUrl} from "./providers";
import {initDeferred} from "./initialization";
import {initVals, setStoreCookie} from "./cookie";
import {user} from "./userStore";
import {clearPermissions} from "./permissionStore";
import type {ProviderType} from "./social/socialConnections";
import {decodeAndSetUser, isTokenExpired} from "./utils/jwt";
import type {LoginErrorResponse} from "./auth/types";
import type {RequiresAction} from "./types";
import {shared} from "../shared-runtime";
import {ApiError} from "./api/types";
import {HTTP_STATUS} from "./constants";
import {onLogoutElsewhere} from "./logout-channel";
import {
  adoptTokenOrg,
  dropRefusedOrg,
  forgetTabOrg,
  lastActiveOrgId,
  getLeftOrg,
  getLostOrg,
  orgContext,
  tabOrgId,
  tabSignIn,
} from "./tab-org";
import {browserSignIn, currentSignIn, isCurrentSignIn, personalOrgId, renewSignInCookies, signInMarker} from "./sign-in-cookies";
import {OrgAccessError} from "./api/org-access-error";
import {serializeRefresh} from "./refresh-lock";
import {logout} from "./auth/logout";
import {invalidateSignInContext} from "./sign-in-context";
import {commit} from "./store-commit";

export {isLogged, accessToken, refreshToken, expireAt};

// Helper to ensure multi-tab sign-out synchronization is attached once per realm
const ensureLogoutSync = (): void => {
  shared("logoutSyncInitialized", () => {
    onLogoutElsewhere((signIn) => {
      if ((signInMarker.get() ?? tabSignIn.get()) === signIn) clearLocalSignIn();
    });
    return true;
  });
};
ensureLogoutSync();

// Store for OAuth/Telegram login errors (403, 409)
export const authError: WritableAtom<LoginErrorResponse | null> = shared("authError", () => atom<LoginErrorResponse | null>(null));

// Store for limited access state (Telegram user without email)
export const requiresAction: WritableAtom<RequiresAction> = shared("requiresAction", () => {
  const store = atom<RequiresAction>((initVals["requiresAction"] as RequiresAction) || null);
  store.subscribe((value) => setStoreCookie("requiresAction", value));
  return store;
});
export const limitedAccessToken: WritableAtom<string | null> = shared("limitedAccessToken", () => {
  const store = atom<string | null>(initVals["limitedAccessToken"] || null);
  store.subscribe((value) => setStoreCookie("limitedAccessToken", value));
  return store;
});

// The in-flight getToken() call, so concurrent callers share one refresh.
// Shared across copies of this package: refresh tokens rotate, so two copies
// refreshing at once would have the slower one present a token the gateway has
// already retired, failing a refresh that should have succeeded.
const inFlight = shared("signInTokenRequest", () => ({
  current: undefined as {signIn: string | undefined; promise: Promise<string | undefined>} | undefined,
}));

/** @internal */
export const resetTokenPromise = (): void => {
  inFlight.current = undefined;
};

const getProviderUrlAtom = (provider: ProviderType): WritableAtom<string | null> | undefined => {
  switch (provider) {
    case "google":
      return googleAuthUrl;
    case "apple":
      return appleAuthUrl;
    case "microsoft":
      return microsoftAuthUrl;
    case "telegram":
      return telegramAuthUrl;
    case "github":
      return githubAuthUrl;
    default:
      return undefined;
  }
};

export const login = async (provider: ProviderType): Promise<void> => {
  await initDeferred.promise;

  const authUrlAtom = getProviderUrlAtom(provider);
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

const TOKEN_PATH = "/auth/v1/token";

const hasValidAccessToken = (): boolean => !!accessToken.get() && !isTokenExpired(expireAt.get());

const refreshOrSignOut = (orgId: string, explicitSelection = false): Promise<boolean> =>
  rotateRefreshToken(
    {
      orgId,
      signIn: signInMarker.get(),
      tabOrg: tabOrgId.get(),
      explicitSelection,
    },
    dropTokens
  );

/**
 * Takes up the stored sign-in and says whether this tab can use it. A refresh
 * names an org, so a refresh token with no org to name, because the cookies it
 * came with are gone, can never be used. Such a sign-in is ended, since nothing
 * else would ever report it dead.
 */
const hasUsableSignIn = (): boolean => {
  adoptStoredRefreshToken();
  if (!refreshToken.get()) return false;
  if (tabOrgId.get() || personalOrgId.get() || getLostOrg() || getLeftOrg()) return true;

  removeTokens();
  return false;
};

/**
 * The org a getToken() refresh names: the tab's own, or the sign-in's for a tab
 * that never had one. A tab that lost its org has neither until the caller
 * selects one.
 */
const orgToRefresh = (): string => {
  const lost = getLostOrg();
  if (lost) throw new OrgAccessError(lost, {status: HTTP_STATUS.FORBIDDEN, endpoint: TOKEN_PATH, data: {reason: lost.reason}});

  // hasUsableSignIn() ran first, so a tab that lost no org has one of the two.
  return (tabOrgId.get() ?? personalOrgId.get())!;
};

// Only getToken() drops a refused org: a refused selectOrganization() leaves the tab as it was.
const refreshTabOrg = async (): Promise<void> => {
  const orgId = orgToRefresh();
  const signIn = signInMarker.get();
  try {
    await refreshOrSignOut(orgId);
  } catch (error) {
    if (error instanceof OrgAccessError && isCurrentSignIn(signIn) && getLeftOrg() !== orgId) dropRefusedOrg(error);
    throw error;
  }
};

const ensureValidAccessToken = async (signIn: string | undefined): Promise<void> => {
  if (hasValidAccessToken()) return;

  await serializeRefresh(signIn, async () => {
    // The refresh that ran before this one may have just issued a token.
    if (!hasUsableSignIn() || signInMarker.get() !== signIn || getLeftOrg() || hasValidAccessToken()) return;

    try {
      await refreshTabOrg();
    } catch (refreshError) {
      console.error("Token refresh failed in getToken:", refreshError);
      throw refreshError;
    }
  });
};

export const getToken = async (): Promise<string | undefined> => {
  await initDeferred.promise;
  if (requiresAction.get() || !hasUsableSignIn() || getLeftOrg()) return undefined;

  const signIn = signInMarker.get();
  const pending = inFlight.current;
  if (pending && pending.signIn === signIn) return pending.promise;

  const promise = ensureValidAccessToken(signIn).then(() => {
    if (signInMarker.get() !== signIn) return undefined;
    const token = accessToken.get();
    if (token) decodeAndSetUser(token);
    return token;
  });
  inFlight.current = {signIn, promise};

  try {
    return await promise;
  } finally {
    if (inFlight.current?.promise === promise) inFlight.current = undefined;
  }
};

/**
 * Moves this tab to `orgId` by refreshing into it. Other tabs keep their orgs.
 * An org refusal of the requested org leaves the current selection alone.
 * A final refresh 401 ends the sign-in. A concurrent sign-in or org change can reject with ApiError.
 */
export const selectOrganization = async (orgId: string): Promise<void> => {
  await initDeferred.promise;
  if (!orgId) throw new Error("selectOrganization() needs an organization ID");

  adoptStoredRefreshToken();
  const signIn = signInMarker.get();
  await serializeRefresh(signIn, async () => {
    if (!hasUsableSignIn()) {
      throw new ApiError("Sign in before selecting an organization", HTTP_STATUS.UNAUTHORIZED, TOKEN_PATH);
    }
    if (signInMarker.get() !== signIn) {
      throw new ApiError("The sign-in changed before selecting the organization", HTTP_STATUS.CONFLICT, TOKEN_PATH);
    }
    if (!(await refreshOrSignOut(orgId, true))) {
      throw new ApiError("The organization was not selected: the account needs another action first", HTTP_STATUS.CONFLICT, TOKEN_PATH);
    }
  });
};

/**
 * Sets authentication tokens in the store
 * @param access The access token
 * @param refresh The refresh token
 * @param expiresIn The token expiration time in seconds
 */
export const setTokens = (access: string, refresh: string, expiresIn: number): void =>
  commit(() => {
    adoptTokenOrg(access);
    accessToken.set(access);
    expireAt.set(Date.now() + expiresIn * 1000);
    storeRefreshToken(refresh);
    isLogged.set(true);

    // Clear limited access state when full tokens are set
    limitedAccessToken.set(null);
    requiresAction.set(null);

    // Clear any previous authentication errors after successful token set
    authError.set(null);

    // Decode and set user information
    decodeAndSetUser(access);
  });

/**
 * Drops the tokens, and keeps which sign-in they were and the org the tab was
 * on. A rotation that turns out to have kept that sign-in alive finds the tab
 * where it was.
 */
const dropTokens = (): void => {
  invalidateSignInContext();
  resetTokenPromise();
  accessToken.set("");
  refreshToken.set("");
  expireAt.set(0);
  isLogged.set(false);
  user.set(undefined);
  clearPermissions();
  orgContext.set(undefined);

  // Clear limited access state on logout
  limitedAccessToken.set(null);
  requiresAction.set(null);

  // Clear any existing auth errors to ensure a clean logout state
  authError.set(null);
};

const clearLocalSignIn = (): void =>
  commit(() => {
    dropTokens();
    forgetTabOrg();
    forgetSignIn();
    tabSignIn.set(undefined);
    lastActiveOrgId.set(undefined);
  });

/** Ends the browser's sign-in. Callers may announce explicit logout to other tabs. */
export const removeTokens = (): void =>
  commit(() => {
    clearLocalSignIn();
    setStoreCookie("refreshToken", "");
    renewSignInCookies(false);
    // Written by releases before the access token became tab-local. Signed out, no access token may stay in the browser.
    setStoreCookie("accessToken", "");
    setStoreCookie("expireAt", "");
  });

/** Ends only the sign-in that this logout started with. */
export const endSignIn = (signIn: string | undefined): boolean => {
  if (browserSignIn() === signIn) {
    removeTokens();
    return true;
  }
  if (signInMarker.get() === signIn || (signIn && tabSignIn.get() === signIn)) {
    clearLocalSignIn();
    return true;
  }
  return false;
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
export const setLimitedAccessState = (token: string, action: RequiresAction): void =>
  commit(() => {
    if (currentSignIn()) void logout();
    else removeTokens();
    limitedAccessToken.set(token);
    requiresAction.set(action);
    isLogged.set(true);
    setStoreCookie("isLogged", true);
  });

/**
 * Clears the limited access state (after email verification completes or user logs out)
 */
export const clearLimitedAccessState = (): void => {
  limitedAccessToken.set(null);
  requiresAction.set(null);

  // If there are no full tokens, user should no longer be considered logged in
  if (!refreshToken.get()) {
    isLogged.set(false);
    setStoreCookie("isLogged", false);
  }
};
