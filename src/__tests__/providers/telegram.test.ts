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
  });

  describe("updateTelegramAuthUrl", () => {
    it("should warn and set null when config is not set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateTelegramAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Telegram provider not configured. Check initClient method.");
      expect(telegramAuthUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
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
      telegramConfig.set({botId: "123456"});

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
      telegramConfig.set({botId: "123456", redirectUri: "https://app.example.com/login"});

      updateTelegramAuthUrl();
      const url = new URL(await waitForAuthUrl());

      expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/login");
    });

    it("reads the code Telegram sent back with its verifier and redirect URI", () => {
      telegramConfig.set({botId: "123456"});
      const verifier = getPkceVerifier("telegram");
      vi.spyOn(urlModule.urlParams, "has").mockImplementation((key: string) => key === "code");
      vi.spyOn(urlModule.urlParams, "get").mockImplementation((key: string) => ({code: "auth-code", state: "telegram_abc"})[key] ?? null);
      vi.spyOn(stateModule, "validateOAuthState").mockReturnValue(true);

      expect(readTelegramCode()).toEqual({
        authorizationCode: {code: "auth-code", codeVerifier: verifier, redirectUri: "https://app.example.com"},
      });
    });

    it("ignores a code it holds no verifier for", () => {
      telegramConfig.set({botId: "123456"});
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
