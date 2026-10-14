/** An OpenID Connect authorization code, with what the backend needs to redeem it. */
export interface AuthorizationCode {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

/** What a provider callback proves an account with: a token, or a code the backend redeems. */
export type ProviderCredential = {token: string} | {authorizationCode: AuthorizationCode};

/** Request fields that carry an authorization code alongside the token field. */
export interface CodeExchangeFields {
  code_verifier?: string;
  redirect_uri?: string;
}

/** The credential as the sign-in and link requests carry it. */
export const credentialFields = (credential: ProviderCredential): {token: string} & CodeExchangeFields => {
  if ("token" in credential) return {token: credential.token};

  const {code, codeVerifier, redirectUri} = credential.authorizationCode;
  return {token: code, code_verifier: codeVerifier, redirect_uri: redirectUri};
};
