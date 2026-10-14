import {urlParams} from "../url";
import {validateOAuthState} from "../state";
import {AuthProvider} from "./types";

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

const OAUTH_PROVIDERS = [AuthProvider.GOOGLE, AuthProvider.APPLE, AuthProvider.MICROSOFT] as const;

/**
 * Detects the authentication provider from URL parameters
 * @returns The detected authentication provider or undefined if none detected
 */
export function detectProvider(): AuthProvider | undefined {
  // Check for Telegram providers first (they have specific parameters)
  if (urlParams.has(AuthProvider.TELEGRAM_MINI_APP)) {
    return AuthProvider.TELEGRAM_MINI_APP;
  }
  const state = urlParams.get("state");

  // Telegram OpenID Connect returns an authorization code, and the redirect can
  // also carry a tgAuthResult that the code flow does not use.
  if (urlParams.has("code") && state && validateOAuthState(AuthProvider.TELEGRAM_OIDC, state)) {
    return AuthProvider.TELEGRAM_OIDC;
  }
  if (urlParams.has(AuthProvider.TELEGRAM_WEB)) {
    return AuthProvider.TELEGRAM_WEB;
  }

  // Check for OAuth providers via id_token + state
  const id_token = urlParams.get("id_token");

  if (id_token && state) {
    const providerFromState = extractProviderFromState(state);
    return OAUTH_PROVIDERS.find((p) => providerFromState === p && validateOAuthState(p, state));
  }

  return undefined;
}

/**
 * Gets the authentication token or code from the URL based on the provider
 * @param provider The authentication provider
 * @returns The token or code, or undefined if not found
 */
export function getProviderToken(provider: AuthProvider): string | undefined {
  // For Telegram, the token is in a parameter named after the provider
  if (provider === AuthProvider.TELEGRAM_MINI_APP || provider === AuthProvider.TELEGRAM_WEB) {
    return urlParams.get(provider) || undefined;
  }

  if (provider === AuthProvider.TELEGRAM_OIDC) {
    return urlParams.get("code") || undefined;
  }

  // For OAuth providers (Google, Apple, Microsoft), the token is in the 'id_token' parameter
  if (provider === AuthProvider.GOOGLE || provider === AuthProvider.APPLE || provider === AuthProvider.MICROSOFT) {
    return urlParams.get("id_token") || undefined;
  }

  return undefined;
}
