/**
 * AuthStore hydration tests
 * Tests: what isLogged is seeded from on module evaluation
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";

// The atoms live in a globalThis registry that outlives vi.resetModules(), so
// re-importing authStore alone would hand back the previous test's atom.
const loadIsLogged = async (cookieVals: Record<string, string>) => {
  resetSharedRuntime();
  vi.resetModules();
  vi.doMock("../../auth/cookie", () => ({initVals: cookieVals, setStoreCookie: vi.fn()}));
  const {isLogged} = await import("../../auth/authStore");
  return isLogged.get();
};

describe("AuthStore - isLogged hydration", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("is true when the auth cookie says so", async () => {
    expect(await loadIsLogged({isLogged: "true"})).toBe(true);
  });

  it("is false without the auth cookie", async () => {
    expect(await loadIsLogged({})).toBe(false);
  });

  it("stays false on an OAuth callback, where the exchange has not run yet", async () => {
    const state = "google_abc";
    sessionStorage.setItem("__rixl_auth_state_google", state);
    window.history.replaceState({}, "", `/#id_token=an-id-token&state=${state}`);

    expect(await loadIsLogged({})).toBe(false);

    window.history.replaceState({}, "", "/");
  });
});
