import {AuthProvider} from "./types";
import {createOAuthProvider, type OAuthProviderConfig} from "./oauth";
import type {WritableAtom} from "nanostores";

// Provider configuration interface
export interface MicrosoftProviderConfig extends OAuthProviderConfig {}

// Create the Microsoft provider using the factory
const microsoftProvider = createOAuthProvider({
  provider: AuthProvider.MICROSOFT,
  metadata: {
    name: "Microsoft",
    authBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    defaultScopes: ["openid", "profile", "email"],
    responseType: "id_token",
    responseMode: "fragment",
  },
});

// Export the configuration atom, auth URL atom, and update function
export const microsoftConfig: WritableAtom<OAuthProviderConfig | null> = microsoftProvider.config;
export const microsoftAuthUrl: WritableAtom<string | null> = microsoftProvider.authUrl;
export const updateMicrosoftAuthUrl: () => void = microsoftProvider.updateAuthUrl;
