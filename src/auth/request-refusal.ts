/**
 * The gateway refuses a request with an org reason as soon as the token's org is
 * unavailable, long before the token expires and a refresh would say so.
 */
import {OrgAccessError, toOrgAccessError} from "./api/org-access-error";
import type {ApiError} from "./api/types";
import {signInMarkerOf} from "./sign-in-cookies";
import {commit} from "./store-commit";
import {adoptStoredRefreshToken} from "./stored-sign-in";
import {dropRefusedOrg, getLostOrg, tabOrgId, tabSignIn} from "./tab-org";
import {accessToken, expireAt} from "./token-atoms";
import {decodeOrgClaims, type OrgClaims} from "./utils/jwt";

/** Whether the token was this tab's: its sign-in, and the org it is on or has just lost. */
const isTabToken = (claims: OrgClaims): boolean =>
  signInMarkerOf(claims) === tabSignIn.get() && claims.orgId === (tabOrgId.get() ?? getLostOrg()?.orgId);

/**
 * Treats an org refusal of the tab's own token as a refused refresh: the caller
 * gets an OrgAccessError, the token isn't used again, and the tab leaves an org
 * it was removed from or that was deleted. Any other error is returned as is.
 */
export const toTabOrgRefusal = (error: ApiError, request: Request | undefined): unknown => {
  const bearer = request?.headers.get("Authorization")?.replace(/^Bearer /, "");
  const claims = bearer && decodeOrgClaims(bearer);
  if (!claims) return error;
  const refusal = toOrgAccessError(error, claims.orgId);
  if (!(refusal instanceof OrgAccessError)) return error;

  // Another tab may have signed in since the request left.
  adoptStoredRefreshToken();
  if (!isTabToken(claims)) return error;

  if (accessToken.get() === bearer) {
    commit(() => {
      // The next getToken() refreshes, and so learns where the tab stands now.
      accessToken.set(undefined);
      expireAt.set(0);
      dropRefusedOrg(refusal);
    });
  }
  return refusal;
};
