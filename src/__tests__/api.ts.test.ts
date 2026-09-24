import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {refreshTokens} from "../auth/api/refresh-tokens";
import {apiURL} from "../auth/api-url";
import {AuthProvider} from "@/providers";

const mockPostAuthV1Token = vi.fn();
const mockPostAuthV1ProvidersConnect = vi.fn();

vi.mock("../generated/sdk.gen", () => ({
  authV1TokenServiceRefreshToken: (...args: unknown[]) => mockPostAuthV1Token(...args),
  authV1ProvidersServiceConnectProvider: (...args: unknown[]) => mockPostAuthV1ProvidersConnect(...args),
}));

describe("API Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPostAuthV1Token.mockReset();
    mockPostAuthV1ProvidersConnect.mockReset();
    apiURL.set("https://api.example.com");
  });

  describe("apiURL", () => {
    it("should store and retrieve API URL", () => {
      apiURL.set("https://test.api.com");
      expect(apiURL.get()).toBe("https://test.api.com");
    });

    it("should allow updating API URL", () => {
      apiURL.set("https://api1.com");
      expect(apiURL.get()).toBe("https://api1.com");

      apiURL.set("https://api2.com");
      expect(apiURL.get()).toBe("https://api2.com");
    });
  });

  describe("refreshTokens", () => {
    it("should refresh tokens successfully", async () => {
      const mockResponse = {
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3600,
      };

      mockPostAuthV1Token.mockResolvedValue({data: mockResponse});

      const result = await refreshTokens(AuthProvider.BEARER, "old-refresh-token");

      expect(mockPostAuthV1Token).toHaveBeenCalledWith({
        body: {token_type: "Bearer", refresh_token: "old-refresh-token"},
        throwOnError: true,
      });
      expect(result).toEqual(mockResponse);
    });

    it("should handle 401 unauthorized error", async () => {
      mockPostAuthV1Token.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(refreshTokens(AuthProvider.BEARER, "invalid-token")).rejects.toThrow();
    });

    it("should propagate errors (no side effects in this function)", async () => {
      mockPostAuthV1Token.mockRejectedValue({error: "bad_request", code: 400});

      await expect(refreshTokens(AuthProvider.BEARER, "expired-token")).rejects.toThrow();
    });

    it("should connect Google via /auth/v1/providers/connect", async () => {
      const mockResponse = {
        access_token: "token",
        refresh_token: "refresh",
        expires_in: 7200,
      };

      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: mockResponse});

      await refreshTokens(AuthProvider.GOOGLE, "google-token");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE", token: "google-token"},
        throwOnError: true,
      });
    });

    it("should connect Telegram via /auth/v1/providers/connect", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({
        data: {access_token: "token", refresh_token: "refresh", expires_in: 3600},
      });

      await refreshTokens(AuthProvider.TELEGRAM_WEB, "tg-token");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM", token: "tg-token"},
        throwOnError: true,
      });
    });

    it("should include countryCode and origin for Bearer refresh", async () => {
      mockPostAuthV1Token.mockResolvedValue({
        data: {access_token: "token", refresh_token: "refresh", expires_in: 3600},
      });

      await refreshTokens(AuthProvider.BEARER, "token", {countryCode: "NG", origin: "https://app.example.com"});

      expect(mockPostAuthV1Token).toHaveBeenCalledWith({
        body: {
          token_type: "Bearer",
          refresh_token: "token",
          country_code: "NG",
          origin: "https://app.example.com",
        },
        throwOnError: true,
      });
    });

    it("should include countryCode and origin for provider connect", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({
        data: {access_token: "token", refresh_token: "refresh", expires_in: 3600},
      });

      await refreshTokens(AuthProvider.GOOGLE, "google-token", {countryCode: "NG", origin: "https://app.example.com"});

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE",
          token: "google-token",
          country_code: "NG",
          origin: "https://app.example.com",
        },
        throwOnError: true,
      });
    });

    it("should handle network errors", async () => {
      mockPostAuthV1Token.mockRejectedValue(new Error("Network error"));

      await expect(refreshTokens(AuthProvider.BEARER, "token")).rejects.toThrow("Network error");
    });

    it("should return parsed JSON response", async () => {
      const mockResponse = {
        access_token: "access123",
        refresh_token: "refresh456",
        expires_in: 1800,
      };

      mockPostAuthV1Token.mockResolvedValue({data: mockResponse});

      const result = await refreshTokens(AuthProvider.BEARER, "token");

      expect(result).toEqual(mockResponse);
    });
  });
});
