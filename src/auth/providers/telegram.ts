import {atom, type WritableAtom} from "nanostores";
import {warnProviderNotConfigured} from "./oauth";
import {AuthProvider} from "./types";
import {authorizationCodeUrl, readAuthorizationCode} from "./authorization-code";
import type {ProviderCredential} from "./credential";
import {shared} from "../../shared-runtime";

// Provider configuration interface
export interface TelegramProviderConfig {
  /** The bot ID, which is Telegram's OpenID Connect client ID. */
  botId: string;
  /** Must be registered in BotFather. Defaults to the page origin. */
  redirectUri?: string;
}

const TELEGRAM_AUTH_URL = "https://oauth.telegram.org/auth";

// Shared across copies of this package, for the reason given in oauth.ts.
export const telegramConfig: WritableAtom<TelegramProviderConfig | null> = shared("provider.telegram.config", () =>
  atom<TelegramProviderConfig | null>(null)
);

export const telegramAuthUrl: WritableAtom<string | null> = shared("provider.telegram.authUrl", () => atom<string | null>(null));

const telegramRedirectUri = (config: TelegramProviderConfig): string => config.redirectUri ?? window.location.origin;

const authUrl = (config: TelegramProviderConfig): Promise<string> =>
  authorizationCodeUrl(AuthProvider.TELEGRAM_OIDC, {
    authUrl: TELEGRAM_AUTH_URL,
    clientId: config.botId,
    redirectUri: telegramRedirectUri(config),
    scope: "openid profile",
  });

/**
 * Updates the Telegram authentication URL using the configured settings.
 * Resolves once the URL is set, so initClient() can finish with login() ready.
 */
export async function updateTelegramAuthUrl(): Promise<void> {
  const config = telegramConfig.get();
  if (!config) {
    warnProviderNotConfigured("Telegram");
    telegramAuthUrl.set(null);
    return;
  }

  telegramAuthUrl.set(null);
  try {
    const url = await authUrl(config);
    // A newer configuration set while the challenge was computed owns the URL.
    if (telegramConfig.get() === config) telegramAuthUrl.set(url);
  } catch (error) {
    // The S256 challenge needs crypto.subtle, which browsers only expose on secure
    // (https or localhost) pages, and session storage to keep the verifier.
    console.error("Telegram sign-in is unavailable: the PKCE challenge needs a secure (https) page with session storage.", error);
  }
}

/** The authorization code Telegram sent back, when this page is its OpenID Connect callback. */
export const readTelegramCode = (): ProviderCredential | undefined => {
  const config = telegramConfig.get();
  return config ? readAuthorizationCode(AuthProvider.TELEGRAM_OIDC, telegramRedirectUri(config)) : undefined;
};
