import {clearOauthState} from "../state";
import {clearPkceVerifier} from "../pkce";
import {urlParams} from "../url";
import {updateAppleAuthUrl} from "./apple";
import {updateGoogleAuthUrl} from "./google";
import {updateMicrosoftAuthUrl} from "./microsoft";
import {updateTelegramAuthUrl} from "./telegram";
import {AuthProvider} from "./types";
import {detectProvider} from "./utils";

/** Params that carry the credential itself — their presence marks a callback response. */
const CREDENTIAL_PARAMS: ReadonlyArray<string> = ["id_token", "code", "access_token", AuthProvider.TELEGRAM_MINI_APP];

/** Everything the providers append to the redirect URL, credential and bookkeeping alike. */
const OAUTH_RESPONSE_PARAMS: ReadonlyArray<string> = [
  ...CREDENTIAL_PARAMS,
  "state",
  "token_type",
  "expires_in",
  "scope",
  "session_state",
  "authuser",
  "prompt",
  "hd",
];

/**
 * Whether the URL this page loaded with carries a provider response at all —
 * unlike `detectProvider()`, this does not require the state to validate. The
 * gap between the two is the case where a login round-trip came back but cannot
 * be used, which otherwise ends the flow in silence.
 */
export const hasProviderResponse = (): boolean => CREDENTIAL_PARAMS.some((key) => urlParams.has(key));

const AUTH_URL_UPDATERS: Partial<Record<AuthProvider, () => void>> = {
  [AuthProvider.GOOGLE]: updateGoogleAuthUrl,
  [AuthProvider.APPLE]: updateAppleAuthUrl,
  [AuthProvider.MICROSOFT]: updateMicrosoftAuthUrl,
  [AuthProvider.TELEGRAM_OIDC]: updateTelegramAuthUrl,
};

/** Returns undefined when the half holds no credential, meaning it is the app's own and must not be touched. */
const stripped = (query: string): string | undefined => {
  const params = new URLSearchParams(query);
  if (!CREDENTIAL_PARAMS.some((key) => params.has(key))) return undefined;

  OAUTH_RESPONSE_PARAMS.forEach((key) => params.delete(key));
  return params.toString();
};

/**
 * Providers put their response in the query string or the fragment depending on
 * `response_mode`, and either half may also hold params the app itself put
 * there. Only the half actually carrying the credential is rewritten.
 */
const withoutOAuthResponse = (href: string): string => {
  const url = new URL(href);

  url.search = stripped(url.search) ?? url.search;
  url.hash = stripped(url.hash.slice(1)) ?? url.hash;

  return url.toString();
};

/**
 * Retires the provider response after `initClient` is done with it.
 *
 * Left in place, the credential stays in the address bar and every reload — or
 * Vite's HMR full reload — replays an already-consumed `id_token`, which the
 * gateway rejects. Clearing the stored state on the way out also stops the next
 * login from reusing this round-trip's `nonce`.
 *
 * The `urlParams` snapshot is taken at import time and is intentionally left
 * untouched, so callers that already read the credential out of it keep working
 * for the rest of this page load.
 */
export const completeOAuthCallback = (): void => {
  const provider = detectProvider();
  if (!provider) return;

  clearOauthState(provider);
  clearPkceVerifier(provider);
  // initConfig() built the auth URL from the state just cleared; rebuild it so a
  // subsequent login carries a state the callback can still validate.
  AUTH_URL_UPDATERS[provider]?.();

  window.history.replaceState(window.history.state, "", withoutOAuthResponse(window.location.href));
};
