import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {initClient, type AuthClientConfig} from "../../auth/init";

// Mock implementation
vi.mock("../../auth/api", () => ({
  apiURL: {set: vi.fn(), get: vi.fn()},
}));

vi.mock("../../auth/api/refresh-tokens", () => ({
  refreshTokens: vi.fn(),
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn().mockResolvedValue("mock-access-token"),
  refreshToken: {get: vi.fn()},
  accessToken: {set: vi.fn()},
  expireAt: {set: vi.fn()},
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
}));

vi.mock("../../auth/social/socialState", () => ({
  hasSocialConnectAttempt: vi.fn().mockReturnValue(false),
  clearSocialConnectAttempt: vi.fn(),
}));

vi.mock("../../auth/social/socialConnections", () => ({
  connectSocialInternal: vi.fn(),
}));

vi.mock("../../auth/api/client-core", () => ({
  setTokenRefreshFunction: vi.fn(),
}));

vi.mock("../../auth/api/sdk-client", () => ({
  configureSdkClient: vi.fn(),
}));

describe("initClient - Social Connection Flow", () => {
  let mockDetectProvider: any;
  let mockGetProviderToken: any;
  let mockHasSocialConnectAttempt: any;
  let mockClearSocialConnectAttempt: any;
  let mockConnectSocialInternal: any;
  let mockRefreshToken: any;

  let mockRefreshTokens: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const providers = await import("../../auth/providers");
    mockDetectProvider = providers.detectProvider;
    mockGetProviderToken = providers.getProviderToken;

    const socialState = await import("../../auth/social/socialState");
    mockHasSocialConnectAttempt = socialState.hasSocialConnectAttempt;
    mockClearSocialConnectAttempt = socialState.clearSocialConnectAttempt;

    const socialConnections = await import("../../auth/social/socialConnections");
    mockConnectSocialInternal = socialConnections.connectSocialInternal;

    const authStore = await import("../../auth/authStore");
    mockRefreshToken = authStore.refreshToken;

    const refreshTokensModule = await import("../../auth/api/refresh-tokens");
    mockRefreshTokens = refreshTokensModule.refreshTokens;
    mockRefreshTokens.mockResolvedValue({
      access_token: "mock-access-token",
      refresh_token: "mock-refresh-token",
      expires_in: 3600,
    });
  });

  it("should handle social connection attempt", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("google");
    mockGetProviderToken.mockReturnValue("oauth-token");
    mockHasSocialConnectAttempt.mockReturnValue(true);
    mockRefreshToken.get.mockReturnValue("existing-token");
    mockConnectSocialInternal.mockResolvedValue(undefined);

    await initClient(config);

    expect(mockHasSocialConnectAttempt).toHaveBeenCalledWith("google");
    expect(mockConnectSocialInternal).toHaveBeenCalledWith("google", "oauth-token");
    expect(mockClearSocialConnectAttempt).toHaveBeenCalledWith("google");
  });

  it("should clear social attempt flag even if connection fails", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("apple");
    mockGetProviderToken.mockReturnValue("apple-token");
    mockHasSocialConnectAttempt.mockReturnValue(true);
    mockRefreshToken.get.mockReturnValue("token");
    mockConnectSocialInternal.mockRejectedValue(new Error("Connection failed"));

    await expect(initClient(config)).rejects.toThrow("Connection failed");

    expect(mockClearSocialConnectAttempt).toHaveBeenCalledWith("apple");
  });
});
