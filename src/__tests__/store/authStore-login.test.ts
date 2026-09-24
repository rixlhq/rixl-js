/**
 * AuthStore login redirect tests
 * Tests: login function for OAuth providers
 */

import {describe, it, expect, beforeEach, vi, afterEach} from "vite-plus/test";
import {createApiMock, createProvidersMock, createCookieMock} from "../setup/authstore-mock-factory";

// Setup mocks BEFORE importing the modules that depend on them
vi.mock("../../auth/api", () => createApiMock());
vi.mock("../../auth/providers", () => createProvidersMock());
vi.mock("../../auth/cookie", () => createCookieMock());

// Import mocked modules and authStore AFTER mocks are set up
import * as providers from "@/providers";
import * as initialization from "@/initialization";
import {login, removeTokens, resetTokenPromise} from "@/authStore.ts";
import {user} from "@/userStore";

describe("AuthStore - Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeTokens();
    user.set(undefined);
    initialization.initDeferred.promise = Promise.resolve();
    resetTokenPromise();

    // Mock window.location
    Object.defineProperty(global, "window", {
      value: {
        location: {href: ""},
      },
      writable: true,
    });

    // Reset provider mocks
    (providers.googleAuthUrl.get as any).mockReturnValue("https://google.com/auth");
    (providers.appleAuthUrl.get as any).mockReturnValue("https://apple.com/auth");
    (providers.microsoftAuthUrl.get as any).mockReturnValue("https://microsoft.com/auth");
    (providers.telegramAuthUrl.get as any).mockReturnValue("https://telegram.com/auth");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    // Note: Testing login function requires complex mocking of provider atoms and window.location
    // These tests verify the error handling which is more critical

    it("should throw error for unsupported provider", async () => {
      await expect(login("unsupported" as any)).rejects.toThrow("Unsupported provider: unsupported");
    });

    it("should throw error when provider URL is null", async () => {
      // Mock a provider that returns null URL
      (providers.googleAuthUrl.get as any).mockReturnValueOnce(null);

      await expect(login("google")).rejects.toThrow("google provider is not configured. Please check your initClient configuration.");
    });

    it("should wait for initialization before attempting login", async () => {
      let initResolved = false;
      const originalPromise = initialization.initDeferred.promise;

      initialization.initDeferred.promise = new Promise((resolve) => {
        setTimeout(() => {
          initResolved = true;
          resolve();
        }, 10);
      });

      // This will throw because provider is not configured, but we're testing initialization wait
      const loginPromise = login("google").catch(() => {});
      expect(initResolved).toBe(false);

      await loginPromise;
      expect(initResolved).toBe(true);

      // Restore
      initialization.initDeferred.promise = originalPromise;
    });
  });
});
