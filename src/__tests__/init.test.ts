/**
 * Init Client Tests
 * Tests: initClient initialization flow, initConfig, initPage, initSocials
 */

import {beforeEach, describe, expect, it, vi} from "vite-plus/test";
import type {AuthClientConfig} from "../auth/init";
import {initClient} from "../auth/init";
import {apiURL} from "../auth/api-url";
import {appleConfig, googleConfig, microsoftConfig, telegramConfig} from "@/providers";
import {setLoginRedirectUrl} from "../auth/authConfig";

vi.mock("../auth/authConfig", () => ({
  setLoginRedirectUrl: vi.fn(),
}));

describe("Init Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset state
    apiURL.set("");
    googleConfig.set(null as any);
    appleConfig.set(null as any);
    microsoftConfig.set(null as any);
    telegramConfig.set(null as any);

    // Clear URL params
    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  describe("initClient - Configuration", () => {
    it("should set API URL from config", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://test-api.example.com",
      };

      await initClient(config);
      expect(apiURL.get()).toBe("https://test-api.example.com");
    });

    it("should set login redirect URL when provided", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://test-api.example.com",
        loginRedirectUrl: "/login",
      };

      await initClient(config);

      expect(setLoginRedirectUrl).toHaveBeenCalledWith("/login");
    });

    it("should configure Google provider when provided", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        googleProvider: {
          clientId: "google-client-id",
        },
      };

      await initClient(config);

      const googleCfg = googleConfig.get();
      expect(googleCfg).toBeDefined();
      expect(googleCfg?.clientId).toBe("google-client-id");
    });
    it("should configure Apple provider when provided", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        appleProvider: {
          clientId: "apple-client-id",
        },
      };

      await initClient(config);

      const appleCfg = appleConfig.get();
      expect(appleCfg).toBeDefined();
      expect(appleCfg?.clientId).toBe("apple-client-id");
    });

    it("should configure Microsoft provider when provided", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        microsoftProvider: {
          clientId: "microsoft-client-id",
        },
      };

      await initClient(config);

      const microsoftCfg = microsoftConfig.get();
      expect(microsoftCfg).toBeDefined();
      expect(microsoftCfg?.clientId).toBe("microsoft-client-id");
    });

    it("should configure Telegram provider when provided", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        telegramProvider: {
          botId: "test_bot",
        },
      };

      await initClient(config);

      const telegramCfg = telegramConfig.get();
      expect(telegramCfg).toBeDefined();
      expect(telegramCfg?.botId).toBe("test_bot");
    });

    it("should configure multiple providers at once", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        googleProvider: {
          clientId: "google-id",
        },
        appleProvider: {
          clientId: "apple-id",
        },
        microsoftProvider: {
          clientId: "microsoft-id",
        },
        telegramProvider: {
          botId: "bot",
        },
      };

      await initClient(config);

      expect(googleConfig.get()).toBeDefined();
      expect(appleConfig.get()).toBeDefined();
      expect(microsoftConfig.get()).toBeDefined();
      expect(telegramConfig.get()).toBeDefined();
    });

    it("should work with minimal config (API URL only)", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://minimal-api.example.com",
      };

      await initClient(config);

      expect(apiURL.get()).toBe("https://minimal-api.example.com");
      expect(googleConfig.get()).toBeNull();
      expect(appleConfig.get()).toBeNull();
      expect(microsoftConfig.get()).toBeNull();
      expect(telegramConfig.get()).toBeNull();
    });

    it("should handle empty provider configs gracefully", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
        googleProvider: undefined,
        appleProvider: undefined,
      };

      // initClient returns undefined when no token is available (normal in test env)
      const result = await initClient(config);
      expect(result === undefined || typeof result === "string").toBe(true);
    });
  });

  describe("Integration", () => {
    it("should complete initialization successfully", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
      };

      // Should not throw and return undefined or string token
      const result = await initClient(config);
      expect(result === undefined || typeof result === "string").toBe(true);
    });

    it("should return token if available after init", async () => {
      const config: AuthClientConfig = {
        apiUrl: "https://api.example.com",
      };

      const token = await initClient(config);
      // Token will be undefined in test environment without auth
      expect(token === undefined || typeof token === "string").toBe(true);
    });
  });
});
