import {it, expect} from "vite-plus/test";

export const testTokenRefreshBehavior = (
  runAction: (handleRefresh: boolean) => Promise<any>,
  mockAuthenticatedFetch: any,
  getMockSetTokens: () => any
) => {
  it("should refresh tokens when handleTokenRefresh is true", async () => {
    mockAuthenticatedFetch.mockResolvedValue({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 3600,
    });

    await runAction(true);

    expect(getMockSetTokens()).toHaveBeenCalledWith("new-access-token", "new-refresh-token", 3600);
  });

  it("should not refresh tokens when handleTokenRefresh is false", async () => {
    mockAuthenticatedFetch.mockResolvedValue(undefined);

    await runAction(false);

    expect(getMockSetTokens()).not.toHaveBeenCalled();
  });

  it("should not refresh tokens when response doesn't contain token data", async () => {
    mockAuthenticatedFetch.mockResolvedValue({message: "Success"});

    await runAction(true);

    expect(getMockSetTokens()).not.toHaveBeenCalled();
  });
};
