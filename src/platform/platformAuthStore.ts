import {atom, type WritableAtom} from "nanostores";
import {platformauthV1PlatformAuthServiceExchangeApiKey, platformauthV1PlatformAuthServiceRefreshPlatformToken} from "../generated/sdk.gen";
import {isTokenExpired} from "../auth/utils/jwt";
import {shared} from "../shared-runtime";

// Platform/API-key credential state — deliberately separate from `authStore.ts`'s
// end-user token atoms (isLogged, accessToken, user). An API key represents a
// developer/server credential, not a logged-in user, and must never be able to
// flip isLogged or feed decodeAndSetUser.
export const platformAccessToken: WritableAtom<string | undefined> = shared("platformAccessToken", () => atom(undefined));
export const platformRefreshToken: WritableAtom<string | undefined> = shared("platformRefreshToken", () => atom(undefined));
export const platformExpireAt: WritableAtom<number> = shared("platformExpireAt", () => atom(0));

let currentPlatformTokenPromise: Promise<string | undefined> | null = null;

const setPlatformTokens = (access: string, refresh: string, expiresIn: number): void => {
  platformAccessToken.set(access);
  platformRefreshToken.set(refresh);
  platformExpireAt.set(Date.now() + expiresIn * 1000);
};

const clearPlatformTokens = (): void => {
  platformAccessToken.set(undefined);
  platformRefreshToken.set(undefined);
  platformExpireAt.set(0);
};

export const exchangeApiKey = async (apiKey: string): Promise<void> => {
  const {data} = await platformauthV1PlatformAuthServiceExchangeApiKey({
    body: {api_key: apiKey},
    throwOnError: true,
  });
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Platform token exchange did not return tokens");
  }
  setPlatformTokens(data.access_token, data.refresh_token, Number(data.expires_in ?? 0));
};

const refreshPlatformAccessToken = async (refresh: string): Promise<void> => {
  const {data} = await platformauthV1PlatformAuthServiceRefreshPlatformToken({
    body: {refresh_token: refresh},
    throwOnError: true,
  });
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Platform token refresh did not return tokens");
  }
  setPlatformTokens(data.access_token, data.refresh_token, Number(data.expires_in ?? 0));
};

const ensureValidPlatformToken = async (refresh: string): Promise<void> => {
  const currentAccessToken = platformAccessToken.get();
  if (currentAccessToken && !isTokenExpired(platformExpireAt.get())) {
    return;
  }

  try {
    await refreshPlatformAccessToken(refresh);
  } catch (refreshError) {
    console.error("Platform token refresh failed in getPlatformToken:", refreshError);
    clearPlatformTokens();
    throw refreshError;
  }
};

export const getPlatformToken = async (): Promise<string | undefined> => {
  if (currentPlatformTokenPromise) {
    return currentPlatformTokenPromise;
  }

  // Check synchronously, before creating the memoized promise below. If this
  // lived inside the async IIFE, a caller with no refresh token yet would hit
  // `return` with no prior `await`, letting the `finally` run (and null out
  // currentPlatformTokenPromise) synchronously, before the outer assignment on
  // the next line even completes — clobbering it right back to the resolved
  // promise and leaking a stale cache entry forever.
  const currentRefreshToken = platformRefreshToken.get();
  if (!currentRefreshToken) return undefined;

  currentPlatformTokenPromise = (async () => {
    try {
      await ensureValidPlatformToken(currentRefreshToken);

      return platformAccessToken.get();
    } finally {
      currentPlatformTokenPromise = null;
    }
  })();

  return currentPlatformTokenPromise;
};
