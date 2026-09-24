/**
 * Provider Utils Tests
 * Tests: extractProviderFromState, detectProvider, getProviderToken
 */

import {describe, it, expect} from "vite-plus/test";
import {extractProviderFromState, detectProvider, getProviderToken} from "../auth/providers/utils";
import {AuthProvider} from "@/providers";

// Note: We test extractProviderFromState in isolation as it's a pure function
// For detectProvider and getProviderToken, we document they are tested via integration
// since they depend on urlParams which is hard to mock properly

describe("Provider Utils", () => {
  describe("extractProviderFromState", () => {
    it("should extract provider from state with underscore", () => {
      expect(extractProviderFromState("google_abc123")).toBe("google");
      expect(extractProviderFromState("apple_xyz789")).toBe("apple");
      expect(extractProviderFromState("microsoft_def456")).toBe("microsoft");
    });

    it("should return provider when no underscore present", () => {
      expect(extractProviderFromState("google")).toBe("google");
      expect(extractProviderFromState("apple")).toBe("apple");
    });

    it("should handle state with multiple underscores", () => {
      expect(extractProviderFromState("google_abc_def_123")).toBe("google");
    });

    it("should return empty string for empty input", () => {
      expect(extractProviderFromState("")).toBe("");
    });

    it("should handle single character provider", () => {
      expect(extractProviderFromState("g_token")).toBe("g");
    });

    it("should handle state with trailing underscore", () => {
      expect(extractProviderFromState("google_")).toBe("google");
    });

    it("should handle state with leading underscore", () => {
      expect(extractProviderFromState("_google_token")).toBe("");
    });
  });

  describe("detectProvider", () => {
    it("should be a function", () => {
      expect(typeof detectProvider).toBe("function");
    });

    it("should return undefined when no provider params in URL", () => {
      // Without URL params set, should return undefined
      const result = detectProvider();
      expect(result).toBeUndefined();
    });
  });

  describe("getProviderToken", () => {
    it("should be a function", () => {
      expect(typeof getProviderToken).toBe("function");
    });

    it("should return undefined for BEARER provider", () => {
      expect(getProviderToken(AuthProvider.BEARER)).toBe(undefined);
    });

    it("should return undefined for GOOGLE provider when no URL params", () => {
      const result = getProviderToken(AuthProvider.GOOGLE);
      expect(result).toBeUndefined();
    });

    it("should return undefined for APPLE provider when no URL params", () => {
      const result = getProviderToken(AuthProvider.APPLE);
      expect(result).toBeUndefined();
    });

    it("should return undefined for MICROSOFT provider when no URL params", () => {
      const result = getProviderToken(AuthProvider.MICROSOFT);
      expect(result).toBeUndefined();
    });

    it("should return undefined for TELEGRAM_MINI_APP provider when no URL params", () => {
      const result = getProviderToken(AuthProvider.TELEGRAM_MINI_APP);
      expect(result).toBeUndefined();
    });

    it("should return undefined for TELEGRAM_WEB provider when no URL params", () => {
      const result = getProviderToken(AuthProvider.TELEGRAM_WEB);
      expect(result).toBeUndefined();
    });

    it("should handle unknown providers gracefully", () => {
      const result = getProviderToken("unknown_provider" as AuthProvider);
      expect(result).toBeUndefined();
    });
  });
});
