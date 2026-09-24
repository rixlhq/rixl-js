/**
 * Integration Scenario Test
 *
 * Verifies that initClient correctly configures the SDK client baseUrl
 * and that auth functions construct correct request URLs.
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {initClient} from "@/init";
import {loginWithEmail} from "@/auth/login";
import {registerWithEmail} from "@/auth/register";

describe("Integration Scenario - Dashboard Usage", () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;

    const mockResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () =>
        JSON.stringify({
          status: "ok",
          tokens: {
            access_token: "mock_access_token",
            refresh_token: "mock_refresh_token",
            expires_in: 3600,
          },
        }),
      json: async () => ({
        status: "ok",
        tokens: {
          access_token: "mock_access_token",
          refresh_token: "mock_refresh_token",
          expires_in: 3600,
        },
      }),
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function () {
        return this;
      },
      headers: new Headers({"content-type": "application/json"}),
    };

    global.fetch = vi.fn().mockResolvedValue(mockResponse) as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should work with dashboard configuration (VITE_AUTH_API_URL)", async () => {
    initClient({
      apiUrl: "http://localhost:8081",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      await loginWithEmail("test@example.com", "Password123!");
    } catch {
      // Ignore errors — we only check the request URL
    }

    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as any).mock.calls[0];
    const request = fetchCall[0];

    expect(request.url).toBe("http://localhost:8081/auth/v1/login");
  });

  it("should work with registration endpoints", async () => {
    const registerResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({verification_id: "verify-123", message: "Registration successful"}),
      json: async () => ({verification_id: "verify-123", message: "Registration successful"}),
      blob: async () => new Blob(),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone: function () {
        return this;
      },
      headers: new Headers({"content-type": "application/json"}),
    };
    global.fetch = vi.fn().mockResolvedValue(registerResponse) as any;

    initClient({
      apiUrl: "http://localhost:8081",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    try {
      await registerWithEmail("newuser@example.com", "Password123!");
    } catch {
      // Ignore errors — we only check the request URL
    }

    expect(global.fetch).toHaveBeenCalled();
    const fetchCall = (global.fetch as any).mock.calls[0];
    const request = fetchCall[0];
    expect(request.url).toBe("http://localhost:8081/auth/v1/register");
  });

  it("should work with different API URL formats", async () => {
    const apiUrls = ["http://localhost:8081", "http://localhost:8081/", "https://api.example.com", "https://api.example.com/"];

    for (const apiUrl of apiUrls) {
      vi.clearAllMocks();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          JSON.stringify({
            status: "ok",
            tokens: {
              access_token: "mock_access_token",
              refresh_token: "mock_refresh_token",
              expires_in: 3600,
            },
          }),
        json: async () => ({
          status: "ok",
          tokens: {
            access_token: "mock_access_token",
            refresh_token: "mock_refresh_token",
            expires_in: 3600,
          },
        }),
        blob: async () => new Blob(),
        arrayBuffer: async () => new ArrayBuffer(0),
        clone: function () {
          return this;
        },
        headers: new Headers({"content-type": "application/json"}),
      }) as any;

      initClient({apiUrl});
      await new Promise((resolve) => setTimeout(resolve, 10));

      await loginWithEmail("test@example.com", "Password123!");

      const fetchCall = (global.fetch as any).mock.calls[0];
      const request = fetchCall[0];

      expect(request.url).toMatch(/^https?:\/\/[^/]+\/auth\/v1\/login$/);
      expect(request.url).not.toContain("//auth");
    }
  });

  it("documents the migration from ky to @rixl/sdk", () => {
    /**
     * BEFORE (ky-based):
     *   initClient({ apiUrl: "http://localhost:8081" })
     *   publicFetch("auth/login", { method: "POST", body: {...} })
     *   → http://localhost:8081/auth/login
     *
     * AFTER (@rixl/sdk-based):
     *   initClient({ apiUrl: "http://localhost:8081" })
     *   authV1EmailServiceLogin({ body: {...}, throwOnError: true })
     *   → http://localhost:8081/auth/v1/login
     *
     * The SDK client gets baseUrl from apiURL nanostore subscription.
     * Auth token is injected via request interceptor.
     */
    expect(true).toBe(true);
  });
});
