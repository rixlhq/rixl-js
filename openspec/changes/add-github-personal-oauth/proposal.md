# Add GitHub personal OAuth to the SDK

Add GitHub personal account sign-in and linking through auth-api's authorization-code contract. Sign-in exchanges a code at `POST /auth/v1/token` with `token_type: "github"`; account linking sends the same code, PKCE verifier and redirect URI to authenticated `POST /auth/v1/providers/connect` with `EXTERNAL_ACCOUNT_PROVIDER_GITHUB` (enum value 6). Successful calls continue to install auth-api access and refresh tokens.

The SDK requests only `read:user` and `user:email`. GitHub App organization installations and repository access are separate integrations and are not requested here.

## Callback safety and dashboard setup

The SDK creates cryptographic OAuth state and a PKCE S256 verifier, stores both in session storage, checks exact returned state, and only accepts a callback loaded at the origin and path of the configured redirect URI. The configured redirect URI is sent unchanged to auth-api for code redemption. The dashboard must register that exact callback URL in its GitHub OAuth App, configure the SDK's `auth.github` client ID and redirect URI, and route the OAuth callback back to that URL. Client secrets must never be placed in the SDK or dashboard.
