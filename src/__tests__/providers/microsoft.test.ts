/**
 * Microsoft Provider Tests
 * Tests: microsoftConfig, microsoftAuthUrl, updateMicrosoftAuthUrl
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {microsoftConfig, microsoftAuthUrl, updateMicrosoftAuthUrl} from "@/providers";

// Mock state module
vi.mock("../../auth/state", () => ({
  getOauthState: vi.fn(() => "microsoft_state_abcde"),
}));

// Mock window.location
const originalLocation = global.window?.location;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset atoms
  microsoftConfig.set(null);
  microsoftAuthUrl.set(null);

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

describe("Microsoft Provider", () => {
  describe("microsoftConfig", () => {
    it("should initialize as null", () => {
      expect(microsoftConfig.get()).toBeNull();
    });

    it("should accept valid configuration", () => {
      const config = {clientId: "ms-client-id-12345"};
      microsoftConfig.set(config);
      expect(microsoftConfig.get()).toEqual(config);
    });

    it("should accept configuration with custom scope", () => {
      const config = {clientId: "client-id", scope: "User.Read Calendars.Read"};
      microsoftConfig.set(config);
      expect(microsoftConfig.get()).toEqual(config);
    });

    it("should allow configuration updates", () => {
      microsoftConfig.set({clientId: "old-client-id"});
      expect(microsoftConfig.get()?.clientId).toBe("old-client-id");

      microsoftConfig.set({clientId: "new-client-id"});
      expect(microsoftConfig.get()?.clientId).toBe("new-client-id");
    });
  });

  describe("microsoftAuthUrl", () => {
    it("should initialize as null", () => {
      expect(microsoftAuthUrl.get()).toBeNull();
    });

    it("should be null when config is not set", () => {
      updateMicrosoftAuthUrl();
      expect(microsoftAuthUrl.get()).toBeNull();
    });

    it("should generate auth URL when config is set", () => {
      microsoftConfig.set({clientId: "ms-client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).not.toBeNull();
      expect(authUrl).toContain("https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
      expect(authUrl).toContain("client_id=ms-client-123");
    });

    it("should include Microsoft default scopes", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("openid");
      expect(authUrl).toContain("profile");
      expect(authUrl).toContain("email");
    });

    it("should include custom scope when provided", () => {
      microsoftConfig.set({clientId: "client-123", scope: "User.Read"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("User.Read");
    });

    it("should use id_token response type", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("response_type=id_token");
    });

    it("should include nonce for id_token", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("nonce=microsoft_state_abcde");
    });

    it("should use fragment response mode", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("response_mode=fragment");
    });

    it("should include state parameter", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("state=microsoft_state_abcde");
    });

    it("should include redirect_uri", () => {
      microsoftConfig.set({clientId: "client-123"});
      updateMicrosoftAuthUrl();

      const authUrl = microsoftAuthUrl.get();
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fapp.example.com");
    });
  });

  describe("updateMicrosoftAuthUrl", () => {
    it("should warn and set null when config is not set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateMicrosoftAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Microsoft provider not configured. Check initClient method.");
      expect(microsoftAuthUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it("should update URL when called multiple times", () => {
      microsoftConfig.set({clientId: "client-123"});

      updateMicrosoftAuthUrl();
      const firstUrl = microsoftAuthUrl.get();

      updateMicrosoftAuthUrl();
      const secondUrl = microsoftAuthUrl.get();

      expect(firstUrl).not.toBeNull();
      expect(secondUrl).not.toBeNull();
      expect(firstUrl).toBe(secondUrl);
    });

    it("should update URL after config changes", () => {
      microsoftConfig.set({clientId: "old-client-id"});
      updateMicrosoftAuthUrl();
      const oldUrl = microsoftAuthUrl.get();

      microsoftConfig.set({clientId: "new-client-id"});
      updateMicrosoftAuthUrl();
      const newUrl = microsoftAuthUrl.get();

      expect(oldUrl).toContain("old-client-id");
      expect(newUrl).toContain("new-client-id");
    });
  });
});
