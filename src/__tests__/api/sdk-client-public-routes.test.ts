/**
 * SDK Client Request Interceptor - Public Route Tests
 * Verifies that public auth routes (login, register, verify, etc.) never get a
 * stale Authorization header attached, while protected routes still do.
 * Regression test for gateway 401s caused by the token interceptor.
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {client} from "../../generated/client.gen";
import {configureSdkClient} from "../../auth/api/sdk-client";
import {ApiError} from "../../auth/api/types";
import {getToken} from "../../auth/authStore";

vi.mock("../../auth/api-url", () => ({
  apiURL: {
    get: vi.fn(() => "https://api.example.com"),
    set: vi.fn(),
    subscribe: vi.fn(),
  },
}));

vi.mock("../../auth/authStore", () => ({
  getToken: vi.fn(),
}));

const mockGetToken = vi.mocked(getToken);

const runRequestInterceptors = async (method: string, url: string): Promise<Request> => {
  let request = new Request(url, {method});
  for (const fn of client.interceptors.request.fns) {
    if (fn) {
      request = (await fn(request, {} as never)) as Request;
    }
  }
  return request;
};

describe("SDK client request interceptor", () => {
  beforeAll(() => {
    configureSdkClient();
  });

  beforeEach(() => {
    client.setConfig({baseUrl: "https://api.example.com"});
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue("valid-token");
  });

  it.each([
    "POST /auth/v1/login",
    "POST /auth/v1/register",
    "POST /auth/v1/token",
    "POST /auth/v1/email/verify",
    "POST /auth/v1/email/verify/resend",
    "POST /auth/v1/password/reset",
    "POST /auth/v1/password/reset/confirm",
    "POST /auth/v1/verify-totp",
    "POST /auth/v1/verify-passkey",
    "POST /auth/v1/passkey/login/begin",
    "POST /auth/v1/passkey/login/finish",
    "POST /auth/v1/logout",
    "POST /auth/v1/providers/connect",
    "POST /auth/v1/blog/unsubscribe/email",
    "POST /auth/v1/blog/broadcast",
    "POST /platform/auth/v1/token",
    "POST /platform/auth/v1/refresh",
  ])("does not attach Authorization to %s", async (spec) => {
    const [method, path] = spec.split(" ");
    const request = await runRequestInterceptors(method, `https://api.example.com${path}`);

    expect(request.headers.has("Authorization")).toBe(false);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it.each([
    "POST /auth/v1/invitations/abc-123",
    "GET /media/v1/videos/video-1",
    "GET /media/v1/images/image-1",
    "GET /posts/v1/feeds/home",
  ])("does not attach Authorization to public prefix %s", async (spec) => {
    const [method, path] = spec.split(" ");
    const request = await runRequestInterceptors(method, `https://api.example.com${path}`);

    expect(request.headers.has("Authorization")).toBe(false);
  });

  it.each(["POST /auth/v1/login", "POST /auth/v1/register"])(
    "does not attach Authorization even with a stale token present on %s",
    async (spec) => {
      const [method, path] = spec.split(" ");
      const request = await runRequestInterceptors(method, `https://api.example.com${path}`);

      expect(request.headers.has("Authorization")).toBe(false);
    }
  );

  it("attaches Authorization to protected routes", async () => {
    const request = await runRequestInterceptors("GET", "https://api.example.com/users/me");

    expect(request.headers.get("Authorization")).toBe("Bearer valid-token");
    expect(mockGetToken).toHaveBeenCalled();
  });

  it("leaves an explicitly set Authorization header untouched", async () => {
    const request = new Request("https://api.example.com/users/me", {
      method: "GET",
      headers: {Authorization: "Bearer explicit-token"},
    });
    for (const fn of client.interceptors.request.fns) {
      if (fn) {
        (await fn(request, {} as never)) as Request;
      }
    }

    expect(request.headers.get("Authorization")).toBe("Bearer explicit-token");
  });

  it("throws instead of sending a protected request when no token exists", async () => {
    mockGetToken.mockResolvedValue(undefined);

    await expect(runRequestInterceptors("GET", "https://api.example.com/users/me")).rejects.toBeInstanceOf(ApiError);
  });

  it("reports an unauthenticated protected request as a 401 for the requested endpoint", async () => {
    mockGetToken.mockResolvedValue(undefined);

    await expect(runRequestInterceptors("GET", "https://api.example.com/users/me")).rejects.toMatchObject({
      status: 401,
      endpoint: "/users/me",
    });
  });
});
