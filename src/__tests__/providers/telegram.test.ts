/**
 * Telegram Provider Tests
 * Tests: telegramConfig, telegramAuthUrl, updateTelegramAuthUrl
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {telegramConfig, telegramAuthUrl, updateTelegramAuthUrl} from "@/providers";
import {readTelegramCode} from "@/providers/telegram";
import * as urlModule from "@/url";
import * as stateModule from "@/state";
import {getPkceVerifier, pkceChallenge} from "@/pkce";

// Mock window.location
const originalLocation = global.window?.location;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset atoms
  telegramConfig.set(null);
  telegramAuthUrl.set(null);

  // Mock window.location and global location
  delete (global as any).window;
  delete (global as any).location;

  const mockLocation = {
    origin: "https://app.example.com",
    pathname: "/callback",
    href: "https://app.example.com/callback",
  };

  (global as any).window = {
    location: mockLocation,
  };
  (global as any).location = mockLocation;
});

afterEach(() => {
  if (originalLocation) {
    (global as any).window.location = originalLocation;
  }
});

describe("Telegram Provider", () => {
  describe("telegramConfig", () => {
    it("should initialize as null", () => {
      expect(telegramConfig.get()).toBeNull();
    });

    it("should accept valid configuration", () => {
      const config = {botId: "mybot"};
      telegramConfig.set(config);
      expect(telegramConfig.get()).toEqual(config);
    });

    it("should accept different bot IDs", () => {
      telegramConfig.set({botId: "testbot"});
      expect(telegramConfig.get()?.botId).toBe("testbot");

      telegramConfig.set({botId: "anotherbot"});
      expect(telegramConfig.get()?.botId).toBe("anotherbot");
    });

    it("should allow configuration updates", () => {
      telegramConfig.set({botId: "oldbot"});
      expect(telegramConfig.get()?.botId).toBe("oldbot");

      telegramConfig.set({botId: "newbot"});
      expect(telegramConfig.get()?.botId).toBe("newbot");
    });
  });

  describe("telegramAuthUrl", () => {
    it("should initialize as null", () => {
      expect(telegramAuthUrl.get()).toBeNull();
    });

    it("should be null when config is not set", () => {
      updateTelegramAuthUrl();
      expect(telegramAuthUrl.get()).toBeNull();
    });

    it("should generate auth URL when config is set", () => {
      telegramConfig.set({botId: "mybot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).not.toBeNull();
      expect(authUrl).toContain("https://oauth.telegram.org/auth");
      expect(authUrl).toContain("bot_id=mybot");
    });

    it("should include origin parameter", () => {
      telegramConfig.set({botId: "testbot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("origin=https%3A%2F%2Fapp.example.com");
    });

    it("should include return_to parameter with pathname", () => {
      telegramConfig.set({botId: "testbot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("return_to=https%3A%2F%2Fapp.example.com%2Fcallback");
    });

    it("should URL encode bot_id", () => {
      telegramConfig.set({botId: "bot with spaces"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("bot_id=bot%20with%20spaces");
    });

    it("should handle different pathnames", () => {
      const newLocation = {
        origin: "https://app.example.com",
        pathname: "/auth/telegram",
        href: "https://app.example.com/auth/telegram",
      };
      (global as any).window.location = newLocation;
      (global as any).location = newLocation;

      telegramConfig.set({botId: "mybot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("return_to=https%3A%2F%2Fapp.example.com%2Fauth%2Ftelegram");
    });

    it("should handle root pathname", () => {
      const newLocation = {
        origin: "https://app.example.com",
        pathname: "/",
        href: "https://app.example.com/",
      };
      (global as any).window.location = newLocation;
      (global as any).location = newLocation;

      telegramConfig.set({botId: "mybot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("return_to=https%3A%2F%2Fapp.example.com%2F");
    });

    it("should handle localhost origin", () => {
      const newLocation = {
        origin: "http://localhost:3000",
        pathname: "/callback",
        href: "http://localhost:3000/callback",
      };
      (global as any).window.location = newLocation;
      (global as any).location = newLocation;

      telegramConfig.set({botId: "devbot"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("origin=http%3A%2F%2Flocalhost%3A3000");
      expect(authUrl).toContain("return_to=http%3A%2F%2Flocalhost%3A3000%2Fcallback");
    });
  });

  describe("updateTelegramAuthUrl", () => {
    it("should warn and set null when config is not set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateTelegramAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Telegram provider not configured. Check initClient method.");
      expect(telegramAuthUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it("should update URL when called multiple times", () => {
      telegramConfig.set({botId: "mybot"});

      updateTelegramAuthUrl();
      const firstUrl = telegramAuthUrl.get();

      updateTelegramAuthUrl();
      const secondUrl = telegramAuthUrl.get();

      expect(firstUrl).not.toBeNull();
      expect(secondUrl).not.toBeNull();
      expect(firstUrl).toBe(secondUrl);
    });

    it("should update URL after config changes", () => {
      telegramConfig.set({botId: "oldbot"});
      updateTelegramAuthUrl();
      const oldUrl = telegramAuthUrl.get();

      telegramConfig.set({botId: "newbot"});
      updateTelegramAuthUrl();
      const newUrl = telegramAuthUrl.get();

      expect(oldUrl).toContain("oldbot");
      expect(newUrl).toContain("newbot");
    });

    it("should handle special characters in bot ID", () => {
      telegramConfig.set({botId: "bot_with_underscore"});
      updateTelegramAuthUrl();

      const authUrl = telegramAuthUrl.get();
      expect(authUrl).toContain("bot_id=bot_with_underscore");
    });

    it("should update when location changes", () => {
      telegramConfig.set({botId: "mybot"});
      updateTelegramAuthUrl();
      const firstUrl = telegramAuthUrl.get();

      const newLocation = {
        origin: "https://app.example.com",
        pathname: "/new-path",
        href: "https://app.example.com/new-path",
      };
      (global as any).window.location = newLocation;
      (global as any).location = newLocation;
      updateTelegramAuthUrl();
      const secondUrl = telegramAuthUrl.get();

      expect(firstUrl).toContain("%2Fcallback");
      expect(secondUrl).toContain("%2Fnew-path");
    });
  });

  describe("OpenID Connect code flow", () => {
    const waitForAuthUrl = () =>
      new Promise<string>((resolve) => {
        const unbind = telegramAuthUrl.subscribe((url) => {
          if (!url) return;
          queueMicrotask(() => unbind());
          resolve(url);
        });
      });

    beforeEach(() => {
      sessionStorage.clear();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("requests an authorization code with a PKCE S256 challenge", async () => {
      telegramConfig.set({botId: "123456", oidc: true});

      updateTelegramAuthUrl();
      const url = new URL(await waitForAuthUrl());

      expect(url.origin + url.pathname).toBe("https://oauth.telegram.org/auth");
      expect(url.searchParams.get("client_id")).toBe("123456");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("scope")).toBe("openid profile");
      expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com");
      expect(url.searchParams.get("state")).toMatch(/^telegram_/);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toBe(await pkceChallenge(getPkceVerifier("telegram")));
    });

    it("uses the configured redirect URI", async () => {
      telegramConfig.set({botId: "123456", oidc: true, redirectUri: "https://app.example.com/login"});

      updateTelegramAuthUrl();
      const url = new URL(await waitForAuthUrl());

      expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/login");
    });

    it("reads the code Telegram sent back with its verifier and redirect URI", () => {
      telegramConfig.set({botId: "123456", oidc: true});
      const verifier = getPkceVerifier("telegram");
      vi.spyOn(urlModule.urlParams, "has").mockImplementation((key: string) => key === "code");
      vi.spyOn(urlModule.urlParams, "get").mockImplementation((key: string) => ({code: "auth-code", state: "telegram_abc"})[key] ?? null);
      vi.spyOn(stateModule, "validateOAuthState").mockReturnValue(true);

      expect(readTelegramCode()).toEqual({
        authorizationCode: {code: "auth-code", codeVerifier: verifier, redirectUri: "https://app.example.com"},
      });
    });

    it("ignores a code it holds no verifier for", () => {
      telegramConfig.set({botId: "123456", oidc: true});
      vi.spyOn(urlModule.urlParams, "has").mockImplementation((key: string) => key === "code");
      vi.spyOn(urlModule.urlParams, "get").mockImplementation((key: string) => ({code: "auth-code", state: "telegram_abc"})[key] ?? null);
      vi.spyOn(stateModule, "validateOAuthState").mockReturnValue(true);

      expect(readTelegramCode()).toBeUndefined();
    });

    it("has no code to read when Telegram is not configured", () => {
      expect(readTelegramCode()).toBeUndefined();
    });
  });
});
