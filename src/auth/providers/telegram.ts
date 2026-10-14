import {atom, type WritableAtom} from "nanostores";
import {warnProviderNotConfigured} from "./oauth";
import {AuthProvider} from "./types";
import {getOauthState} from "../state";
import {getPkceVerifier, pkceChallenge} from "../pkce";
import {shared} from "../../shared-runtime";

// Provider configuration interface
export interface TelegramProviderConfig {
  botId: string;
  /**
   * Sign in with Telegram's OpenID Connect authorization code flow instead of
   * the legacy widget redirect. The bot ID is the OIDC client ID.
   */
  oidc?: boolean;
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

const legacyAuthUrl = (config: TelegramProviderConfig): string =>
  `${TELEGRAM_AUTH_URL}?` +
  `bot_id=${encodeURIComponent(config.botId)}` +
  `&origin=${encodeURIComponent(window.location.origin)}` +
  `&return_to=${encodeURIComponent(window.location.origin + location.pathname)}`;

const oidcAuthUrl = async (config: TelegramProviderConfig): Promise<string> => {
  const params = new URLSearchParams({
    client_id: config.botId,
    redirect_uri: telegramRedirectUri(config),
    response_type: "code",
    scope: "openid profile",
    state: getOauthState(AuthProvider.TELEGRAM_OIDC),
    code_challenge: await pkceChallenge(getPkceVerifier(AuthProvider.TELEGRAM_OIDC)),
    code_challenge_method: "S256",
  });
  return `${TELEGRAM_AUTH_URL}?${params.toString()}`;
};

/**
 * Updates the Telegram authentication URL using the configured settings
 */
export function updateTelegramAuthUrl(): void {
  const config = telegramConfig.get();
  if (!config) {
    warnProviderNotConfigured("Telegram");
    telegramAuthUrl.set(null);
    return;
  }

  if (!config.oidc) {
    telegramAuthUrl.set(legacyAuthUrl(config));
    return;
  }

  // The S256 challenge is async; until it resolves login() reports the provider as not ready.
  telegramAuthUrl.set(null);
  void oidcAuthUrl(config).then((url) => telegramAuthUrl.set(url));
}

/** The PKCE verifier and redirect URI the backend needs to redeem a Telegram authorization code. */
export const telegramCodeExchange = (): {codeVerifier: string; redirectUri: string} | undefined => {
  const config = telegramConfig.get();
  if (!config) return undefined;
  return {codeVerifier: getPkceVerifier(AuthProvider.TELEGRAM_OIDC), redirectUri: telegramRedirectUri(config)};
};
