import {afterEach, beforeEach, describe, expect, it, vi} from "vite-plus/test";
import {githubConfig, githubAuthUrl, updateGitHubAuthUrl, readGitHubCode} from "@/providers/github";
import {AuthProvider} from "@/providers";
import {getPkceVerifier, pkceChallenge} from "@/pkce";
import * as urlModule from "@/url";
import {getOauthState} from "@/state";

describe("GitHub personal OAuth", () => {
  beforeEach(() => {
    sessionStorage.clear();
    githubConfig.set(null);
    githubAuthUrl.set(null);
  });

  afterEach(() => vi.restoreAllMocks());

  it("requests minimal scopes with cryptographic state and PKCE", async () => {
    githubConfig.set({clientId: "client-id", redirectUri: `${window.location.origin}/github/callback`});
    window.history.replaceState({}, "", "/github/callback");
    await updateGitHubAuthUrl();
    const url = new URL(githubAuthUrl.get()!);

    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toMatch(/^github_[0-9a-f-]{36}$/);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await pkceChallenge(getPkceVerifier(AuthProvider.GITHUB)));
  });

  it("rejects a callback with mismatched state or callback path", () => {
    const config = {clientId: "client-id", redirectUri: `${window.location.origin}/github/callback`};
    githubConfig.set(config);
    const verifier = getPkceVerifier(AuthProvider.GITHUB);
    const get = vi
      .spyOn(urlModule.urlParams, "get")
      .mockImplementation((key) => ({code: "one-use-code", state: "github_forged"})[key as "code" | "state"] ?? null);
    vi.spyOn(urlModule.urlParams, "has").mockImplementation((key) => key === "code" || key === "state");

    expect(verifier).toBeTruthy();
    expect(readGitHubCode()).toBeUndefined();
    get.mockReturnValue("github_forged");
    window.history.replaceState({}, "", "/different-path");
    expect(readGitHubCode()).toBeUndefined();
  });

  it("accepts only the exact configured callback and returns its bound PKCE verifier", () => {
    const redirectUri = `${window.location.origin}/github/callback`;
    githubConfig.set({clientId: "client-id", redirectUri});
    window.history.replaceState({}, "", "/github/callback");
    const state = getOauthState(AuthProvider.GITHUB);
    const verifier = getPkceVerifier(AuthProvider.GITHUB);
    vi.spyOn(urlModule.urlParams, "get").mockImplementation((key) => ({code: "one-use-code", state})[key as "code" | "state"] ?? null);
    vi.spyOn(urlModule.urlParams, "has").mockImplementation((key) => key === "code" || key === "state");

    expect(readGitHubCode()).toEqual({
      authorizationCode: {code: "one-use-code", codeVerifier: verifier, redirectUri},
    });
  });
});
