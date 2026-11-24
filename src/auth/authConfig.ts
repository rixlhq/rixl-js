import {shared} from "../shared-runtime";

// Shared across copies of this package: connect() records the URL in exactly one
// copy, so a per-copy variable makes redirectToLogin() a silent no-op whenever it
// is reached through any other copy — the sign-in expires and nothing happens.
const config = shared("authConfig", () => ({loginRedirectUrl: undefined as string | undefined}));

export const setLoginRedirectUrl = (url?: string): void => {
  config.loginRedirectUrl = url;
};

export const redirectToLogin = (): void => {
  if (!config.loginRedirectUrl) return;
  if (typeof window === "undefined") return;

  window.location.href = config.loginRedirectUrl;
};
