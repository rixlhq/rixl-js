/**
 * OAuth callback cleanup tests
 * Tests: completeOAuthCallback
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach, afterEach} from "vite-plus/test";
import {completeOAuthCallback, detectProvider, googleAuthUrl, googleConfig, hasProviderResponse, updateGoogleAuthUrl} from "@/providers";
import {STATE_STORAGE_KEY_PREFIX} from "@/constants";
import {urlParams} from "@/url";

const GOOGLE_STATE_KEY = `${STATE_STORAGE_KEY_PREFIX}google`;
const STATE = "google_abc";

const arriveFromProvider = (href: string) => {
  window.history.replaceState({}, "", href);
  sessionStorage.setItem(GOOGLE_STATE_KEY, STATE);
  urlParams.set("id_token", "an-id-token");
  urlParams.set("state", STATE);
};

describe("completeOAuthCallback", () => {
  beforeEach(() => {
    sessionStorage.clear();
    googleConfig.set({clientId: "client-123"});
  });

  afterEach(() => {
    urlParams.delete("id_token");
    urlParams.delete("state");
    window.history.replaceState({}, "", "/");
  });

  it("strips the provider response from the fragment", () => {
    arriveFromProvider(`/#id_token=an-id-token&state=${STATE}&authuser=0&prompt=none`);

    completeOAuthCallback();

    expect(window.location.href).toBe("http://localhost:3000/");
  });

  it("strips the provider response from the query string", () => {
    arriveFromProvider(`/?id_token=an-id-token&state=${STATE}`);

    completeOAuthCallback();

    expect(window.location.href).toBe("http://localhost:3000/");
  });

  it("keeps params the app put in the URL", () => {
    arriveFromProvider(`/dash?tab=media#id_token=an-id-token&state=${STATE}`);

    completeOAuthCallback();

    expect(window.location.href).toBe("http://localhost:3000/dash?tab=media");
  });

  it("leaves a non-OAuth fragment alone", () => {
    arriveFromProvider(`/?id_token=an-id-token&state=${STATE}#section`);

    completeOAuthCallback();

    expect(window.location.href).toBe("http://localhost:3000/#section");
  });

  it("retires the consumed state so it cannot be replayed as a nonce", () => {
    arriveFromProvider(`/#id_token=an-id-token&state=${STATE}`);

    completeOAuthCallback();

    expect(sessionStorage.getItem(GOOGLE_STATE_KEY)).not.toBe(STATE);
  });

  it("rebuilds the auth URL with a state the next callback can validate", () => {
    arriveFromProvider(`/#id_token=an-id-token&state=${STATE}`);
    updateGoogleAuthUrl();

    completeOAuthCallback();

    const nextState = new URL(googleAuthUrl.get()!).searchParams.get("state");
    expect(nextState).not.toBe(STATE);
    expect(sessionStorage.getItem(GOOGLE_STATE_KEY)).toBe(nextState);
  });

  it("does nothing when the URL holds no provider response", () => {
    window.history.replaceState({}, "", "/dash?tab=media");

    completeOAuthCallback();

    expect(window.location.href).toBe("http://localhost:3000/dash?tab=media");
  });
});

describe("hasProviderResponse", () => {
  afterEach(() => {
    urlParams.delete("id_token");
    urlParams.delete("state");
  });

  it("is true for a response whose state no longer validates", () => {
    urlParams.set("id_token", "an-id-token");
    urlParams.set("state", "google_stale");
    sessionStorage.clear();

    // detectProvider() rejects it, so nothing else would report this arrival.
    expect(detectProvider()).toBeUndefined();
    expect(hasProviderResponse()).toBe(true);
  });

  it("is false on an ordinary page load", () => {
    expect(hasProviderResponse()).toBe(false);
  });
});
