/**
 * One rotation of the refresh token into an org, and what its refusal means:
 * another tab may have spent the token first, or the sign-in is dead.
 */
import {persistRotatedTokens, type RotationScope} from "./api/tokens";
import {refreshTokens} from "./api/refresh-tokens";
import {toOrgAccessError} from "./api/org-access-error";
import {ApiError} from "./api/types";
import {HTTP_STATUS} from "./constants";
import {AuthProvider} from "./providers";
import {isCurrentSignIn} from "./sign-in-cookies";
import {commit} from "./store-commit";
import {adoptStoredRefreshToken, endRefusedSignIn} from "./stored-sign-in";
import {refreshToken} from "./token-atoms";
import {isLimitedScopeTokenResponse} from "./utils/requires-action";

interface SentToken {
  token: string;
  signIn: string | undefined;
}

// How long a refused refresh waits for a tab that may have won the race to store its token.
const ROTATION_SETTLE_MS = 1000;

/**
 * Whether auth-api refused the refresh token itself, which ends the sign-in: it
 * answers 401 for an expired, invalid or already-used token and for an inactive
 * account. Anything else says nothing against the token, so it is kept: a 400 is
 * about the request, a 403 about the org, and after a network failure, 429 or
 * 5xx the token could not be checked.
 */
const isRejectedRefresh = (error: unknown): boolean => error instanceof ApiError && error.status === HTTP_STATUS.UNAUTHORIZED;

const TOKEN_PATH = "/auth/v1/token";

const requestRefresh = (token: string, orgId: string): ReturnType<typeof refreshTokens> =>
  refreshTokens(AuthProvider.BEARER, {token}, {orgId}).catch(async (error: unknown) => {
    // A competing rotation may have succeeded but its response may still be in flight.
    if (isRejectedRefresh(error)) await new Promise((resolve) => setTimeout(resolve, ROTATION_SETTLE_MS));
    throw toOrgAccessError(error, orgId);
  });

/** Signs the tab out, with `dropTokens`, if `error` refuses the refresh token it holds for `signIn`. */
const settleRefusal = (error: unknown, {token, signIn}: SentToken, dropTokens: () => void): void => {
  if (!isRejectedRefresh(error)) return;
  commit(() => {
    if (endRefusedSignIn(token, signIn)) dropTokens();
  });
};

const requestWithCurrentToken = async (scope: RotationScope, dropTokens: () => void): ReturnType<typeof refreshTokens> => {
  const {signIn, orgId} = scope;
  const sent = refreshToken.get()!;
  try {
    return await requestRefresh(sent, orgId);
  } catch (error) {
    // Another caller in this tab may already have adopted the winner's token.
    adoptStoredRefreshToken();
    const newest = refreshToken.get();
    if (newest && newest !== sent && isCurrentSignIn(signIn)) {
      return requestRefresh(newest, orgId).catch((retryError: unknown) => {
        settleRefusal(retryError, {token: newest, signIn}, dropTokens);
        throw retryError;
      });
    }

    settleRefusal(error, {token: sent, signIn}, dropTokens);
    throw error;
  }
};

/** Rotates in the refresh queue. A successful response is applied once, outside the network retry path. */
export const rotateRefreshToken = async (scope: RotationScope, dropTokens: () => void): Promise<boolean> => {
  const response = await requestWithCurrentToken(scope, dropTokens);
  if (isLimitedScopeTokenResponse(response)) return false;

  switch (persistRotatedTokens(response, scope)) {
    case "sign-in-changed":
      throw new ApiError("The sign-in changed during the refresh", HTTP_STATUS.CONFLICT, TOKEN_PATH);
    case "org-changed":
      throw new ApiError("The tab's organization changed during the refresh", HTTP_STATUS.CONFLICT, TOKEN_PATH);
    case "unexpected-token":
      throw new ApiError("The refresh returned a token outside the requested organization or sign-in", HTTP_STATUS.BAD_GATEWAY, TOKEN_PATH);
    case "applied":
      return true;
  }
};
