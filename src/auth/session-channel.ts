import {GLOBAL_PREFIX} from "./constants";
import {shared} from "../shared-runtime";

const LOGOUT = "logout";

// One channel per page, shared across copies of this package so each logout is
// handled once per tab. A channel never receives its own messages. Browser only:
// Node also has BroadcastChannel, and an open one keeps an SSR or build process
// from ever exiting.
const channel = shared("sessionChannel", () =>
  typeof window === "undefined" || typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`${GLOBAL_PREFIX}_session`)
);

/** Tells the other tabs on this origin that the user logged out. */
export const announceLogout = (): void => channel?.postMessage(LOGOUT);

/**
 * Runs `handler` when another tab logs out. The cookie alone cannot say so:
 * a missing cookie also means the browser blocked it, as in a third-party iframe.
 */
export const onLogoutElsewhere = (handler: () => void): void => {
  channel?.addEventListener("message", (event: MessageEvent) => {
    if (event.data === LOGOUT) handler();
  });
};
