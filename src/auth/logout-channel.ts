import {GLOBAL_PREFIX} from "./constants";
import {shared} from "../shared-runtime";

const LOGOUT = "logout";

// One channel per page, shared across copies of this package so each logout is
// handled once per tab. A channel never receives its own messages. Browser only:
// Node also has BroadcastChannel, and an open one keeps an SSR or build process
// from ever exiting.
const channel = shared("logoutChannel", () =>
  typeof window === "undefined" || typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`${GLOBAL_PREFIX}_logout`)
);

/** Tells the other tabs on this origin that the user logged out. */
export const announceLogout = (signIn: string | undefined): void => channel?.postMessage({type: LOGOUT, signIn});

/**
 * Runs `handler` when another tab logs out. The cookie alone cannot say so:
 * a missing cookie also means the browser blocked it, as in a third-party iframe.
 */
export const onLogoutElsewhere = (handler: (signIn: string | undefined) => void): void => {
  channel?.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (message?.type === LOGOUT && (typeof message.signIn === "string" || message.signIn === undefined)) handler(message.signIn);
  });
};
