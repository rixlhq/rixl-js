import {urlParams} from "../url";
import {validateOAuthState} from "../state";
import {AuthProvider} from "./types";
import {hasAuthorizationCode} from "./authorization-code";
import type {ProviderCredential} from "./credential";
import {readTelegramCode} from "./telegram";

/**
 * Extracts the provider identifier from a state parameter
 * @param state The state parameter from the OAuth redirect
 * @returns The provider identifier or undefined if not found
 */
export function extractProviderFromState(state: string): string | undefined {
  const parts = state.split("_");
  if (parts.length >= 1) {
    return parts[0];
  }
  return undefined;
}

/** How one provider's response shows up on the page it redirects back to. */
interface ProviderCallbackReader {
  provider: AuthProvider;
  /** Whether this page holds this provider's response. */
  matches(): boolean;
  read(): ProviderCredential | undefined;
}

/** Telegram's mini app puts its init data in a parameter named after the provider. */
const tokenParam = (provider: AuthProvider): ProviderCallbackReader => ({
  provider,
  matches: () => urlParams.has(provider),
  read: () => {
    const token = urlParams.get(provider);
    return token ? {token} : undefined;
  },
});

/** OpenID Connect providers that return an id_token with the state issued for them. */
const idTokenWithState = (provider: AuthProvider): ProviderCallbackReader => ({
  provider,
  matches: () => {
    const state = urlParams.get("state");
    if (!urlParams.get("id_token") || !state) return false;
    return extractProviderFromState(state) === provider && validateOAuthState(provider, state);
  },
  read: () => {
    const token = urlParams.get("id_token");
    return token ? {token} : undefined;
  },
});

const telegramCode: ProviderCallbackReader = {
  provider: AuthProvider.TELEGRAM_OIDC,
  matches: () => hasAuthorizationCode(AuthProvider.TELEGRAM_OIDC),
  read: readTelegramCode,
};

// Checked in order, and the first match wins.
const CALLBACK_READERS: ReadonlyArray<ProviderCallbackReader> = [
  tokenParam(AuthProvider.TELEGRAM_MINI_APP),
  telegramCode,
  idTokenWithState(AuthProvider.GOOGLE),
  idTokenWithState(AuthProvider.APPLE),
  idTokenWithState(AuthProvider.MICROSOFT),
];

/** The provider whose response this page holds, if any. */
export function detectProvider(): AuthProvider | undefined {
  return CALLBACK_READERS.find((reader) => reader.matches())?.provider;
}

/** The credential a provider's response on this page carries. */
export function getProviderCredential(provider: AuthProvider): ProviderCredential | undefined {
  return CALLBACK_READERS.find((reader) => reader.provider === provider)?.read();
}
