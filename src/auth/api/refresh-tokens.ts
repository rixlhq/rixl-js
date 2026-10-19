import {authV1TokenServiceRefreshToken, type AuthV1RefreshTokenRequest} from "../../generated";
import {AuthProvider, credentialFields, type ProviderCredential} from "@/providers";
import type {TokenResponse, LimitedScopeTokenResponse} from "../types";

export type {TokenResponse, LimitedScopeTokenResponse};

export interface RefreshTokenOptions {
  countryCode?: string;
  origin?: string;
}

/**
 * Exchange a provider credential for a Rixl session, or refresh an existing
 * Rixl session with a Bearer refresh token.
 *
 * Both go to `/auth/v1/token`, which needs no session: `token_type` is the
 * `AuthProvider` value and `refresh_token` carries the stored refresh token or
 * the provider's token or authorization code. `/auth/v1/providers/connect`
 * links a provider to an already signed-in user, so it cannot sign anyone in.
 */
export const refreshTokens = async (
  provider: AuthProvider,
  credential: ProviderCredential,
  options?: RefreshTokenOptions
): Promise<TokenResponse | LimitedScopeTokenResponse> => {
  const {token, ...codeExchange} = credentialFields(credential);
  const body: AuthV1RefreshTokenRequest = {
    token_type: provider,
    refresh_token: token,
    country_code: options?.countryCode,
    origin: options?.origin,
    ...codeExchange,
  };
  const {data} = await authV1TokenServiceRefreshToken({body, throwOnError: true});
  return data as TokenResponse | LimitedScopeTokenResponse;
};
