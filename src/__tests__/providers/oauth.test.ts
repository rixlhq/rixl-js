/**
 * OAuth Provider Module Tests
 * Tests: buildOAuthUrl, warnProviderNotConfigured, createOAuthProvider
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {
  buildOAuthUrl,
  warnProviderNotConfigured,
  createOAuthProvider,
  type OAuthProviderConfig,
  type OAuthProviderMetadata,
} from "@/providers/oauth.ts";
import {AuthProvider} from "@/providers";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";

// Mock state module
vi.mock("../../auth/state", () => ({
  getOauthState: vi.fn((provider: string) => `${provider}_state_123456`),
}));

// Mock window.location for tests
const originalLocation = global.window?.location;

beforeEach(() => {
  vi.clearAllMocks();
  // Providers created here share their atoms with every other copy of the
  // package, so each case needs a clean registry to get its own.
  resetSharedRuntime();

  // Mock window.location
  delete (global as any).window;
  (global as any).window = {
    location: {
      origin: "https://app.example.com",
      pathname: "/",
      href: "https://app.example.com/",
    },
  };
});

afterEach(() => {
  if (originalLocation) {
    (global as any).window.location = originalLocation;
  }
});

describe("OAuth Provider Module", () => {
  describe("buildOAuthUrl", () => {
    it("should build basic OAuth URL", () => {
      const config: OAuthProviderConfig = {
        clientId: "test-client-id",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Test Provider",
        authBaseUrl: "https://auth.example.com/authorize",
        defaultScopes: ["openid", "email"],
        responseType: "code",
      };

      const state = "test_state_123";
      const url = buildOAuthUrl(config, metadata, state);

      expect(url).toContain("https://auth.example.com/authorize?");
      expect(url).toContain("client_id=test-client-id");
      expect(url).toContain("redirect_uri=https%3A%2F%2Fapp.example.com");
      expect(url).toContain("response_type=code");
      expect(url).toContain("scope=openid+email");
      expect(url).toContain("state=test_state_123");
    });

    it("should include custom scope when provided", () => {
      const config: OAuthProviderConfig = {
        clientId: "client123",
        scope: "profile",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/oauth",
        defaultScopes: ["openid"],
        responseType: "token",
      };

      const url = buildOAuthUrl(config, metadata, "state456");

      expect(url).toContain("scope=openid+profile");
    });

    it("should add nonce when response_type includes id_token", () => {
      const config: OAuthProviderConfig = {
        clientId: "client789",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "id_token",
      };

      const state = "state_with_nonce";
      const url = buildOAuthUrl(config, metadata, state);

      expect(url).toContain("nonce=state_with_nonce");
      expect(url).toContain("response_type=id_token");
    });

    it("should add nonce for hybrid flow with id_token", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-hybrid",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code id_token",
      };

      const url = buildOAuthUrl(config, metadata, "hybrid_state");

      expect(url).toContain("nonce=hybrid_state");
    });

    it("should not add nonce when response_type is code only", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-code",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
      };

      const url = buildOAuthUrl(config, metadata, "code_state");

      expect(url).not.toContain("nonce=");
    });

    it("should add response_mode when specified", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-mode",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "id_token",
        responseMode: "fragment",
      };

      const url = buildOAuthUrl(config, metadata, "mode_state");

      expect(url).toContain("response_mode=fragment");
    });

    it("should not add response_mode when not specified", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-no-mode",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
      };

      const url = buildOAuthUrl(config, metadata, "state");

      expect(url).not.toContain("response_mode=");
    });

    it("should add additional params when provided", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-additional",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
        additionalParams: {
          prompt: "consent",
          access_type: "offline",
        },
      };

      const url = buildOAuthUrl(config, metadata, "state");

      expect(url).toContain("prompt=consent");
      expect(url).toContain("access_type=offline");
    });

    it("should handle multiple additional params", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-multi",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
        additionalParams: {
          param1: "value1",
          param2: "value2",
          param3: "value3",
        },
      };

      const url = buildOAuthUrl(config, metadata, "state");

      expect(url).toContain("param1=value1");
      expect(url).toContain("param2=value2");
      expect(url).toContain("param3=value3");
    });

    it("should handle multiple scopes correctly", () => {
      const config: OAuthProviderConfig = {
        clientId: "client-scopes",
        scope: "profile address phone",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid", "email"],
        responseType: "code",
      };

      const url = buildOAuthUrl(config, metadata, "state");

      expect(url).toContain("scope=openid+email+profile+address+phone");
    });

    it("should URL encode parameters correctly", () => {
      const config: OAuthProviderConfig = {
        clientId: "client with spaces",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
      };

      const url = buildOAuthUrl(config, metadata, "state");

      expect(url).toContain("client_id=client+with+spaces");
    });

    it("should handle special characters in state", () => {
      const config: OAuthProviderConfig = {
        clientId: "client123",
      };

      const metadata: OAuthProviderMetadata = {
        name: "Provider",
        authBaseUrl: "https://auth.example.com/auth",
        defaultScopes: ["openid"],
        responseType: "code",
      };

      const state = "state_with_special!@#$%";
      const url = buildOAuthUrl(config, metadata, state);

      expect(url).toContain("state=");
    });
  });

  describe("warnProviderNotConfigured", () => {
    it("should log warning for unconfigured provider", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      warnProviderNotConfigured("Google");

      expect(consoleWarnSpy).toHaveBeenCalledWith("Google provider not configured. Check initClient method.");

      consoleWarnSpy.mockRestore();
    });

    it("should handle different provider names", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      warnProviderNotConfigured("Apple");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Apple provider not configured. Check initClient method.");

      warnProviderNotConfigured("Microsoft");
      expect(consoleWarnSpy).toHaveBeenCalledWith("Microsoft provider not configured. Check initClient method.");

      consoleWarnSpy.mockRestore();
    });
  });

  describe("createOAuthProvider", () => {
    it("should create provider with config and authUrl atoms", () => {
      const result = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
          defaultScopes: ["openid", "email"],
          responseType: "id_token",
        },
      });

      expect(result).toHaveProperty("config");
      expect(result).toHaveProperty("authUrl");
      expect(result).toHaveProperty("updateAuthUrl");
      expect(typeof result.updateAuthUrl).toBe("function");
    });

    it("should initialize with null config and authUrl", () => {
      const result = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      expect(result.config.get()).toBeNull();
      expect(result.authUrl.get()).toBeNull();
    });

    it("should update authUrl when config is set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/auth",
          defaultScopes: ["openid", "email"],
          responseType: "id_token",
        },
      });

      // Initially null
      expect(result.authUrl.get()).toBeNull();

      // Set config
      result.config.set({clientId: "test-client-id"});

      // Update auth URL
      result.updateAuthUrl();

      // Should now have a URL
      const authUrl = result.authUrl.get();
      expect(authUrl).not.toBeNull();
      expect(authUrl).toContain("https://accounts.google.com/auth");
      expect(authUrl).toContain("client_id=test-client-id");

      consoleWarnSpy.mockRestore();
    });

    it("should warn and set null when updateAuthUrl is called without config", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = createOAuthProvider({
        provider: AuthProvider.APPLE,
        metadata: {
          name: "Apple",
          authBaseUrl: "https://appleid.apple.com/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      result.updateAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Apple provider not configured. Check initClient method.");
      expect(result.authUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it("should handle multiple provider types", () => {
      const googleProvider = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/auth",
          defaultScopes: ["openid"],
          responseType: "id_token",
        },
      });

      const appleProvider = createOAuthProvider({
        provider: AuthProvider.APPLE,
        metadata: {
          name: "Apple",
          authBaseUrl: "https://appleid.apple.com/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      expect(googleProvider.config.get()).toBeNull();
      expect(appleProvider.config.get()).toBeNull();
      expect(googleProvider).not.toBe(appleProvider);
    });

    it("should update authUrl with correct state for provider", async () => {
      const {getOauthState} = await import("../../auth/state");

      const result = createOAuthProvider({
        provider: AuthProvider.MICROSOFT,
        metadata: {
          name: "Microsoft",
          authBaseUrl: "https://login.microsoftonline.com/auth",
          defaultScopes: ["openid"],
          responseType: "code",
        },
      });

      result.config.set({clientId: "ms-client-id"});
      result.updateAuthUrl();

      expect(getOauthState).toHaveBeenCalledWith(AuthProvider.MICROSOFT);

      const authUrl = result.authUrl.get();
      expect(authUrl).toContain("state=microsoft_state_123456");
    });

    it("should preserve config between updateAuthUrl calls", () => {
      const result = createOAuthProvider({
        provider: AuthProvider.GOOGLE,
        metadata: {
          name: "Google",
          authBaseUrl: "https://accounts.google.com/auth",
          defaultScopes: ["openid"],
          responseType: "id_token",
        },
      });

      result.config.set({clientId: "client-1", scope: "email"});
      result.updateAuthUrl();

      const firstUrl = result.authUrl.get();

      result.updateAuthUrl();
      const secondUrl = result.authUrl.get();

      expect(firstUrl).not.toBeNull();
      expect(secondUrl).not.toBeNull();
      expect(result.config.get()).toEqual({clientId: "client-1", scope: "email"});
    });
  });
});
