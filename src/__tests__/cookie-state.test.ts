// @vitest-environment node

/**
 * Cookie and State test suite
 * Tests: cookie utilities, OAuth state management
 */

import {describe, it, expect, beforeEach} from "vite-plus/test";
import {getAllCookiesStartWith, setCookie, deleteCookie} from "../auth/cookie/util";
import {validateOAuthState, getOauthState} from "../auth/state";

describe("Cookie Utilities", () => {
  // Note: In jsdom, document.cookie is not fully implemented
  // These tests verify the API works without throwing errors

  describe("getAllCookiesStartWith", () => {
    it("should return empty object when no matching cookies", () => {
      const result = getAllCookiesStartWith("prefix");
      expect(result).toEqual({});
    });

    it("should handle SSR environment", () => {
      const originalDocument = global.document;
      (global as any).document = undefined;

      const result = getAllCookiesStartWith("prefix");
      expect(result).toEqual({});

      (global as any).document = originalDocument;
    });
  });

  describe("setCookie", () => {
    it("should not throw when setting basic cookie", () => {
      expect(() => setCookie("testCookie", "testValue")).not.toThrow();
    });

    it("should not throw with path option", () => {
      expect(() => setCookie("testCookie", "testValue", {path: "/test"})).not.toThrow();
    });

    it("should not throw with expiration in days", () => {
      expect(() => setCookie("testCookie", "testValue", {expires: 7})).not.toThrow();
    });

    it("should not throw with Date expiration", () => {
      const futureDate = new Date(Date.now() + 86400000);
      expect(() => setCookie("testCookie", "testValue", {expires: futureDate})).not.toThrow();
    });

    it("should not throw with domain option", () => {
      expect(() => setCookie("testCookie", "testValue", {domain: "example.com"})).not.toThrow();
    });

    it("should not throw with secure option", () => {
      expect(() => setCookie("testCookie", "testValue", {secure: true})).not.toThrow();
    });

    it("should not throw with sameSite option", () => {
      expect(() => setCookie("testCookie", "testValue", {sameSite: "strict"})).not.toThrow();
    });

    it("should handle all options together", () => {
      expect(() =>
        setCookie("testCookie", "testValue", {
          expires: 7,
          path: "/",
          domain: "example.com",
          secure: true,
          sameSite: "lax",
        })
      ).not.toThrow();
    });

    it("should handle SSR environment", () => {
      const originalDocument = global.document;
      (global as any).document = undefined;

      expect(() => setCookie("test", "value")).not.toThrow();

      (global as any).document = originalDocument;
    });
  });

  describe("deleteCookie", () => {
    it("should not throw when deleting cookie", () => {
      expect(() => deleteCookie("testCookie")).not.toThrow();
    });

    it("should handle SSR environment", () => {
      const originalDocument = global.document;
      (global as any).document = undefined;

      expect(() => deleteCookie("test")).not.toThrow();

      (global as any).document = originalDocument;
    });
  });
});

describe("OAuth State Management", () => {
  beforeEach(() => {
    // Mock sessionStorage for tests
    const store: Record<string, string> = {};
    Object.defineProperty(global, "sessionStorage", {
      value: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        clear: () => {
          Object.keys(store).forEach((key) => delete store[key]);
        },
      },
      writable: true,
    });
  });

  describe("getOauthState", () => {
    it("should generate new state when none exists", () => {
      const state = getOauthState("google");

      expect(state).toBeTruthy();
      expect(state).toContain("google_");
      expect(sessionStorage.getItem("__rixl_auth_state_google")).toBe(state);
    });

    it("should return existing state", () => {
      const firstState = getOauthState("google");
      const secondState = getOauthState("google");

      expect(firstState).toBe(secondState);
    });

    it("should generate different states for different providers", () => {
      const googleState = getOauthState("google");
      const appleState = getOauthState("apple");

      expect(googleState).not.toBe(appleState);
      expect(googleState).toContain("google_");
      expect(appleState).toContain("apple_");
    });

    it("should generate unique states across calls", () => {
      sessionStorage.clear();
      const state1 = getOauthState("provider1");
      sessionStorage.clear();
      const state2 = getOauthState("provider1");

      expect(state1).not.toBe(state2);
    });
  });

  describe("validateOAuthState", () => {
    it("should validate correct state", () => {
      const state = getOauthState("google");
      const isValid = validateOAuthState("google", state);

      expect(isValid).toBe(true);
    });

    it("should reject incorrect state", () => {
      getOauthState("google");
      const isValid = validateOAuthState("google", "wrong-state");

      expect(isValid).toBe(false);
    });

    it("should reject state for different provider", () => {
      const googleState = getOauthState("google");
      const isValid = validateOAuthState("apple", googleState);

      expect(isValid).toBe(false);
    });

    it("should reject when no state exists", () => {
      const isValid = validateOAuthState("google", "any-state");
      expect(isValid).toBe(false);
    });

    it("should reject empty state", () => {
      getOauthState("google");
      const isValid = validateOAuthState("google", "");

      expect(isValid).toBe(false);
    });
  });
});
