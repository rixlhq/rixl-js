/**
 * getToken() deduplication across copies of the package
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";

const refreshTokens = vi.hoisted(() => vi.fn());

vi.mock("../../auth/api/refresh-tokens", () => ({refreshTokens}));
vi.mock("../../auth/cookie", () => ({initVals: {}, setStoreCookie: vi.fn()}));

// Re-evaluating the module stands in for a second copy of the package.
const loadSecondCopy = async () => {
  vi.resetModules();
  return import("../../auth/authStore");
};

describe("getToken across copies of the package", () => {
  beforeEach(() => {
    vi.resetModules();
    resetSharedRuntime();
    refreshTokens.mockReset();
    refreshTokens.mockResolvedValue({access_token: "fresh-access", refresh_token: "rotated-refresh", expires_in: 3600});
  });

  it("runs one refresh when two copies ask for a token at once", async () => {
    const first = await import("../../auth/authStore");
    // expires_in of 0 leaves the access token already stale, forcing a refresh.
    first.setTokens("stale-access", "refresh-token", 0);
    (await import("../../auth/initialization")).initDeferred.resolve();

    const second = await loadSecondCopy();
    const [a, b] = await Promise.all([first.getToken(), second.getToken()]);

    // Two refreshes would mean the second presented a refresh token the gateway
    // had already rotated away, failing a call that should have succeeded.
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(a).toBe("fresh-access");
    expect(b).toBe("fresh-access");
  });
});
