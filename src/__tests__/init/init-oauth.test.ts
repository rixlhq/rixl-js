import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {initClient, type AuthClientConfig} from "../../auth/init";
import {ApiError} from "../../auth/api/types";

// Mock implementation
vi.mock("../../auth/api-url", () => ({
  apiURL: {set: vi.fn(), get: vi.fn()},
}));
vi.mock("../../auth/api/refresh-tokens", () => ({
  refreshTokens: vi.fn(),
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn().mockResolvedValue("mock-access-token"),
  refreshToken: {get: vi.fn()},
  expireAt: {set: vi.fn()},
  accessToken: {set: vi.fn()},
  authError: {set: vi.fn()},
  setTokens: vi.fn(),
  setLimitedAccessState: vi.fn(),
  clearLimitedAccessState: vi.fn(),
}));

vi.mock("../../auth/initialization", () => ({
  initDeferred: {promise: Promise.resolve(), resolve: vi.fn()},
}));

vi.mock("../../auth/providers", () => ({
  detectProvider: vi.fn(),
  completeOAuthCallback: vi.fn(),
  logProviderExchangeFailure: vi.fn(),
  hasProviderResponse: vi.fn(() => false),
  logUnusableProviderResponse: vi.fn(),
  getProviderToken: vi.fn(),
  googleConfig: {set: vi.fn()},
  appleConfig: {set: vi.fn()},
  microsoftConfig: {set: vi.fn()},
  telegramConfig: {set: vi.fn()},
  getRedirectUrl: vi.fn(),
  updateGoogleAuthUrl: vi.fn(),
  updateAppleAuthUrl: vi.fn(),
  updateMicrosoftAuthUrl: vi.fn(),
  updateTelegramAuthUrl: vi.fn(),
  AuthProvider: {BEARER: "bearer"},
}));

vi.mock("../../auth/api/client-core", () => ({
  setTokenRefreshFunction: vi.fn(),
}));

vi.mock("../../auth/api/sdk-client", () => ({
  configureSdkClient: vi.fn(),
}));

describe("initClient - OAuth Callback Handling", () => {
  let mockDetectProvider: any;
  let mockGetProviderToken: any;
  let mockRefreshTokens: any;
  let mockRefreshToken: any;
  let mockCompleteOAuthCallback: any;
  let mockAuthError: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const providers = await import("../../auth/providers");
    mockDetectProvider = providers.detectProvider;
    mockGetProviderToken = providers.getProviderToken;
    mockCompleteOAuthCallback = providers.completeOAuthCallback;

    const api = await import("../../auth/api/refresh-tokens");
    mockRefreshTokens = api.refreshTokens;

    const authStore = await import("../../auth/authStore");
    mockRefreshToken = authStore.refreshToken;
    mockAuthError = authStore.authError;
  });

  it("should handle OAuth callback with token", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue(null);
    mockRefreshTokens.mockResolvedValue({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    });

    await initClient(config);

    expect(mockDetectProvider).toHaveBeenCalled();
    expect(mockGetProviderToken).toHaveBeenCalledWith("google");
    expect(mockRefreshTokens).toHaveBeenCalledWith("google", "oauth-token");
  });

  it("should exchange OAuth token even if refresh token exists", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue("existing-refresh-token");
    mockRefreshTokens.mockRejectedValue(
      new ApiError("error", {status: 400, endpoint: "/auth/v1/token/refresh", data: {error: "invalid_grant"}})
    );

    await initClient(config);

    expect(mockRefreshTokens).toHaveBeenCalledWith("google", "oauth-token");
    expect(mockAuthError.set).toHaveBeenCalledWith(expect.objectContaining({error_code: "email_not_verified"}));
  });

  it("should record a gateway rejection as an auth error the login page can show", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue(null);
    mockRefreshTokens.mockRejectedValue(
      new ApiError("unauthorized", {status: 401, endpoint: "/auth/v1/token", data: {error: "unauthorized"}})
    );

    await initClient(config);

    expect(mockAuthError.set).toHaveBeenCalledWith({
      error_code: "provider_exchange_failed",
      message: "unauthorized",
      email: "",
    });
  });

  it("should propagate a transport failure, which carries no message to show", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue(null);
    mockRefreshTokens.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(initClient(config)).rejects.toThrow("Failed to fetch");
  });

  it("should retire the provider response after a successful exchange", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue(null);
    mockRefreshTokens.mockResolvedValue({access_token: "a", refresh_token: "r", expires_in: 3600});

    await initClient(config);

    expect(mockCompleteOAuthCallback).toHaveBeenCalled();
  });

  it("should retire the provider response even when the exchange fails", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockRefreshToken.get.mockReturnValue(null);
    mockRefreshTokens.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(initClient(config)).rejects.toThrow();

    expect(mockCompleteOAuthCallback).toHaveBeenCalled();
  });
});
