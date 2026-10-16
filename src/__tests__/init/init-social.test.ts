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
  getProviderCredential: vi.fn(),
  credentialFields: vi.fn((credential: {token: string}) => ({token: credential.token})),
  AuthProvider: {TELEGRAM_OIDC: "telegram"},
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
  let mockGetProviderCredential: any;
  let mockHasSocialConnectAttempt: any;
  let mockClearSocialConnectAttempt: any;
  let mockConnectSocialInternal: any;
  let mockRefreshToken: any;

  let mockRefreshTokens: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const providers = await import("../../auth/providers");
    mockDetectProvider = providers.detectProvider;
    mockGetProviderCredential = providers.getProviderCredential;

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
    mockGetProviderCredential.mockReturnValue({token: "oauth-token"});
    mockHasSocialConnectAttempt.mockReturnValue(true);
    mockRefreshToken.get.mockReturnValue("existing-token");
    mockConnectSocialInternal.mockResolvedValue(undefined);

    await initClient(config);

    expect(mockHasSocialConnectAttempt).toHaveBeenCalledWith("google");
    expect(mockConnectSocialInternal).toHaveBeenCalledWith("google", {token: "oauth-token"});
    expect(mockClearSocialConnectAttempt).toHaveBeenCalledWith("google");
  });

  it("links the credential of a pending link attempt instead of signing in with it", async () => {
    const credential = {authorizationCode: {code: "auth-code", codeVerifier: "verifier", redirectUri: "https://app.example.com"}};
    mockDetectProvider.mockReturnValue("telegram");
    mockGetProviderCredential.mockReturnValue(credential);
    mockHasSocialConnectAttempt.mockReturnValue(true);
    mockRefreshToken.get.mockReturnValue("existing-token");
    mockConnectSocialInternal.mockResolvedValue(undefined);

    await initClient({apiUrl: "https://api.example.com"});

    expect(mockRefreshTokens).not.toHaveBeenCalled();
    expect(mockConnectSocialInternal).toHaveBeenCalledWith("telegram", credential);
  });

  it("should clear social attempt flag even if connection fails", async () => {
    const config: AuthClientConfig = {apiUrl: "https://api.example.com"};

    mockDetectProvider.mockReturnValue("apple");
    mockGetProviderCredential.mockReturnValue({token: "apple-token"});
    mockHasSocialConnectAttempt.mockReturnValue(true);
    mockRefreshToken.get.mockReturnValue("token");
    mockConnectSocialInternal.mockRejectedValue(new Error("Connection failed"));

    await expect(initClient(config)).rejects.toThrow("Connection failed");

    expect(mockClearSocialConnectAttempt).toHaveBeenCalledWith("apple");
  });
});
