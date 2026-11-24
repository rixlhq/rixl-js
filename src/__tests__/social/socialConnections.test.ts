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
  setTokens: vi.fn(),
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

    it("maps GitHub accounts returned by auth-api", async () => {
      mockGetAuthV1Providers.mockResolvedValue({
        data: {providers: [{provider: "EXTERNAL_ACCOUNT_PROVIDER_GITHUB", username: "octocat"}]},
      });

      await expect(listSocials()).resolves.toEqual([{provider: "github", username: "octocat"}]);
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

  it("links a GitHub authorization code with the authenticated Rixl session", async () => {
    mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {access_token: "next", refresh_token: "rotated", expires_in: 3600}});

    await connectSocialInternal("github", {
      authorizationCode: {code: "one-use-code", codeVerifier: "pkce-verifier", redirectUri: "https://app.example.com/github/callback"},
    });

    const request = mockPostAuthV1ProvidersConnect.mock.calls[0][0];
    expect(request.headers).toEqual({Authorization: "Bearer mock-token"});
    expect(request.body).toMatchObject({
      provider: "EXTERNAL_ACCOUNT_PROVIDER_GITHUB",
      token: "one-use-code",
      code_verifier: "pkce-verifier",
      redirect_uri: "https://app.example.com/github/callback",
    });
  });

  describe("connectSocialInternal", () => {
    it("should connect social provider successfully", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("google", {token: "google-oauth-token"});

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE", token: "google-oauth-token", origin: window.location.origin},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should connect different providers", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("apple", {token: "apple-id-token"});

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_APPLE", token: "apple-id-token", origin: window.location.origin},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should map Telegram mini app data to the telegram provider", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("tgWebAppData", {token: "init-data"});

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {provider: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM", token: "init-data", origin: window.location.origin},
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should send an authorization code with its verifier and redirect URI", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("telegram", {
        authorizationCode: {code: "auth-code", codeVerifier: "verifier", redirectUri: "https://app.example.com/login"},
      });

      expect(mockPostAuthV1ProvidersConnect).toHaveBeenCalledWith({
        body: {
          provider: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM",
          token: "auth-code",
          origin: window.location.origin,
          code_verifier: "verifier",
          redirect_uri: "https://app.example.com/login",
        },
        headers: {Authorization: "Bearer mock-token"},
        throwOnError: true,
      });
    });

    it("should reject unknown providers", async () => {
      await expect(connectSocialInternal("myspace", {token: "token-123"})).rejects.toThrow("Unknown provider: myspace");
      expect(mockPostAuthV1ProvidersConnect).not.toHaveBeenCalled();
    });

    it("should handle unauthorized error", async () => {
      mockPostAuthV1ProvidersConnect.mockRejectedValue({error: "unauthorized", code: 401});

      await expect(connectSocialInternal("google", {token: "token"})).rejects.toThrow();
    });

    it("should validate input before sending", async () => {
      mockPostAuthV1ProvidersConnect.mockResolvedValue({data: {}});

      await connectSocialInternal("microsoft", {token: "ms-token-123"});

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

    it("rejects when login fails, so the caller can show the error", async () => {
      mockLogin.mockRejectedValueOnce(new Error("google provider is not configured."));

      await expect(connectSocial("google")).rejects.toThrow("google provider is not configured.");
    });
  });
});
