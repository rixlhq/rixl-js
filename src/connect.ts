import {initClient} from "./auth/init";
import {apiURL} from "./auth/api-url";
import {configureAllClients} from "./client-registry";
import {configureSdkClient, setTokenResolver} from "./auth/api/sdk-client";
import {exchangeApiKey, getPlatformToken} from "./platform/platformAuthStore";
import type {
  GoogleProviderConfig,
  AppleProviderConfig,
  MicrosoftProviderConfig,
  TelegramProviderConfig,
  GitHubProviderConfig,
} from "./auth/providers";

export interface AuthConfig {
  loginRedirectUrl?: string;
  google?: GoogleProviderConfig;
  apple?: AppleProviderConfig;
  microsoft?: MicrosoftProviderConfig;
  telegram?: TelegramProviderConfig;
  github?: GitHubProviderConfig;
}

export interface ConnectConfig {
  baseUrl: string;
  apiKey?: string;
  token?: string;
  auth?: AuthConfig;
}

export const connect = async (config: ConnectConfig): Promise<string | undefined> => {
  // apiURL is the canonical baseUrl store configureSdkClient() reads from and
  // stays subscribed to; setting it here (not just client.setConfig) keeps
  // apiKey/token-only mode (no `auth`) from having its baseUrl silently reset
  // to "" the first time configureSdkClient() runs.
  apiURL.set(config.baseUrl);
  // Every copy, not just this one: a bundler may have given a dependency its own
  // copy of this package, and the generated request functions there close over
  // that copy's client.
  configureAllClients(config.baseUrl);

  if (config.apiKey) {
    // Exchange the API key for a real Bearer token up front rather than
    // forwarding it raw as X-API-Key on every request — the gateway's
    // /platform/auth/v1/token exchange is the supported flow; sending the raw
    // key directly on arbitrary routes gets rejected with 401.
    await exchangeApiKey(config.apiKey);
    setTokenResolver(getPlatformToken);
    configureSdkClient();
  }

  if (config.token) {
    setTokenResolver(async () => config.token);
    configureSdkClient();
  }

  if (config.auth) {
    return initClient({
      apiUrl: config.baseUrl,
      loginRedirectUrl: config.auth.loginRedirectUrl,
      googleProvider: config.auth.google,
      appleProvider: config.auth.apple,
      microsoftProvider: config.auth.microsoft,
      telegramProvider: config.auth.telegram,
      githubProvider: config.auth.github,
    });
  }

  return undefined;
};
