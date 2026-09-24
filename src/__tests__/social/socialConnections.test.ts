import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {listSocials, connectSocialInternal, disconnectSocial, connectSocial, type ConnectedProvider} from "@/social/socialConnections.ts";
import * as initialization from "../../auth/initialization";

const mockGetAuthV1Providers = vi.fn();
const mockPostAuthV1ProvidersConnect = vi.fn();
const mockDeleteAuthV1ProvidersByProvider = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1ProvidersServiceListProviders: (...args: unknown[]) => mockGetAuthV1Providers(...args),
  authV1ProvidersServiceConnectProvider: (...args: unknown[]) => mockPostAuthV1ProvidersConnect(...args),
  authV1ProvidersServiceDisconnectProvider: (...args: unknown[]) => mockDeleteAuthV1ProvidersByProvider(...args),
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn().mockResolvedValue("mock-token"),
  login: vi.fn(),
}));

vi.mock("../../auth/social/socialState", () => ({
  setSocialConnectAttempt: vi.fn(),
}));

describe("Social Connections Module", () => {
  let mockLogin: any;
  let mockSetSocialConnectAttempt: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockGetAuthV1Providers.mockReset();
    mockPostAuthV1ProvidersConnect.mockReset();
    mockDeleteAuthV1ProvidersByProvider.mockReset();

    const authStore = await import("../../auth/authStore");
    mockLogin = authStore.login;

    const socialState = await import("../../auth/social/socialState");
    mockSetSocialConnectAttempt = socialState.setSocialConnectAttempt;
  });

  describe("listSocials", () => {
    it("should list connected providers successfully", async () => {
      // The gateway serves proto enum values for provider
      const wireProviders = [
        {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE",
          username: "user@gmail.com",
          first_name: "John",
          last_name: "Doe",
          email_address: "user@gmail.com",
          image_url: "https://example.com/image.jpg",
        },
        {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_APPLE",
          email_address: "user@icloud.com",
        },
      ];

      mockGetAuthV1Providers.mockResolvedValue({data: {providers: wireProviders}});

      const result = await listSocials();

      expect(mockGetAuthV1Providers).toHaveBeenCalledWith({
        throwOnError: true,
      });
      const expected: ConnectedProvider[] = [
        {
          provider: "google",
          username: "user@gmail.com",
          first_name: "John",
          last_name: "Doe",
          email_address: "user@gmail.com",
          image_url: "https://example.com/image.jpg",
        },
        {
          provider: "apple",
          email_address: "user@icloud.com",
        },
      ];
      expect(result).toEqual(expected);
    });

    it("should return empty array when no providers connected", async () => {
      mockGetAuthV1Providers.mockResolvedValue({data: {providers: []}});

      const result = await listSocials();

      expect(result).toEqual([]);
    });

    it("should handle unauthorized error", async () => {
      mockGetAuthV1Providers.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(listSocials()).rejects.toThrow();
    });

    it("should handle single provider", async () => {
      const wireProviders = [
        {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_MICROSOFT",
          username: "user@outlook.com",
          email_address: "user@outlook.com",
        },
      ];

      mockGetAuthV1Providers.mockResolvedValue({data: {providers: wireProviders}});

      const result = await listSocials();

      expect(result).toHaveLength(1);
      expect(result[0]?.provider).toBe("microsoft");
    });

    it("should handle providers with optional fields", async () => {
      const wireProviders = [
        {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM",
          username: "telegram_user",
        },
        {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_FACEBOOK",
          first_name: "Jane",
          last_name: "Smith",
        },
      ];

      mockGetAuthV1Providers.mockResolvedValue({data: {providers: wireProviders}});

      const result = await listSocials();

      expect(result).toHaveLength(2);
      expect(result[0]?.provider).toBe("telegram");
      expect(result[1]?.provider).toBe("facebook");
    });

    it("should drop providers with unknown enum values", async () => {
      const wireProviders = [
        {provider: "EXTERNAL_ACCOUNT_PROVIDER_UNSPECIFIED"},
        {provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE", username: "user@gmail.com"},
      ];

      mockGetAuthV1Providers.mockResolvedValue({data: {providers: wireProviders}});

      const result = await listSocials();

      expect(result).toHaveLength(1);
      expect(result[0]?.provider).toBe("google");
    });
  });

  describe("connectSocialInternal", () => {
    it("should connect social provider successfully", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("google", "google-oauth-token");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE", token: "google-oauth-token"},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should connect different providers", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("apple", "apple-id-token");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_APPLE", token: "apple-id-token"},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should map Telegram auth tokens to the telegram provider", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("tgAuthResult", "tg-token");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM", token: "tg-token"},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should reject unknown providers", async () => {
      await expect(connectSocialInternal("myspace", "token-123")).rejects.toThrow("Unknown provider: myspace");
      expect(mockPostAuthV1ProvidersConnect).not.toHaveBeenCalled();
    });

    it("should handle unauthorized error", async () => {
      mockPostAuthV1ProvidersConnect.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(connectSocialInternal("google", "token")).rejects.toThrow();
    });

    it("should validate input before sending", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("microsoft", "ms-token-123");

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: expect.objectContaining({
          provider: "EXTERNAL_ACCOUNT_PROVIDER_MICROSOFT",
          token: "ms-token-123",
        }),
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });
  });

  describe("disconnectSocial", () => {
    it("should disconnect social provider successfully", async () => {
      mockDeleteAuthV1ProvidersByProvider.mockResolvedValue({data: {}});

      await disconnectSocial("google");

      expect(mockDeleteAuthV1ProvidersByProvider).toHaveBeenCalledWith({
        path: {provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE"},
        throwOnError: true,
      });
    });

    it("should handle unauthorized error", async () => {
      mockDeleteAuthV1ProvidersByProvider.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(disconnectSocial("google")).rejects.toThrow();
    });

    it("should handle provider not found error", async () => {
      mockDeleteAuthV1ProvidersByProvider.mockRejectedValue({error: "not_found", code: 404});

      await expect(disconnectSocial("apple")).rejects.toThrow();
    });

    it("should handle cannot disconnect last provider error", async () => {
      mockDeleteAuthV1ProvidersByProvider.mockRejectedValue({error: "bad_request", code: 400});

      await expect(disconnectSocial("telegram")).rejects.toThrow();
    });

    it("should work with different providers", async () => {
      mockDeleteAuthV1ProvidersByProvider.mockResolvedValue({data: {}});

      await disconnectSocial("microsoft");

      expect(mockDeleteAuthV1ProvidersByProvider).toHaveBeenCalledWith({
        path: {provider: "EXTERNAL_ACCOUNT_PROVIDER_MICROSOFT"},
        throwOnError: true,
      });
    });
  });

  describe("connectSocial", () => {
    it("should initiate google connection", () => {
      connectSocial("google");

      expect(mockSetSocialConnectAttempt).toHaveBeenCalledWith("google");
      expect(mockLogin).toHaveBeenCalledWith("google");
    });

    it("should initiate apple connection", () => {
      connectSocial("apple");

      expect(mockSetSocialConnectAttempt).toHaveBeenCalledWith("apple");
      expect(mockLogin).toHaveBeenCalledWith("apple");
    });

    it("should initiate microsoft connection", () => {
      connectSocial("microsoft");

      expect(mockSetSocialConnectAttempt).toHaveBeenCalledWith("microsoft");
      expect(mockLogin).toHaveBeenCalledWith("microsoft");
    });

    it("should initiate facebook connection", () => {
      connectSocial("facebook");

      expect(mockSetSocialConnectAttempt).toHaveBeenCalledWith("facebook");
      expect(mockLogin).toHaveBeenCalledWith("facebook");
    });

    it("should initiate telegram connection", () => {
      connectSocial("telegram");

      expect(mockSetSocialConnectAttempt).toHaveBeenCalledWith("telegram");
      expect(mockLogin).toHaveBeenCalledWith("telegram");
    });

    it("should set connection attempt before login", () => {
      const callOrder: string[] = [];

      mockSetSocialConnectAttempt.mockImplementation(() => {
        callOrder.push("setSocialConnectAttempt");
      });

      mockLogin.mockImplementation(() => {
        callOrder.push("login");
      });

      connectSocial("google");

      expect(callOrder).toEqual(["setSocialConnectAttempt", "login"]);
    });
  });
});
