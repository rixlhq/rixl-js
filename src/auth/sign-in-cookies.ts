/**
 * The sign-in the browser holds, which every tab shares. It sits in cookies next
 * to the refresh token, and only an interactive sign-in changes it.
 */
import {atom, type WritableAtom} from "nanostores";
import {shared} from "../shared-runtime";
import {initVals, readStoreCookies, setStoreCookie} from "./cookie";
import {decodeOrgClaims, type OrgClaims} from "./utils/jwt";

const cookieValue = (name: string): WritableAtom<string | undefined> => shared(name, () => atom(initVals[name]));

/**
 * The org of the token sign-in returned, which is the user's personal org. A tab
 * that has no org yet refreshes into it.
 */
export const personalOrgId: WritableAtom<string | undefined> = cookieValue("personalOrgId");

/** Which sign-in the refresh token belongs to: the user and the sign-in ID. */
export const signInMarker: WritableAtom<string | undefined> = cookieValue("signIn");

export const signInMarkerOf = ({userId, signInId}: OrgClaims): string => `${userId}:${signInId}`;

/** Records an interactive sign-in from the access token it returned. */
export const recordSignIn = (accessToken: string): void => {
  const claims = decodeOrgClaims(accessToken);
  personalOrgId.set(claims?.orgId);
  signInMarker.set(claims && signInMarkerOf(claims));
};

/** Takes up the sign-in another tab stored, as read from the cookies with its refresh token. */
export const adoptSignIn = (stored: Partial<Record<string, string>>): void => {
  personalOrgId.set(stored["personalOrgId"]);
  signInMarker.set(stored["signIn"]);
};

const cookieAccess = shared("signInCookieAccess", () => ({seen: Boolean(initVals["signIn"])}));

/** A missing marker means sign-out once this tab has seen it in the cookie jar. */
export const currentSignIn = (stored = readStoreCookies()): string | undefined => {
  const marker = stored["signIn"];
  if (marker) cookieAccess.seen = true;
  return cookieAccess.seen ? marker : signInMarker.get();
};

// Names the sign-in whose stored refresh token was refused, while a rotation of it may still be on its way back.
const REFUSED_SIGN_IN = "refusedSignIn";
const LATE_ROTATION_MS = 60_000;

/** Takes the sign-in out of the cookies because auth-api refused its refresh token, so a reload starts signed out. */
export const deleteRefusedSignIn = (signIn: string): void => {
  for (const name of ["refreshToken", "personalOrgId", "signIn", "isLogged"]) setStoreCookie(name, "");
  setStoreCookie(REFUSED_SIGN_IN, signIn, LATE_ROTATION_MS);
};

/** Whether the tab's sign-in left the cookies that way, and nothing has replaced it or signed it out since. */
const refusedSignIn = (stored: Partial<Record<string, string>>): string | undefined =>
  stored["signIn"] ? undefined : stored[REFUSED_SIGN_IN];

export const isRefusedSignIn = (signIn: string | undefined, stored = readStoreCookies()): boolean =>
  !!signIn && refusedSignIn(stored) === signIn;

export const browserSignIn = (stored = readStoreCookies()): string | undefined => {
  return currentSignIn(stored) ?? refusedSignIn(stored);
};

/**
 * Renews the identity cookies alongside the refresh token so they expire together.
 */
export const renewSignInCookies = (isLogged: boolean): void => {
  setStoreCookie(REFUSED_SIGN_IN, "");
  setStoreCookie("personalOrgId", personalOrgId.get());
  setStoreCookie("signIn", signInMarker.get());
  setStoreCookie("isLogged", isLogged);
  if (isLogged) currentSignIn();
};

export const isCurrentSignIn = (signIn: string | undefined): boolean =>
  !!signIn && signIn === signInMarker.get() && signIn === currentSignIn();
