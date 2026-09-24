/**
 * Apple Provider Tests
 * Tests: appleConfig, appleAuthUrl, updateAppleAuthUrl
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {appleConfig, appleAuthUrl, updateAppleAuthUrl} from "@/providers";

// Mock state module
vi.mock("../../auth/state", () => ({
  getOauthState: vi.fn(() => "apple_state_67890"),
}));

// Mock window.location
const originalLocation = global.window?.location;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset atoms
  appleConfig.set(null);
  appleAuthUrl.set(null);

  // Mock window.location
  delete (global as any).window;
  (global as any).window = {
    location: {
      origin: "https://app.example.com",
      href: "https://app.example.com/",
    },
  };
});

afterEach(() => {
  if (originalLocation) {
    (global as any).window.location = originalLocation;
  }
});

describe("Apple Provider", () => {
  describe("appleConfig", () => {
    it("should initialize as null", () => {
      expect(appleConfig.get()).toBeNull();
    });

    it("should accept valid configuration", () => {
      const config = {clientId: "com.example.app"};
      appleConfig.set(config);
      expect(appleConfig.get()).toEqual(config);
    });

    it("should accept configuration with custom scope", () => {
      const config = {clientId: "com.example.app", scope: "name email"};
      appleConfig.set(config);
      expect(appleConfig.get()).toEqual(config);
    });

    it("should allow configuration updates", () => {
      appleConfig.set({clientId: "old.bundle.id"});
      expect(appleConfig.get()?.clientId).toBe("old.bundle.id");

      appleConfig.set({clientId: "new.bundle.id"});
      expect(appleConfig.get()?.clientId).toBe("new.bundle.id");
    });
  });

  describe("appleAuthUrl", () => {
    it("should initialize as null", () => {
      expect(appleAuthUrl.get()).toBeNull();
    });

    it("should be null when config is not set", () => {
      updateAppleAuthUrl();
      expect(appleAuthUrl.get()).toBeNull();
    });

    it("should generate auth URL when config is set", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).not.toBeNull();
      expect(authUrl).toContain("https://appleid.apple.com/auth/authorize");
      expect(authUrl).toContain("client_id=com.example.app");
    });

    it("should include Apple default scope (openid)", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("scope=openid");
    });

    it("should include custom scope when provided", () => {
      appleConfig.set({clientId: "com.example.app", scope: "name email"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("name");
      expect(authUrl).toContain("email");
    });

    it("should use hybrid response type (code id_token)", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("response_type=code+id_token");
    });

    it("should include nonce for id_token", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("nonce=apple_state_67890");
    });

    it("should use fragment response mode", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("response_mode=fragment");
    });

    it("should include state parameter", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("state=apple_state_67890");
    });

    it("should include redirect_uri", () => {
      appleConfig.set({clientId: "com.example.app"});
      updateAppleAuthUrl();

      const authUrl = appleAuthUrl.get();
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fapp.example.com");
    });
  });

  describe("updateAppleAuthUrl", () => {
    it("should warn and set null when config is not set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateAppleAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Apple provider not configured. Check initClient method.");
      expect(appleAuthUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it("should update URL when called multiple times", () => {
      appleConfig.set({clientId: "com.example.app"});

      updateAppleAuthUrl();
      const firstUrl = appleAuthUrl.get();

      updateAppleAuthUrl();
      const secondUrl = appleAuthUrl.get();

      expect(firstUrl).not.toBeNull();
      expect(secondUrl).not.toBeNull();
      expect(firstUrl).toBe(secondUrl);
    });

    it("should update URL after config changes", () => {
      appleConfig.set({clientId: "com.old.app"});
      updateAppleAuthUrl();
      const oldUrl = appleAuthUrl.get();

      appleConfig.set({clientId: "com.new.app"});
      updateAppleAuthUrl();
      const newUrl = appleAuthUrl.get();

      expect(oldUrl).toContain("com.old.app");
      expect(newUrl).toContain("com.new.app");
    });
  });
});
