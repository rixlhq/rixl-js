/**
 * Keeps a tab in step with the sign-in the browser holds. Another tab may have
 * rotated its refresh token, or signed in again, as the same user or another.
 */
import {invalidateSignInContext} from "./sign-in-context";
import {commit} from "./store-commit";
import {readStoreCookies, setStoreCookie} from "./cookie";
import {user} from "./userStore";
import {clearPermissions} from "./permissionStore";
import {forgetTabOrg, lastActiveOrgId, tabSignIn} from "./tab-org";
import {
  adoptSignIn,
  currentSignIn,
  deleteRefusedSignIn,
  isCurrentSignIn,
  isRefusedSignIn,
  recordSignIn,
  renewSignInCookies,
  signInMarker,
} from "./sign-in-cookies";
import {accessToken, expireAt, isLogged, refreshToken} from "./token-atoms";
import {isTokenExpired} from "./utils/jwt";

const takeNewerRefreshToken = (): void => {
  const stored = readStoreCookies();
  // Read even with nothing to compare: a tab that loaded signed out has to remember a marker it takes up here.
  const current = currentSignIn(stored);
  if (signInMarker.get() && !current) {
    // A refused sign-in is kept for now: a rotation still on its way back may prove it alive.
    if (isRefusedSignIn(signInMarker.get(), stored)) return;
    refreshToken.set("");
    isLogged.set(false);
    adoptSignIn({});
    return;
  }

  const storedRefresh = stored["refreshToken"];
  if (!storedRefresh || storedRefresh === refreshToken.get()) return;

  if (isTokenExpired(expireAt.get())) accessToken.set(undefined);
  adoptSignIn(stored);
  refreshToken.set(storedRefresh);
  isLogged.set(true);
};

// Everything a tab holds is one sign-in's. After another one, even of the same user, none of it may be used.
const bindTabToSignIn = (): void => {
  const current = signInMarker.get();
  const bound = tabSignIn.get();
  if (bound === current || (!current && isRefusedSignIn(bound))) return;

  if (bound) {
    accessToken.set(undefined);
    expireAt.set(0);
    user.set(undefined);
    clearPermissions();
    forgetTabOrg();
    lastActiveOrgId.set(undefined);
  }
  tabSignIn.set(current);
};

/** Synchronizes this tab with the current browser sign-in and its newest refresh token. */
export const adoptStoredRefreshToken = (): void =>
  commit(() => {
    takeNewerRefreshToken();
    bindTabToSignIn();
  });

/** Records an interactive sign-in made in this tab, before its tokens are stored. */
export const beginSignIn = (access: string): void => {
  invalidateSignInContext();
  recordSignIn(access);
  bindTabToSignIn();
};

export const forgetSignIn = (): void => {
  adoptSignIn({});
};

/** Whether tokens for `signIn` are still wanted: it is the browser's, or was only taken for dead. */
export const wantsTokensFor = (signIn: string | undefined): boolean =>
  isCurrentSignIn(signIn) || (signIn === signInMarker.get() && isRefusedSignIn(signIn));

/**
 * Settles auth-api's refusal of `token`. It stands unless the tab has since taken up a newer token, another
 * sign-in or a sign-out. The stored token is then the dead one, and goes with the cookies that name it.
 * @returns Whether the refusal stands
 */
export const endRefusedSignIn = (token: string, signIn: string | undefined): boolean => {
  adoptStoredRefreshToken();
  if (refreshToken.get() !== token || !wantsTokensFor(signIn)) return false;

  if (readStoreCookies()["refreshToken"] === token) deleteRefusedSignIn(signIn!);
  return true;
};

export const storeRefreshToken = (refresh: string): void => {
  setStoreCookie("refreshToken", refresh);
  renewSignInCookies(true);
  refreshToken.set(refresh);
};
