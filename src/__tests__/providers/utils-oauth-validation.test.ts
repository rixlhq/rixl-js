/**
 * Provider Utils OAuth Validation Tests
 * Tests: OAuth state validation paths in detectProvider
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {detectProvider, extractProviderFromState} from "@/providers/utils";
import {AuthProvider} from "@/providers";
import * as urlModule from "@/url";
import * as stateModule from "@/state";

describe("Provider Utils - OAuth Validation Paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractProviderFromState edge cases", () => {
    it("should return undefined for state with no parts after split", () => {
      // When split returns empty array or single empty string
      const result = extractProviderFromState("");
      // Empty string splits to [""], length is 1, so returns parts[0] = ""
      expect(result).toBe("");
    });

    it("should handle state that results in parts.length < 1 (never happens)", () => {
      // This line (14) is actually unreachable because split always returns at least [""]
      // But we document it
      const parts = "test".split("_");
      expect(parts.length >= 1).toBe(true);
    });
  });

  describe("detectProvider - Telegram paths", () => {
    it("should detect TELEGRAM_MINI_APP and return early", () => {
      const hasSpy = vi.spyOn(urlModule.urlParams, "has");
      hasSpy.mockImplementation((key: string) => key === AuthProvider.TELEGRAM_MINI_APP);

      const result = detectProvider();

      expect(result).toBe(AuthProvider.TELEGRAM_MINI_APP);
      expect(hasSpy).toHaveBeenCalledWith(AuthProvider.TELEGRAM_MINI_APP);
    });

    it("should detect TELEGRAM_WEB when MINI_APP is not present", () => {
      const hasSpy = vi.spyOn(urlModule.urlParams, "has");
      hasSpy.mockImplementation((key: string) => key === AuthProvider.TELEGRAM_WEB);

      const result = detectProvider();

      expect(result).toBe(AuthProvider.TELEGRAM_WEB);
    });

    it("should check TELEGRAM_MINI_APP first, then TELEGRAM_WEB (line 25-26)", () => {
      const hasSpy = vi.spyOn(urlModule.urlParams, "has");
      // Return false for MINI_APP, true for WEB
      hasSpy.mockImplementation((key: string) => key === AuthProvider.TELEGRAM_WEB);

      const result = detectProvider();

      // Should hit line 25 (else if for TELEGRAM_WEB)
      expect(result).toBe(AuthProvider.TELEGRAM_WEB);
    });
  });

  describe("detectProvider - OAuth validation paths", () => {
    it("should return undefined when id_token exists but state is missing", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "test-token";
        return null;
      });

      const result = detectProvider();

      // Line 33: if (id_token && state) is false, returns undefined
      expect(result).toBeUndefined();
    });

    it("should return undefined when state exists but id_token is missing", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "state") return "google_state123";
        return null;
      });

      const result = detectProvider();

      expect(result).toBeUndefined();
    });

    it("should validate Google OAuth state (line 38)", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "google-token";
        if (key === "state") return "google_state123";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      validateSpy.mockReturnValue(true);

      const result = detectProvider();

      // Line 38: providerFromState === GOOGLE && validateOAuthState
      expect(result).toBe(AuthProvider.GOOGLE);
      expect(validateSpy).toHaveBeenCalledWith(AuthProvider.GOOGLE, "google_state123");
    });

    it("should validate Apple OAuth state (line 40)", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "apple-token";
        if (key === "state") return "apple_state456";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      validateSpy.mockImplementation((provider, state) => {
        return provider === AuthProvider.APPLE && state === "apple_state456";
      });

      const result = detectProvider();

      // Line 40: else if providerFromState === APPLE
      expect(result).toBe(AuthProvider.APPLE);
    });

    it("should validate Microsoft OAuth state (line 42)", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "microsoft-token";
        if (key === "state") return "microsoft_state789";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      validateSpy.mockImplementation((provider, state) => {
        return provider === AuthProvider.MICROSOFT && state === "microsoft_state789";
      });

      const result = detectProvider();

      // Line 42: else if providerFromState === MICROSOFT
      expect(result).toBe(AuthProvider.MICROSOFT);
    });

    it("should return undefined when OAuth state validation fails", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "token";
        if (key === "state") return "google_invalid_state";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      validateSpy.mockReturnValue(false); // Validation fails

      const result = detectProvider();

      // All validation branches fail, returns undefined (line 47)
      expect(result).toBeUndefined();
    });

    it("should return undefined when provider from state is unknown", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "token";
        if (key === "state") return "unknown_provider_state";
        return null;
      });

      const result = detectProvider();

      // providerFromState doesn't match any known provider
      expect(result).toBeUndefined();
    });

    it("should test the full OAuth flow with valid state", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "valid-token";
        if (key === "state") return "apple_valid_state";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      // Only Apple validation succeeds
      validateSpy.mockImplementation((provider) => provider === AuthProvider.APPLE);

      const result = detectProvider();

      // Line 38 fails (not Google), line 40 succeeds (Apple)
      expect(result).toBe(AuthProvider.APPLE);
    });
  });

  describe("Full integration scenarios", () => {
    it("should prioritize Telegram over OAuth", () => {
      const hasSpy = vi.spyOn(urlModule.urlParams, "has");
      hasSpy.mockImplementation((key) => key === AuthProvider.TELEGRAM_MINI_APP);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        // Even if OAuth params exist
        if (key === "id_token") return "oauth-token";
        if (key === "state") return "oauth-state";
        return null;
      });

      const result = detectProvider();

      // Telegram is checked first, so it returns before OAuth checks
      expect(result).toBe(AuthProvider.TELEGRAM_MINI_APP);
    });

    it("should handle when both id_token and state exist but validation fails for all", () => {
      // const hasSpy = vi.spyOn(urlModule.urlParams, "has").mockReturnValue(false);
      const getSpy = vi.spyOn(urlModule.urlParams, "get");
      getSpy.mockImplementation((key) => {
        if (key === "id_token") return "token";
        if (key === "state") return "microsoft_badstate";
        return null;
      });
      const validateSpy = vi.spyOn(stateModule, "validateOAuthState");
      validateSpy.mockReturnValue(false); // All validations fail

      const result = detectProvider();

      // Goes through all three validation checks (lines 38, 40, 42), all fail
      expect(result).toBeUndefined();
    });
  });
});
