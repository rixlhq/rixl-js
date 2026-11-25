import {authV1TokenServiceLogout} from "../../generated/sdk.gen";
import {accessToken, endSignIn, limitedAccessToken, refreshToken} from "../authStore";
import {announceLogout} from "../logout-channel";
import {browserSignIn, signInMarker} from "../sign-in-cookies";
import {clearSocialConnectAttempts} from "../social/socialState";
import {commit} from "../store-commit";
import {adoptStoredRefreshToken} from "../stored-sign-in";

const REVOCATION_TIMEOUT_MS = 5000;

export interface LogoutResult {
  /** Whether auth-api acknowledged the request. Sign-in-wide revocation requires server support for sign_in_id. */
  revoked: boolean;
}

const revoke = async (body: {token?: string; refresh_token?: string}): Promise<LogoutResult> => {
  const signal = AbortSignal.timeout(REVOCATION_TIMEOUT_MS);
  const timeout = new Promise<false>((resolve) => signal.addEventListener("abort", () => resolve(false), {once: true}));
  try {
    const request = authV1TokenServiceLogout({body, signal, keepalive: true, throwOnError: true});
    return {revoked: await Promise.race([timeout, request.then(() => true)])};
  } catch {
    return {revoked: false};
  }
};

/** Signs out locally before attempting server revocation. */
export const logout = async (): Promise<LogoutResult> => {
  let revocation: Promise<LogoutResult> | undefined;
  try {
    commit(() => {
      adoptStoredRefreshToken();
      const signIn = browserSignIn();
      const sameSignIn = signInMarker.get() === signIn;
      const body = {
        token: sameSignIn ? accessToken.get() || limitedAccessToken.get() || undefined : undefined,
        refresh_token: sameSignIn ? refreshToken.get() : undefined,
      };

      if (endSignIn(signIn)) clearSocialConnectAttempts();
      announceLogout(signIn);
      revocation = revoke(body);
    });
  } catch (error) {
    // Nanostores drains subscribers after the batch has already committed and the request has started.
    if (!revocation) throw error;
    console.error("A sign-out subscriber failed");
  }
  return revocation!;
};
