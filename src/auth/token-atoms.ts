/**
 * The stores of the tokens themselves. The refresh token is shared by every tab
 * through its cookie; the access token and its expiry belong to the tab.
 */
import {atom, type WritableAtom} from "nanostores";
import {shared} from "../shared-runtime";
import {initVals} from "./cookie";

// Store for authentication state. Shared across copies of this package: a
// duplicate copy would otherwise hydrate its own tokens from the cookie and
// then silently diverge on the first refresh or logout.
//
// Seeded from the cookie only. An OAuth callback in the URL is not evidence of a
// sign-in — the exchange can still fail — so consumers must await initClient()
// before reading this on a callback load rather than trusting an optimistic true.
export const isLogged: WritableAtom<boolean> = shared("isLogged", () => atom(initVals["isLogged"] === "true"));
// The access token and its expiry are this tab's own, kept in memory: they are
// for the tab's org, which other tabs need not share.
export const accessToken: WritableAtom<string | undefined> = shared("accessToken", () => atom<string | undefined>(undefined));
export const refreshToken: WritableAtom<string | undefined> = shared("refreshToken", () => atom(initVals["refreshToken"]));
export const expireAt: WritableAtom<number> = shared("expireAt", () => atom(0));
