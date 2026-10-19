import {deleteCookie, getAllCookiesStartWith, setCookie} from "./util";
import {GLOBAL_PREFIX, COOKIE_EXPIRY_DAYS} from "../constants";

export const initVals: Partial<Record<string, string>> = getAllCookiesStartWith(GLOBAL_PREFIX);

/** The stored values as they are now, which other tabs may have rewritten since load. */
export const readStoreCookies = (): Partial<Record<string, string>> => getAllCookiesStartWith(GLOBAL_PREFIX);

export const setStoreCookie = (key: string, value: unknown): void => {
  const expires = new Date();
  expires.setTime(expires.getTime() + COOKIE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const cookieKey = `${GLOBAL_PREFIX}_${key}`;

  if (!value || value === "") {
    deleteCookie(cookieKey);
    return;
  }

  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  setCookie(`${GLOBAL_PREFIX}_${key}`, stringValue, {
    expires,
    path: "/",
    sameSite: "Lax",
  });
};
