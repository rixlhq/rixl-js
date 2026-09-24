/**
 * Cross-copy provider state tests
 *
 * A bundler that inlines the SDK into an optimized dependency produces several
 * evaluations of these modules in one realm. connect() configures exactly one of
 * them, so anything a login path reads has to resolve to the same object in all
 * of them.
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {resetSharedRuntime} from "../setup/shared-runtime-reset";

// Re-evaluating the module stands in for a second copy of the package.
const loadSecondCopy = async <T>(path: string, pick: (module: any) => T): Promise<T> => {
  vi.resetModules();
  return pick(await import(path));
};

describe("provider state across copies of the package", () => {
  beforeEach(() => {
    vi.resetModules();
    resetSharedRuntime();
  });

  it("gives every copy the same google config atom", async () => {
    const first = (await import("@/providers/google")).googleConfig;
    const second = await loadSecondCopy("@/providers/google", (m) => m.googleConfig);

    expect(second).toBe(first);
  });

  it("lets a copy that never ran connect() read the auth URL login() needs", async () => {
    const {googleConfig, updateGoogleAuthUrl} = await import("@/providers/google");
    googleConfig.set({clientId: "client-123"});
    updateGoogleAuthUrl();

    const otherCopy = await loadSecondCopy("@/providers/google", (m) => m.googleAuthUrl);

    expect(otherCopy.get()).toContain("client_id=client-123");
  });

  it("gives every copy the same telegram config atom", async () => {
    const first = (await import("@/providers/telegram")).telegramConfig;
    const second = await loadSecondCopy("@/providers/telegram", (m) => m.telegramConfig);

    expect(second).toBe(first);
  });

  it("lets a copy that never ran connect() redirect to the configured login URL", async () => {
    // jsdom refuses real navigation, so stand in a plain object to record the assignment.
    const location = {href: "https://app.example.com/dashboard"};
    Object.defineProperty(window, "location", {value: location, writable: true, configurable: true});

    const {setLoginRedirectUrl} = await import("@/authConfig");
    setLoginRedirectUrl("https://app.example.com/login");

    const redirectFromOtherCopy = await loadSecondCopy("@/authConfig", (m) => m.redirectToLogin);
    redirectFromOtherCopy();

    expect(location.href).toBe("https://app.example.com/login");
  });
});
