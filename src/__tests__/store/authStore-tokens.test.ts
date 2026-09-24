/**
 * AuthStore token management tests
 * Tests: setTokens, removeTokens, token state
 */

import {describe, it, expect, beforeEach, vi, afterEach} from "vite-plus/test";
import {createMockJWT} from "../utils/test-helpers";
import {createApiMock, createProvidersMock, createCookieMock} from "../setup/authstore-mock-factory";

// Setup mocks BEFORE importing the modules that depend on them
vi.mock("../../auth/api", () => createApiMock());
vi.mock("../../auth/providers", () => createProvidersMock());
vi.mock("../../auth/cookie", () => createCookieMock());

// Import mocked modules and authStore AFTER mocks are set up
import * as initialization from "../../auth/initialization";
import {
  isLogged,
  accessToken,
  refreshToken,
  expireAt,
  setTokens,
  removeTokens,
  resetTokenPromise,
  authError,
  clearAuthError,
} from "@/authStore.ts";
import {user} from "@/userStore.ts";

describe("AuthStore - Token Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    removeTokens();
    user.set(undefined);
    initialization.initDeferred.promise = Promise.resolve();
    resetTokenPromise();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setTokens", () => {
    it("should set all token values correctly", () => {
      const mockToken = createMockJWT();
      const mockRefresh = "refresh-token-123";
      const expiresIn = 3600;

      setTokens(mockToken, mockRefresh, expiresIn);

      expect(accessToken.get()).toBe(mockToken);
      expect(refreshToken.get()).toBe(mockRefresh);
      expect(isLogged.get()).toBe(true);
      expect(expireAt.get()).toBeGreaterThan(Date.now());
      expect(user.get()).toBeDefined();
    });

    it("should decode and set user from access token", () => {
      const mockToken = createMockJWT({username: "tokenuser", id: "token123"});
      setTokens(mockToken, "refresh", 3600);

      const userData = user.get();
      expect(userData?.username).toBe("tokenuser");
      expect(userData?.id).toBe("token123");
    });

    it("should calculate correct expiration time", () => {
      const expiresIn = 7200; // 2 hours
      const beforeTime = Date.now();

      setTokens(createMockJWT(), "refresh", expiresIn);

      const afterTime = Date.now();
      const expiration = expireAt.get();

      expect(expiration).toBeGreaterThanOrEqual(beforeTime + expiresIn * 1000);
      expect(expiration).toBeLessThanOrEqual(afterTime + expiresIn * 1000);
    });

    it("should handle very large expiration times", () => {
      const veryLargeExpiry = 999999999;
      setTokens(createMockJWT(), "refresh", veryLargeExpiry);

      expect(expireAt.get()).toBeGreaterThan(Date.now());
    });

    it("should handle zero expiration time", () => {
      setTokens(createMockJWT(), "refresh", 0);
      expect(expireAt.get()).toBeLessThanOrEqual(Date.now());
    });

    it("should handle invalid JWT in setTokens gracefully", () => {
      // Should not throw even with invalid token
      expect(() => setTokens("invalid.token", "refresh", 3600)).not.toThrow();
      expect(isLogged.get()).toBe(true);
    });
  });

  describe("removeTokens", () => {
    it("should clear all auth state", () => {
      // Set tokens first
      setTokens(createMockJWT(), "refresh", 3600);
      expect(isLogged.get()).toBe(true);

      // Remove tokens
      removeTokens();

      expect(accessToken.get()).toBe("");
      expect(refreshToken.get()).toBe("");
      expect(expireAt.get()).toBe(0);
      expect(isLogged.get()).toBe(false);
      expect(user.get()).toBeUndefined();
    });

    it("should work when called multiple times", () => {
      setTokens(createMockJWT(), "refresh", 3600);

      removeTokens();
      removeTokens();

      expect(isLogged.get()).toBe(false);
      expect(user.get()).toBeUndefined();
    });

    it("should clear user data", () => {
      setTokens(createMockJWT({username: "testuser"}), "refresh", 3600);
      expect(user.get()?.username).toBe("testuser");

      removeTokens();
      expect(user.get()).toBeUndefined();
    });
  });

  describe("authError", () => {
    beforeEach(() => {
      clearAuthError();
    });

    it("should be null initially", () => {
      expect(authError.get()).toBeNull();
    });

    it("should store error when set", () => {
      const error = {
        error_code: "email_not_verified" as const,
        message: "Email not verified",
        email: "test@example.com",
      };

      authError.set(error);

      expect(authError.get()).toEqual(error);
    });

    it("should store provider conflict error", () => {
      const error = {
        error_code: "provider_conflict" as const,
        message: "This email is already registered with Google",
        email: "test@example.com",
      };

      authError.set(error);

      expect(authError.get()).toEqual(error);
    });
  });

  describe("clearAuthError", () => {
    it("should clear auth error", () => {
      authError.set({
        error_code: "email_not_verified",
        message: "Email not verified",
        email: "test@example.com",
      });

      expect(authError.get()).not.toBeNull();

      clearAuthError();

      expect(authError.get()).toBeNull();
    });

    it("should work when called multiple times", () => {
      clearAuthError();
      clearAuthError();

      expect(authError.get()).toBeNull();
    });
  });
});
