/**
 * Google Provider Tests
 * Tests: googleConfig, googleAuthUrl, updateGoogleAuthUrl
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {googleConfig, googleAuthUrl, updateGoogleAuthUrl} from "@/providers/google";

// Mock state module
vi.mock("../../auth/state", () => ({
  getOauthState: vi.fn(() => "google_state_12345"),
}));

// Mock window.location
const originalLocation = global.window?.location;

beforeEach(() => {
  vi.clearAllMocks();

  // Reset atoms
  googleConfig.set(null);
  googleAuthUrl.set(null);

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

describe("Google Provider", () => {
  describe("googleConfig", () => {
    it("should initialize as null", () => {
      expect(googleConfig.get()).toBeNull();
    });

    it("should accept valid configuration", () => {
      const config = {clientId: "google-client-id-123"};
      googleConfig.set(config);
      expect(googleConfig.get()).toEqual(config);
    });

    it("should accept configuration with custom scope", () => {
      const config = {clientId: "client-id", scope: "profile"};
      googleConfig.set(config);
      expect(googleConfig.get()).toEqual(config);
    });

    it("should allow updating configuration", () => {
      googleConfig.set({clientId: "old-id"});
      expect(googleConfig.get()?.clientId).toBe("old-id");

      googleConfig.set({clientId: "new-id"});
      expect(googleConfig.get()?.clientId).toBe("new-id");
    });
  });

  describe("googleAuthUrl", () => {
    it("should initialize as null", () => {
      expect(googleAuthUrl.get()).toBeNull();
    });

    it("should be null when config is not set", () => {
      updateGoogleAuthUrl();
      expect(googleAuthUrl.get()).toBeNull();
    });

    it("should generate auth URL when config is set", () => {
      googleConfig.set({clientId: "test-client-id"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).not.toBeNull();
      expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authUrl).toContain("client_id=test-client-id");
    });

    it("should include Google default scopes", () => {
      googleConfig.set({clientId: "client-123"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("openid");
      expect(authUrl).toContain("https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email");
      expect(authUrl).toContain("https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile");
    });

    it("should include custom scope when provided", () => {
      googleConfig.set({clientId: "client-123", scope: "calendar"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("calendar");
    });

    it("should use id_token response type", () => {
      googleConfig.set({clientId: "client-123"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("response_type=id_token");
    });

    it("should include nonce for id_token", () => {
      googleConfig.set({clientId: "client-123"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("nonce=google_state_12345");
    });

    it("should include state parameter", () => {
      googleConfig.set({clientId: "client-123"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("state=google_state_12345");
    });

    it("should include redirect_uri", () => {
      googleConfig.set({clientId: "client-123"});
      updateGoogleAuthUrl();

      const authUrl = googleAuthUrl.get();
      expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fapp.example.com");
    });
  });

  describe("updateGoogleAuthUrl", () => {
    it("should warn and set null when config is not set", () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateGoogleAuthUrl();

      expect(consoleWarnSpy).toHaveBeenCalledWith("Google provider not configured. Check initClient method.");
      expect(googleAuthUrl.get()).toBeNull();

      consoleWarnSpy.mockRestore();
    });

    it("should update URL when called multiple times", () => {
      googleConfig.set({clientId: "client-123"});

      updateGoogleAuthUrl();
      const firstUrl = googleAuthUrl.get();

      updateGoogleAuthUrl();
      const secondUrl = googleAuthUrl.get();

      expect(firstUrl).not.toBeNull();
      expect(secondUrl).not.toBeNull();
      expect(firstUrl).toBe(secondUrl);
    });

    it("should update URL after config changes", () => {
      googleConfig.set({clientId: "old-client-id"});
      updateGoogleAuthUrl();
      const oldUrl = googleAuthUrl.get();

      googleConfig.set({clientId: "new-client-id"});
      updateGoogleAuthUrl();
      const newUrl = googleAuthUrl.get();

      expect(oldUrl).toContain("old-client-id");
      expect(newUrl).toContain("new-client-id");
    });
  });
});
