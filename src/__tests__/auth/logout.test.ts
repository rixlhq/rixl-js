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

  it("sends the access and refresh tokens for server-side revocation", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});

    await logout();

    expect(mockPostAuthV1Logout).toHaveBeenCalledWith({
      body: {token: "access-123", refresh_token: "refresh-456"},
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

  it("drops pending provider link flags", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});
    sessionStorage.setItem("__rixl_auth_social_connect_google", "true");
    sessionStorage.setItem("unrelated", "kept");

    await logout();

    expect(sessionStorage.getItem("__rixl_auth_social_connect_google")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("kept");
  });

  it("tells the other tabs to log out", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});
    const otherTab = new BroadcastChannel("__rixl_auth_session");
    const received = new Promise((resolve) => otherTab.addEventListener("message", (event) => resolve(event.data), {once: true}));

    await logout();

    await expect(received).resolves.toBe("logout");
    otherTab.close();
  });

  it("logs this tab out when another tab logs out", async () => {
    const otherTab = new BroadcastChannel("__rixl_auth_session");

    otherTab.postMessage("logout");
    await vi.waitFor(() => expect(isLogged.get()).toBe(false));

    expect(refreshToken.get()).toBe("");
    otherTab.close();
  });

  it("still logs out and tells the other tabs when session storage is blocked", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});
    const otherTab = new BroadcastChannel("__rixl_auth_session");
    const received = new Promise((resolve) => otherTab.addEventListener("message", (event) => resolve(event.data), {once: true}));
    const blocked = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    await expect(logout()).resolves.toBeUndefined();

    expect(isLogged.get()).toBe(false);
    await expect(received).resolves.toBe("logout");
    blocked.mockRestore();
    otherTab.close();
  });
});
