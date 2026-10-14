import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {authorizationCodeUrl, readAuthorizationCode} from "@/providers/authorization-code";
import {AuthProvider} from "@/providers";
import {getPkceVerifier, pkceChallenge} from "@/pkce";
import * as urlModule from "@/url";
import * as stateModule from "@/state";

const provider = AuthProvider.TELEGRAM_OIDC;

const callbackWith = (params: Record<string, string>) => {
  vi.spyOn(urlModule.urlParams, "has").mockImplementation((key: string) => key in params);
  vi.spyOn(urlModule.urlParams, "get").mockImplementation((key: string) => params[key] ?? null);
};

describe("authorization code flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("requests a code with the provider's state and an S256 challenge", async () => {
    const url = new URL(
      await authorizationCodeUrl(provider, {
        authUrl: "https://id.example.com/auth",
        clientId: "client-1",
        redirectUri: "https://app.example.com/login",
        scope: "openid profile",
      })
    );

    expect(url.origin + url.pathname).toBe("https://id.example.com/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toMatch(/^telegram_/);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(await pkceChallenge(getPkceVerifier(provider)));
  });

  it("reads a code whose state matches, with the stored verifier", () => {
    const verifier = getPkceVerifier(provider);
    callbackWith({code: "auth-code", state: "telegram_abc"});
    vi.spyOn(stateModule, "validateOAuthState").mockReturnValue(true);

    expect(readAuthorizationCode(provider, "https://app.example.com/login")).toEqual({
      authorizationCode: {code: "auth-code", codeVerifier: verifier, redirectUri: "https://app.example.com/login"},
    });
  });

  it("ignores a code whose state does not match", () => {
    getPkceVerifier(provider);
    callbackWith({code: "auth-code", state: "telegram_forged"});
    vi.spyOn(stateModule, "validateOAuthState").mockReturnValue(false);

    expect(readAuthorizationCode(provider, "https://app.example.com/login")).toBeUndefined();
  });
});
