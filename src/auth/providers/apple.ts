import {AuthProvider} from "./types";
import {createOAuthProvider, type OAuthProviderConfig} from "./oauth";
import type {WritableAtom} from "nanostores";

// Provider configuration interface
export interface AppleProviderConfig extends OAuthProviderConfig {}

// Create the Apple provider using the factory
const appleProvider = createOAuthProvider({
  provider: AuthProvider.APPLE,
  metadata: {
    name: "Apple",
    authBaseUrl: "https://appleid.apple.com/auth/authorize",
    defaultScopes: ["openid"],
    responseType: "code id_token",
    responseMode: "fragment",
  },
});

// Export the configuration atom, auth URL atom, and update function
export const appleConfig: WritableAtom<OAuthProviderConfig | null> = appleProvider.config;
export const appleAuthUrl: WritableAtom<string | null> = appleProvider.authUrl;
export const updateAppleAuthUrl: () => void = appleProvider.updateAuthUrl;
