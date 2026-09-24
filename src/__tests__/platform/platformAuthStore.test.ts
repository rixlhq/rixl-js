/**
 * Platform Auth Store Tests
 * Verifies API-key exchange, refresh-on-expiry, and failure clearing —
 * kept isolated from the end-user session atoms in authStore.ts.
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {
  exchangeApiKey,
  getPlatformToken,
  platformAccessToken,
  platformRefreshToken,
  platformExpireAt,
} from "../../platform/platformAuthStore";
import {
  platformauthV1PlatformAuthServiceExchangeApiKey,
  platformauthV1PlatformAuthServiceRefreshPlatformToken,
} from "../../generated/sdk.gen";

vi.mock("../../generated/sdk.gen", () => ({
  platformauthV1PlatformAuthServiceExchangeApiKey: vi.fn(),
  platformauthV1PlatformAuthServiceRefreshPlatformToken: vi.fn(),
}));

const mockExchange = vi.mocked(platformauthV1PlatformAuthServiceExchangeApiKey);
const mockRefresh = vi.mocked(platformauthV1PlatformAuthServiceRefreshPlatformToken);

describe("platformAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformAccessToken.set(undefined);
    platformRefreshToken.set(undefined);
    platformExpireAt.set(0);
  });

  it("stores tokens returned by ExchangeAPIKey", async () => {
    mockExchange.mockResolvedValue({data: {access_token: "at-1", refresh_token: "rt-1", expires_in: 3600}} as never);

    await exchangeApiKey("rxl_test-key");

    expect(mockExchange).toHaveBeenCalledWith({body: {api_key: "rxl_test-key"}, throwOnError: true});
    expect(platformAccessToken.get()).toBe("at-1");
    expect(platformRefreshToken.get()).toBe("rt-1");
  });

  it("throws if ExchangeAPIKey response is missing tokens", async () => {
    mockExchange.mockResolvedValue({data: {}} as never);

    await expect(exchangeApiKey("rxl_test-key")).rejects.toThrow("Platform token exchange did not return tokens");
  });

  it("getPlatformToken returns undefined when never exchanged", async () => {
    expect(await getPlatformToken()).toBeUndefined();
  });

  it("getPlatformToken reuses a still-valid access token without refreshing", async () => {
    mockExchange.mockResolvedValue({data: {access_token: "at-1", refresh_token: "rt-1", expires_in: 3600}} as never);
    await exchangeApiKey("rxl_test-key");

    const token = await getPlatformToken();

    expect(token).toBe("at-1");
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it("getPlatformToken refreshes an expired access token", async () => {
    mockExchange.mockResolvedValue({data: {access_token: "at-1", refresh_token: "rt-1", expires_in: 3600}} as never);
    await exchangeApiKey("rxl_test-key");
    platformExpireAt.set(Date.now() - 1000); // force expiry

    mockRefresh.mockResolvedValue({data: {access_token: "at-2", refresh_token: "rt-2", expires_in: 3600}} as never);
    const token = await getPlatformToken();

    expect(mockRefresh).toHaveBeenCalledWith({body: {refresh_token: "rt-1"}, throwOnError: true});
    expect(token).toBe("at-2");
  });

  it("clears platform tokens when refresh fails", async () => {
    mockExchange.mockResolvedValue({data: {access_token: "at-1", refresh_token: "rt-1", expires_in: 3600}} as never);
    await exchangeApiKey("rxl_test-key");
    platformExpireAt.set(Date.now() - 1000);

    mockRefresh.mockRejectedValue(new Error("refresh rejected"));

    await expect(getPlatformToken()).rejects.toThrow("refresh rejected");
    expect(platformAccessToken.get()).toBeUndefined();
    expect(platformRefreshToken.get()).toBeUndefined();
  });
});
