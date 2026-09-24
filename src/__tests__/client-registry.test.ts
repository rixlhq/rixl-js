/**
 * Client registry tests.
 *
 * Regression cover for a duplicated @rixl/sdk: a bundler gave a dependency its
 * own copy of this package, `connect()` configured only the consumer's copy, and
 * the dependency's requests went to the code generator's placeholder host and
 * 404'd. These tests pin both halves of the fix — every copy gets configured,
 * and an unconfigured copy fails loudly instead of calling the placeholder.
 */

import {describe, it, expect, beforeEach} from "vite-plus/test";
import {createClient, createConfig} from "../generated/client";
import {client as generatedClient} from "../generated/client.gen";
import {addClientInitializer, configureAllClients, registerClient} from "../client-registry";

const PLACEHOLDER_BASE_URL = "https://raw.githubusercontent.com";
const API_BASE_URL = "https://api.example.com";

type AnyClient = typeof generatedClient;

const makeClient = (baseUrl: string): AnyClient => createClient(createConfig({baseUrl})) as AnyClient;

const runRequestInterceptors = async (target: AnyClient, url: string): Promise<Request> => {
  let request = new Request(url, {method: "GET"});
  for (const fn of target.interceptors.request.fns) {
    if (fn) {
      request = await (fn as (r: Request) => Request | Promise<Request>)(request);
    }
  }
  return request;
};

describe("registerClient", () => {
  beforeEach(() => {
    configureAllClients(API_BASE_URL);
  });

  it("configures a copy that registers after connect() already ran", () => {
    const late = makeClient(PLACEHOLDER_BASE_URL);

    registerClient(late);

    expect(late.getConfig().baseUrl).toBe(API_BASE_URL);
  });

  it("is idempotent", () => {
    const target = makeClient(PLACEHOLDER_BASE_URL);

    registerClient(target);
    const interceptorCount = target.interceptors.request.fns.length;
    registerClient(target);

    expect(target.interceptors.request.fns.length).toBe(interceptorCount);
  });

  it("applies initializers registered before the copy existed", async () => {
    addClientInitializer((target) => {
      target.interceptors.request.use((request: Request) => {
        request.headers.set("X-Initializer", "applied");
        return request;
      });
    });
    const late = makeClient(PLACEHOLDER_BASE_URL);

    registerClient(late);

    const request = await runRequestInterceptors(late, `${API_BASE_URL}/media/v1/images/abc`);
    expect(request.headers.get("X-Initializer")).toBe("applied");
  });
});

describe("configureAllClients", () => {
  it("points every registered copy at the new baseUrl", () => {
    const copy = makeClient(PLACEHOLDER_BASE_URL);
    registerClient(copy);

    configureAllClients("https://api.rixl.test");

    expect(copy.getConfig().baseUrl).toBe("https://api.rixl.test");
  });

  it("configures the generated client of this copy", () => {
    configureAllClients(API_BASE_URL);

    expect(generatedClient.getConfig().baseUrl).toBe(API_BASE_URL);
  });
});

describe("unconfigured client guard", () => {
  it("rejects a request while the copy still holds the generator placeholder", async () => {
    const unconfigured = makeClient(PLACEHOLDER_BASE_URL);
    registerClient(unconfigured);
    unconfigured.setConfig({baseUrl: PLACEHOLDER_BASE_URL});

    await expect(runRequestInterceptors(unconfigured, `${PLACEHOLDER_BASE_URL}/media/v1/images/abc`)).rejects.toThrow(
      /no baseUrl is configured/
    );
  });

  it("names connect() so the caller knows the fix", async () => {
    const unconfigured = makeClient(PLACEHOLDER_BASE_URL);
    registerClient(unconfigured);
    unconfigured.setConfig({baseUrl: PLACEHOLDER_BASE_URL});

    await expect(runRequestInterceptors(unconfigured, `${PLACEHOLDER_BASE_URL}/media/v1/images/abc`)).rejects.toThrow(
      /connect\(\{baseUrl\}\)/
    );
  });

  it("rejects a request when no baseUrl is set at all", async () => {
    const unconfigured = makeClient(PLACEHOLDER_BASE_URL);
    registerClient(unconfigured);
    unconfigured.setConfig({baseUrl: ""});

    await expect(runRequestInterceptors(unconfigured, `${API_BASE_URL}/media/v1/images/abc`)).rejects.toThrow(/no baseUrl is configured/);
  });

  it("lets a configured copy through", async () => {
    const configured = makeClient(PLACEHOLDER_BASE_URL);
    registerClient(configured);
    configureAllClients(API_BASE_URL);

    const request = await runRequestInterceptors(configured, `${API_BASE_URL}/media/v1/images/abc`);

    expect(request.url).toContain("/media/v1/images/abc");
  });
});
