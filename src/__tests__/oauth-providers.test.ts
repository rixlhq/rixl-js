/**
 * OAuth Providers test suite
 * Tests: buildOAuthUrl, createOAuthProvider, provider configurations
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {buildOAuthUrl, createOAuthProvider, warnProviderNotConfigured} from "../auth/providers/oauth";
import {AuthProvider} from "@/providers";
import * as state from "../auth/state";
import {resetSharedRuntime} from "./setup/shared-runtime-reset";

vi.mock("../auth/state", () => ({
  getOauthState: vi.fn(),
  validateOAuthState: vi.fn(),
}));

describe("OAuth Providers", () => {
  const mockGetOauthState = state.getOauthState as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Providers created here share their atoms with every other copy of the
    // package, so each case needs a clean registry to get its own.
    resetSharedRuntime();
    mockGetOauthState.mockReturnValue("google_test-state-123");

    // Mock window.location
    Object.defineProperty(global, "window", {
      value: {
        location: {origin: "https://example.com"},
      },
      writable: true,
      configurable: true,
    });
  });

  describe("buildOAuthUrl", () => {
    it("should build basic OAuth URL", () => {
      const url = buildOAuthUrl(
        {clientId: "client-123"},
        {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid", "profile", "email"],
          responseType: "code",
        },
        "test-state"
      );

      expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth?");
      expect(url).toContain("client_id=client-123");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fexample.com");
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=openid+profile+email");
      expect(url).toContain("state=test-state");
    });

    it("should include custom scope", () => {
      const url = buildOAuthUrl(
        {clientId: "client-123", scope: "custom-scope"},
        {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
        "test-state"
      );

      expect(url).toContain("scope=openid+custom-scope");
    });

    it("should add nonce for id_token response type", () => {
      const url = buildOAuthUrl(
        {clientId: "client-123"},
        {
          name: "Apple",
          authBaseUrl: "https://appleid.apple.com/auth/authorize",
          defaultScopes: ["name", "email"],
          responseType: "code id_token",
        },
        "test-nonce"
      );

      expect(url).toContain("nonce=test-nonce");
    });

    it("should include response_mode when specified", () => {
      const url = buildOAuthUrl(
        {clientId: "client-123"},
        {
          name: "Apple",
          authBaseUrl: "https://appleid.apple.com/auth/authorize",
          defaultScopes: ["name", "email"],
          responseType: "code",
          responseMode: "form_post",
        },
        "test-state"
      );

      expect(url).toContain("response_mode=form_post");
    });

    it("should include additional parameters", () => {
      const url = buildOAuthUrl(
        {clientId: "client-123"},
        {
          name: "Microsoft",
          authBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
          defaultScopes: ["openid"],
          responseType: "code",
          additionalParams: {
            prompt: "consent",
            access_type: "offline",
          },
        },
        "test-state"
      );

      expect(url).toContain("prompt=consent");
      expect(url).toContain("access_type=offline");
    });
  });

  describe("createOAuthProvider", () => {
    it("should create provider with null initial config", () => {
      const provider = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      expect(provider.config.get()).toBeNull();
      expect(provider.authUrl.get()).toBeNull();
    });

    it("should update auth URL when config is set", () => {
      const provider = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      provider.config.set({clientId: "test-client-id"});
      provider.updateAuthUrl();

      const authUrl = provider.authUrl.get();
      expect(authUrl).toContain("client_id=test-client-id");
      expect(authUrl).toContain("state=google_test-state-123");
    });

    it("should warn when updating URL without config", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const provider = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      provider.updateAuthUrl();

      expect(warnSpy).toHaveBeenCalledWith("Google provider not configured. Check initClient method.");
      expect(provider.authUrl.get()).toBeNull();

      warnSpy.mockRestore();
    });
  });

  describe("warnProviderNotConfigured", () => {
    it("should log warning message", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      warnProviderNotConfigured("TestProvider");

      expect(warnSpy).toHaveBeenCalledWith("TestProvider provider not configured. Check initClient method.");

      warnSpy.mockRestore();
    });
  });
});
