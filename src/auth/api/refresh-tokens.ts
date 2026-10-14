import {authV1TokenServiceRefreshToken, type AuthV1RefreshTokenRequest} from "../../generated";
import {AuthProvider} from "@/providers";
import type {TokenResponse, LimitedScopeTokenResponse} from "../types";

export type {TokenResponse, LimitedScopeTokenResponse};

export interface RefreshTokenOptions {
  countryCode?: string;
  origin?: string;
  /** PKCE verifier for providers that return an authorization code. */
  codeVerifier?: string;
  redirectUri?: string;
}

// Not in the generated request type until the SDK is regenerated from the updated spec.
type CodeExchangeFields = {code_verifier?: string; redirect_uri?: string};

/**
 * Exchange a provider credential for a Rixl session, or refresh an existing
 * Rixl session with a Bearer refresh token.
 *
 * Both go to `/auth/v1/token`, which needs no session: `token_type` is the
 * `AuthProvider` value and `refresh_token` carries the stored refresh token or
 * the provider's `id_token` / Telegram payload. `/auth/v1/providers/connect`
 * links a provider to an already signed-in user, so it cannot sign anyone in.
 */
export const refreshTokens = async (
  provider: AuthProvider,
  token: string,
  options?: RefreshTokenOptions
): Promise<TokenResponse | LimitedScopeTokenResponse> => {
  const body: AuthV1RefreshTokenRequest & CodeExchangeFields = {
    token_type: provider,
    refresh_token: token,
    country_code: options?.countryCode,
    origin: options?.origin,
    code_verifier: options?.codeVerifier,
    redirect_uri: options?.redirectUri,
  };
  const {data} = await authV1TokenServiceRefreshToken({body, throwOnError: true});
  return data as TokenResponse | LimitedScopeTokenResponse;
};
