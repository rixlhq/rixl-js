import {AuthProvider} from "./types";
import {createOAuthProvider, type OAuthProviderConfig} from "./oauth";
import type {WritableAtom} from "nanostores";

// Provider configuration interface
export interface GoogleProviderConfig extends OAuthProviderConfig {}

// Create the Google provider using the factory
const googleProvider = createOAuthProvider({
  provider: AuthProvider.GOOGLE,
  metadata: {
    name: "Google",
    authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    defaultScopes: ["openid", "https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile"],
    responseType: "id_token",
  },
});

// Export the configuration atom, auth URL atom, and update function
export const googleConfig: WritableAtom<OAuthProviderConfig | null> = googleProvider.config;
export const googleAuthUrl: WritableAtom<string | null> = googleProvider.authUrl;
export const updateGoogleAuthUrl: () => void = googleProvider.updateAuthUrl;
