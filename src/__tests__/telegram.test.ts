/**
 * Telegram Provider Tests
 * Tests: telegramConfig, telegramAuthUrl, updateTelegramAuthUrl
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {telegramConfig, telegramAuthUrl, updateTelegramAuthUrl} from "@/providers";

describe("Telegram Provider", () => {
  beforeEach(() => {
    telegramConfig.set(null);
    telegramAuthUrl.set(null);

    // Mock window.location
    const mockLocation = {
      origin: "https://example.com",
      pathname: "/app",
    };

    Object.defineProperty(global, "window", {
      value: {
        location: mockLocation,
      },
      writable: true,
      configurable: true,
    });

    // Mock global location (used without window. prefix)
    Object.defineProperty(global, "location", {
      value: mockLocation,
      writable: true,
      configurable: true,
    });
  });

  describe("telegramConfig atom", () => {
    it("should initialize as null", () => {
      expect(telegramConfig.get()).toBeNull();
    });

    it("should set and get config", () => {
      const config = {botId: "123456789"};
      telegramConfig.set(config);

      expect(telegramConfig.get()).toEqual(config);
    });

    it("should update config", () => {
      telegramConfig.set({botId: "111111111"});
      expect(telegramConfig.get()?.botId).toBe("111111111");

      telegramConfig.set({botId: "222222222"});
      expect(telegramConfig.get()?.botId).toBe("222222222");
    });
  });

  describe("telegramAuthUrl atom", () => {
    it("should initialize as null", () => {
      expect(telegramAuthUrl.get()).toBeNull();
    });

    it("should set and get URL", () => {
      const url = "https://oauth.telegram.org/auth?bot_id=123";
      telegramAuthUrl.set(url);

      expect(telegramAuthUrl.get()).toBe(url);
    });
  });

  describe("updateTelegramAuthUrl", () => {
    it("should generate Telegram auth URL with bot ID", () => {
      telegramConfig.set({botId: "123456789"});
      updateTelegramAuthUrl();

      const url = telegramAuthUrl.get();
      expect(url).toContain("https://oauth.telegram.org/auth?");
      expect(url).toContain("bot_id=123456789");
      expect(url).toContain("origin=https%3A%2F%2Fexample.com");
      expect(url).toContain("return_to=https%3A%2F%2Fexample.com%2Fapp");
    });

    it("should URL encode origin and return_to", () => {
      telegramConfig.set({botId: "987654321"});
      updateTelegramAuthUrl();

      const url = telegramAuthUrl.get();

      // Should encode special characters
      expect(url).toContain("origin=https%3A%2F%2Fexample.com");
      expect(url).not.toContain("origin=https://example.com");
    });

    it("should warn and set null when config is not set", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      telegramConfig.set(null);
      updateTelegramAuthUrl();

      expect(warnSpy).toHaveBeenCalledWith("Telegram provider not configured. Check initClient method.");
      expect(telegramAuthUrl.get()).toBeNull();

      warnSpy.mockRestore();
    });

    it("should update URL when config changes", () => {
      telegramConfig.set({botId: "111111111"});
      updateTelegramAuthUrl();
      const url1 = telegramAuthUrl.get();

      telegramConfig.set({botId: "222222222"});
      updateTelegramAuthUrl();
      const url2 = telegramAuthUrl.get();

      expect(url1).toContain("bot_id=111111111");
      expect(url2).toContain("bot_id=222222222");
      expect(url1).not.toBe(url2);
    });

    it("should use current window location", () => {
      const mockLocation = {
        origin: "https://different-site.com",
        pathname: "/custom/path",
      };

      Object.defineProperty(global, "window", {
        value: {
          location: mockLocation,
        },
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global, "location", {
        value: mockLocation,
        writable: true,
        configurable: true,
      });

      telegramConfig.set({botId: "123456789"});
      updateTelegramAuthUrl();

      const url = telegramAuthUrl.get();
      expect(url).toContain("origin=https%3A%2F%2Fdifferent-site.com");
      expect(url).toContain("return_to=https%3A%2F%2Fdifferent-site.com%2Fcustom%2Fpath");
    });

    it("should handle bot ID with special characters", () => {
      telegramConfig.set({botId: "bot:123_456"});
      updateTelegramAuthUrl();

      const url = telegramAuthUrl.get();
      expect(url).toContain("bot_id=bot%3A123_456");
    });
  });
});
