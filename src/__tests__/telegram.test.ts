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
    it("should warn and set null when config is not set", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      telegramConfig.set(null);
      updateTelegramAuthUrl();

      expect(warnSpy).toHaveBeenCalledWith("Telegram provider not configured. Check initClient method.");
      expect(telegramAuthUrl.get()).toBeNull();

      warnSpy.mockRestore();
    });
  });
});
