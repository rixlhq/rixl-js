import {AuthProvider} from "./types";
import {authorizationCodeUrl, readAuthorizationCode} from "./authorization-code";
import {shared} from "../../shared-runtime";
import {atom, type WritableAtom} from "nanostores";
import type {ProviderCredential} from "./credential";

export interface GitHubProviderConfig {
  clientId: string;
  /** Exact callback URL registered in the GitHub OAuth App. */
  redirectUri: string;
}

export const githubConfig: WritableAtom<GitHubProviderConfig | null> = shared("provider.github.config", () =>
  atom<GitHubProviderConfig | null>(null)
);
export const githubAuthUrl: WritableAtom<string | null> = shared("provider.github.authUrl", () => atom<string | null>(null));

export const updateGitHubAuthUrl = async (): Promise<void> => {
  const config = githubConfig.get();
  if (!config) {
    githubAuthUrl.set(null);
    return;
  }
  const callback = new URL(config.redirectUri);
  if (callback.origin !== window.location.origin) {
    githubAuthUrl.set(null);
    throw new Error("GitHub redirect URI must have the current page origin.");
  }
  const url = await authorizationCodeUrl(AuthProvider.GITHUB, {
    authUrl: "https://github.com/login/oauth/authorize",
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: "read:user user:email",
  });
  if (githubConfig.get() === config) githubAuthUrl.set(url);
};

export const readGitHubCode = (): ProviderCredential | undefined => {
  const config = githubConfig.get();
  if (!config) return undefined;
  const callback = new URL(config.redirectUri);
  if (callback.origin !== window.location.origin || callback.pathname !== window.location.pathname) return undefined;
  return readAuthorizationCode(AuthProvider.GITHUB, config.redirectUri);
};
