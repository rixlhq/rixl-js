import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {logout} from "@/auth/logout";
import {refreshToken, accessToken, isLogged} from "@/authStore";

const mockPostAuthV1Logout = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1TokenServiceLogout: (...args: unknown[]) => mockPostAuthV1Logout(...args),
}));

describe("logout", () => {
  beforeEach(() => {
    mockPostAuthV1Logout.mockReset();
    accessToken.set("access-123");
    refreshToken.set("refresh-456");
    isLogged.set(true);
  });

  it("sends the refresh token for server-side revocation", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});

    await logout();

    expect(mockPostAuthV1Logout).toHaveBeenCalledWith({
      body: {token: "refresh-456"},
      throwOnError: true,
    });
  });

  it("clears local state after successful logout", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});

    await logout();

    expect(accessToken.get()).toBe("");
    expect(refreshToken.get()).toBe("");
    expect(isLogged.get()).toBe(false);
  });

  it("clears local state even when revocation fails", async () => {
    mockPostAuthV1Logout.mockRejectedValue(new Error("network down"));

    await expect(logout()).resolves.toBeUndefined();

    expect(accessToken.get()).toBe("");
    expect(refreshToken.get()).toBe("");
    expect(isLogged.get()).toBe(false);
  });
});
