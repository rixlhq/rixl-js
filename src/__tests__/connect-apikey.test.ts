/**
 * connect({apiKey}) Tests
 * Verifies apiKey mode exchanges for a real Bearer token (never sends a raw
 * X-API-Key header) and that public routes still get no Authorization header,
 * matching the same interceptor behavior as user-session (`auth`) mode.
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {client} from "../generated/client.gen";
import {connect} from "../connect";
import {platformauthV1PlatformAuthServiceExchangeApiKey} from "../generated/sdk.gen";

vi.mock("../generated/sdk.gen", () => ({
  platformauthV1PlatformAuthServiceExchangeApiKey: vi.fn(),
}));

const mockExchange = vi.mocked(platformauthV1PlatformAuthServiceExchangeApiKey);

const runRequestInterceptors = async (method: string, url: string): Promise<Request> => {
  let request = new Request(url, {method});
  for (const fn of client.interceptors.request.fns) {
    if (fn) {
      request = (await fn(request, {} as never)) as Request;
    }
  }
  return request;
};

describe("connect({apiKey})", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExchange.mockResolvedValue({data: {access_token: "platform-at", refresh_token: "platform-rt", expires_in: 3600}} as never);
  });

  it("exchanges the key and attaches a Bearer token, never a raw X-API-Key", async () => {
    await connect({baseUrl: "https://api.example.com", apiKey: "rxl_test-key"});

    expect(mockExchange).toHaveBeenCalledWith({body: {api_key: "rxl_test-key"}, throwOnError: true});

    const request = await runRequestInterceptors("GET", "https://api.example.com/users/me");

    expect(request.headers.get("Authorization")).toBe("Bearer platform-at");
    expect(request.headers.has("X-API-Key")).toBe(false);
  });

  it("still skips Authorization on public routes in apiKey mode", async () => {
    await connect({baseUrl: "https://api.example.com", apiKey: "rxl_test-key"});

    const request = await runRequestInterceptors("POST", "https://api.example.com/auth/v1/register");

    expect(request.headers.has("Authorization")).toBe(false);
  });

  it("keeps the client baseUrl at the configured value once configureSdkClient() runs", async () => {
    // Regression test: configureSdkClient() sets client baseUrl from the apiURL
    // store on its first call. Without apiURL.set() in connect(), apiKey-only
    // mode (no `auth`) would have its baseUrl silently reset to "" here.
    await connect({baseUrl: "https://api.example.com", apiKey: "rxl_test-key"});

    expect(client.getConfig().baseUrl).toBe("https://api.example.com");
  });
});
