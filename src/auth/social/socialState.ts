import {SOCIAL_CONNECT_KEY_PREFIX} from "../constants";

const socialStoragePath = (provider: string) => SOCIAL_CONNECT_KEY_PREFIX + provider;

/**
 * Sets a flag indicating that a social provider connection is being attempted
 * @param provider The provider identifier
 */
export function setSocialConnectAttempt(provider: string): void {
  sessionStorage.setItem(socialStoragePath(provider), "true");
}

/**
 * Checks if there's a pending social provider connection attempt
 * @param provider The provider identifier
 * @returns True if there's a pending connection attempt, false otherwise
 */
export function hasSocialConnectAttempt(provider: string): boolean {
  return sessionStorage.getItem(socialStoragePath(provider)) === "true";
}

/**
 * Clears the social provider connection attempt flag
 * @param provider The provider identifier
 */
export function clearSocialConnectAttempt(provider: string): void {
  sessionStorage.removeItem(socialStoragePath(provider));
}

/** Clears every provider's pending connection flag, so none outlives the session it was set in. */
export function clearSocialConnectAttempts(): void {
  try {
    const keys = Array.from({length: sessionStorage.length}, (_, i) => sessionStorage.key(i));
    keys.filter((key) => key?.startsWith(SOCIAL_CONNECT_KEY_PREFIX)).forEach((key) => sessionStorage.removeItem(key!));
  } catch {
    // Storage is blocked (a sandboxed iframe), so no flag can have been set either.
  }
}
