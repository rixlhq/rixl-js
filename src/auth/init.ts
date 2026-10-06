import {getToken, authError, setTokens, setLimitedAccessState, clearLimitedAccessState} from "./authStore";
import {ApiError} from "./api/types";
import {HTTP_STATUS} from "./constants";
import type {TokenResponse, LimitedScopeTokenResponse, RequiresAction} from "./types";
import type {LoginErrorCode} from "./auth/types";
import {apiURL} from "./api-url";
import {refreshTokens} from "./api/refresh-tokens";
import {initDeferred} from "./initialization";
import {configureSdkClient} from "./api/sdk-client";
import {
  type GoogleProviderConfig,
  type TelegramProviderConfig,
  type AppleProviderConfig,
  type MicrosoftProviderConfig,
  googleConfig,
  telegramConfig,
  appleConfig,
  microsoftConfig,
  updateGoogleAuthUrl,
  updateAppleAuthUrl,
  updateMicrosoftAuthUrl,
  updateTelegramAuthUrl,
  getProviderToken,
  detectProvider,
  completeOAuthCallback,
  logProviderExchangeFailure,
  hasProviderResponse,
  logUnusableProviderResponse,
  AuthProvider,
} from "./providers";
import {clearSocialConnectAttempt, hasSocialConnectAttempt} from "./social/socialState";
import {connectSocialInternal} from "./social/socialConnections";
import {setLoginRedirectUrl} from "./authConfig";
import {isLimitedScopeTokenResponse} from "./utils/requires-action";

/**
 * Configuration options for the authentication client
 */
export interface AuthClientConfig {
  /** The base URL of the authentication API */
  apiUrl: string;
  /** Optional login redirect URL used when auth expires */
  loginRedirectUrl?: string;
  /** Google authentication provider configuration (optional) */
  googleProvider?: GoogleProviderConfig;
  /** Apple authentication provider configuration (optional) */
  appleProvider?: AppleProviderConfig;
  /** Microsoft authentication provider configuration (optional) */
  microsoftProvider?: MicrosoftProviderConfig;
  /** Telegram authentication provider configuration (optional) */
  telegramProvider?: TelegramProviderConfig;
}

/**
 * Initializes the authentication client with the provided configuration
 * @param config The authentication client configuration
 * @returns A promise that resolves to the current access token (if available)
 */
export const initClient = async (config: AuthClientConfig): Promise<string | undefined> => {
  try {
    await runInitSequence(config);
  } finally {
    // Also on failure: a rejected exchange must still retire the credential,
    // otherwise the same dead id_token sits in the URL and re-fails on reload.
    completeOAuthCallback();
  }
  return getToken();
};

const runInitSequence = async (config: AuthClientConfig): Promise<void> => {
  try {
    await initConfig(config);
    await initPage();
  } finally {
    // Unblock waiters even if the provider token exchange failed, otherwise
    // getToken() and every other auth call hang forever. This must happen
    // before initSocials(): connecting a provider calls the authenticated
    // /auth/v1/providers/connect, whose request interceptor awaits getToken(),
    // which awaits this deferred — resolving it afterwards would deadlock.
    initDeferred.resolve();
  }
  await initSocials();
};

const initConfig = async (config: AuthClientConfig) => {
  // Set the API URL
  apiURL.set(config.apiUrl);
  configureSdkClient();
  setLoginRedirectUrl(config.loginRedirectUrl);

  // Set provider configurations and update auth URLs
  if (config.googleProvider) {
    googleConfig.set(config.googleProvider);
    updateGoogleAuthUrl();
  }

  if (config.appleProvider) {
    appleConfig.set(config.appleProvider);
    updateAppleAuthUrl();
  }

  if (config.microsoftProvider) {
    microsoftConfig.set(config.microsoftProvider);
    updateMicrosoftAuthUrl();
  }

  if (config.telegramProvider) {
    telegramConfig.set(config.telegramProvider);
    updateTelegramAuthUrl();
  }
};

const applyTokenExchangeResult = (result: TokenResponse | LimitedScopeTokenResponse): void => {
  if (isLimitedScopeTokenResponse(result)) {
    setLimitedAccessState(result.access_token, result.requires_action as RequiresAction);
    return;
  }

  const fullResult = result as TokenResponse;
  setTokens(fullResult.access_token, fullResult.refresh_token, fullResult.expires_in);
};

const setAuthErrorAndClear = (error_code: LoginErrorCode, message: string, email: string): true => {
  clearLimitedAccessState();
  authError.set({error_code, message, email});
  return true;
};

const extractAuthErrorInfo = (error: ApiError): {error: string; description: string; email: string} => {
  const data = error.data as {error?: string; error_description?: string; email?: string} | undefined;
  return {
    error: data?.error ?? "",
    description: data?.error_description ?? error.message ?? "",
    email: data?.email ?? "",
  };
};

const handleInitPageApiError = (error: ApiError): void => {
  const info = extractAuthErrorInfo(error);

  if (error.status === HTTP_STATUS.BAD_REQUEST && info.error === "invalid_grant") {
    setAuthErrorAndClear("email_not_verified", info.description, info.email);
    return;
  }

  if (error.status === HTTP_STATUS.CONFLICT) {
    setAuthErrorAndClear("provider_conflict", info.description, info.email);
    return;
  }

  // Everything else used to rethrow, which reached no UI: the login page just
  // reappeared with nothing on it. Record the gateway's own message so the page
  // can show why, and so the failure is state rather than a lost exception.
  setAuthErrorAndClear("provider_exchange_failed", info.error || info.description, info.email);
};

const exchangeProviderToken = async (provider: AuthProvider, token: string): Promise<void> => {
  const result = await refreshTokens(provider, token);
  applyTokenExchangeResult(result);
};

const initPage = async () => {
  const provider = detectProvider();
  if (!provider) {
    // A response came back but detectProvider() rejected it, so the login ends
    // here without a request. Say why instead of returning to the login page mute.
    if (hasProviderResponse()) logUnusableProviderResponse();
    return undefined;
  }

  const token = getProviderToken(provider);
  if (!token) return undefined;

  try {
    await exchangeProviderToken(provider, token);
  } catch (error) {
    logProviderExchangeFailure(provider, token, error);
    // A transport failure is not an auth outcome and has no message to show, so
    // it still propagates; the gateway's own rejections become authError state.
    if (!(error instanceof ApiError)) throw error;
    handleInitPageApiError(error);
  }
};

const initSocials = async () => {
  const provider = detectProvider();
  if (!provider) return undefined;

  const token = getProviderToken(provider);
  if (!token) return undefined;

  // Check if this is a social connection attempt
  try {
    if (hasSocialConnectAttempt(provider)) {
      await connectSocialInternal(provider, token);
    }
  } finally {
    clearSocialConnectAttempt(provider);
  }
};
