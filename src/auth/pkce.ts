import {PKCE_STORAGE_KEY_PREFIX} from "./constants";

const storagePath = (provider: string) => PKCE_STORAGE_KEY_PREFIX + provider;

const base64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Gets or generates the PKCE code verifier for a provider. It lives in session
 * storage so the callback page can send it with the authorization code.
 */
export function getPkceVerifier(provider: string): string {
  const stored = sessionStorage.getItem(storagePath(provider));
  if (stored) return stored;

  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  sessionStorage.setItem(storagePath(provider), verifier);
  return verifier;
}

/** The stored verifier, without minting one: a callback can only redeem the code it was issued for. */
export function readPkceVerifier(provider: string): string | null {
  return sessionStorage.getItem(storagePath(provider));
}

export function clearPkceVerifier(provider: string): void {
  sessionStorage.removeItem(storagePath(provider));
}

/** The S256 code challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}
