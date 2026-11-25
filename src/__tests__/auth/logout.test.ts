import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {logout} from "@/auth/logout";
import {tabSignIn} from "@/tab-org";
import {signInMarker} from "@/sign-in-cookies";
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
    signInMarker.set("user-1:sign-in-1");
    tabSignIn.set("user-1:sign-in-1");
    isLogged.set(true);
  });

  it("sends the access and refresh tokens for server-side revocation", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});

    await logout();

    expect(mockPostAuthV1Logout).toHaveBeenCalledWith({
      body: {token: "access-123", refresh_token: "refresh-456"},
      signal: expect.any(AbortSignal),
      keepalive: true,
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

    await expect(logout()).resolves.toEqual({revoked: false});

    expect(accessToken.get()).toBe("");
    expect(refreshToken.get()).toBe("");
    expect(isLogged.get()).toBe(false);
  });

  it("clears state immediately and ends one stalled revocation at the timeout", async () => {
    const timeout = new AbortController();
    const deadline = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    const response = Promise.withResolvers<{data: object}>();
    mockPostAuthV1Logout.mockReturnValue(response.promise);
    const done = logout();
    try {
      expect(isLogged.get()).toBe(false);
      expect(refreshToken.get()).toBe("");
      expect(deadline).toHaveBeenCalledWith(5000);
      timeout.abort();
      await expect(done).resolves.toEqual({revoked: false});
      expect(mockPostAuthV1Logout).toHaveBeenCalledOnce();
    } finally {
      timeout.abort();
      response.resolve({data: {}});
      await done;
      deadline.mockRestore();
    }
  });

  it("still notifies peers and revokes if an isLogged listener throws", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});
    const otherTab = new BroadcastChannel("__rixl_auth_logout");
    const message = vi.fn();
    otherTab.addEventListener("message", message);
    const stop = isLogged.listen(() => {
      throw new Error("consumer failed");
    });
    try {
      await expect(logout()).resolves.toEqual({revoked: true});
      expect(isLogged.get()).toBe(false);
      expect(mockPostAuthV1Logout).toHaveBeenCalledOnce();
      await vi.waitFor(() => expect(message).toHaveBeenCalledOnce());
    } finally {
      stop();
      otherTab.close();
    }
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
    const otherTab = new BroadcastChannel("__rixl_auth_logout");
    const received = new Promise((resolve) => otherTab.addEventListener("message", (event) => resolve(event.data), {once: true}));

    await logout();

    await expect(received).resolves.toEqual({type: "logout", signIn: "user-1:sign-in-1"});
    otherTab.close();
  });

  it("logs this tab out when another tab logs out", async () => {
    const otherTab = new BroadcastChannel("__rixl_auth_logout");

    otherTab.postMessage({type: "logout", signIn: "user-1:sign-in-1"});
    await vi.waitFor(() => expect(isLogged.get()).toBe(false));

    expect(refreshToken.get()).toBe("");
    otherTab.close();
  });

  it("still logs out and tells the other tabs when sessionStorage is blocked", async () => {
    mockPostAuthV1Logout.mockResolvedValue({data: {}});
    const otherTab = new BroadcastChannel("__rixl_auth_logout");
    const received = new Promise((resolve) => otherTab.addEventListener("message", (event) => resolve(event.data), {once: true}));
    const blocked = vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });

    await expect(logout()).resolves.toEqual({revoked: true});

    expect(isLogged.get()).toBe(false);
    await expect(received).resolves.toEqual({type: "logout", signIn: "user-1:sign-in-1"});
    blocked.mockRestore();
    otherTab.close();
  });
});
