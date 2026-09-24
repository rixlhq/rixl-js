/**
 * Social state management tests
 * Tests: setSocialConnectAttempt, hasSocialConnectAttempt, clearSocialConnectAttempt
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach} from "vite-plus/test";
import {setSocialConnectAttempt, hasSocialConnectAttempt, clearSocialConnectAttempt} from "@/social/socialState.ts";

describe("Social State Management", () => {
  beforeEach(() => {
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
  });

  describe("setSocialConnectAttempt", () => {
    it("should set connection attempt flag for a provider", () => {
      setSocialConnectAttempt("google");

      expect(sessionStorage.getItem("__rixl_auth_social_connect_google")).toBe("true");
    });

    it("should set flags for different providers independently", () => {
      setSocialConnectAttempt("google");
      setSocialConnectAttempt("apple");

      expect(sessionStorage.getItem("__rixl_auth_social_connect_google")).toBe("true");
      expect(sessionStorage.getItem("__rixl_auth_social_connect_apple")).toBe("true");
    });

    it("should overwrite existing flag", () => {
      setSocialConnectAttempt("google");
      setSocialConnectAttempt("google");

      expect(sessionStorage.getItem("__rixl_auth_social_connect_google")).toBe("true");
    });
  });

  describe("hasSocialConnectAttempt", () => {
    it("should return true when flag is set", () => {
      setSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(true);
    });

    it("should return false when flag is not set", () => {
      expect(hasSocialConnectAttempt("google")).toBe(false);
    });

    it("should return false after clearing", () => {
      setSocialConnectAttempt("google");
      clearSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(false);
    });

    it("should check providers independently", () => {
      setSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(true);
      expect(hasSocialConnectAttempt("apple")).toBe(false);
    });
  });

  describe("clearSocialConnectAttempt", () => {
    it("should clear connection attempt flag", () => {
      setSocialConnectAttempt("google");
      clearSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(false);
    });

    it("should not affect other providers", () => {
      setSocialConnectAttempt("google");
      setSocialConnectAttempt("apple");
      clearSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(false);
      expect(hasSocialConnectAttempt("apple")).toBe(true);
    });

    it("should be idempotent", () => {
      setSocialConnectAttempt("google");
      clearSocialConnectAttempt("google");
      clearSocialConnectAttempt("google");

      expect(hasSocialConnectAttempt("google")).toBe(false);
    });

    it("should handle clearing non-existent flag", () => {
      expect(() => clearSocialConnectAttempt("google")).not.toThrow();
      expect(hasSocialConnectAttempt("google")).toBe(false);
    });
  });
});
