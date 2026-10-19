import {getOauthState, validateOAuthState} from "../state";
import {getPkceVerifier, pkceChallenge, readPkceVerifier} from "../pkce";
import {urlParams} from "../url";
import type {ProviderCredential} from "./credential";
import type {AuthProvider} from "./types";

export interface AuthorizationCodeRequest {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

/** Builds an authorization code request carrying the provider's state and a PKCE S256 challenge. */
export const authorizationCodeUrl = async (provider: AuthProvider, request: AuthorizationCodeRequest): Promise<string> => {
  const params = new URLSearchParams({
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    response_type: "code",
    scope: request.scope,
    state: getOauthState(provider),
    code_challenge: await pkceChallenge(getPkceVerifier(provider)),
    code_challenge_method: "S256",
  });
  return `${request.authUrl}?${params.toString()}`;
};

/** Whether the URL holds an authorization code answering this provider's state. */
export const hasAuthorizationCode = (provider: AuthProvider): boolean => {
  const state = urlParams.get("state");
  return urlParams.has("code") && !!state && validateOAuthState(provider, state);
};

/** The authorization code in the URL, with the verifier and redirect URI it was requested with. */
export const readAuthorizationCode = (provider: AuthProvider, redirectUri: string): ProviderCredential | undefined => {
  const code = urlParams.get("code");
  const codeVerifier = readPkceVerifier(provider);
  if (!code || !codeVerifier || !hasAuthorizationCode(provider)) return undefined;

  return {authorizationCode: {code, codeVerifier, redirectUri}};
};
