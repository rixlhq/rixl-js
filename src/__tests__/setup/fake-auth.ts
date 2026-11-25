/**
 * A stand-in for auth-api's refresh endpoint: one refresh token is live at a
 * time, it rotates on success, and a refused org leaves it unrotated. A dead
 * token answers 401, as auth-api's Unauthenticated does through the gateway.
 */
import {ApiError} from "../../auth/api/types";
import {createMockJWT} from "../utils/test-helpers";

export const PERSONAL_ORG = "org-personal";
export const ACCESS_LIFETIME_SECONDS = 900;

export interface RefreshBody {
  token_type?: string;
  refresh_token?: string;
  org_id?: string;
}

export const claimsOf = (accessToken: string | undefined): {id?: string; org_id?: string} =>
  accessToken ? (JSON.parse(atob(accessToken.split(".")[1]!)) as {id?: string; org_id?: string}) : {};

export const orgOf = (accessToken: string | undefined): string | undefined => claimsOf(accessToken).org_id;

export const createFakeAuth = () => {
  let liveRefreshToken = "";
  let signedInUser = "user-1";
  let signIns = 0;
  let issued = 0;
  const requests: RefreshBody[] = [];
  const refusals = new Map<string, string>();

  const issue = (orgId: string) => {
    issued += 1;
    liveRefreshToken = `refresh-${issued}`;
    return {
      access_token: createMockJWT({
        id: signedInUser,
        sign_in_id: `sign-in-${signIns}`,
        org_id: orgId,
        role: orgId === PERSONAL_ORG ? "owner" : "member",
        jti: issued,
      }),
      refresh_token: liveRefreshToken,
      expires_in: ACCESS_LIFETIME_SECONDS,
    };
  };

  const refresh = async ({body}: {body: RefreshBody}) => {
    requests.push(body);
    if (body.refresh_token !== liveRefreshToken) {
      throw new ApiError("unauthorized", 401, "/auth/v1/token", {error: "unauthorized"});
    }
    const reason = refusals.get(body.org_id ?? "");
    if (reason) {
      throw new ApiError("forbidden", 403, "/auth/v1/token", {error: "forbidden", reason});
    }
    return {data: issue(body.org_id!)};
  };

  return {
    /** The tokens an interactive sign-in returns: a new sign-in, always for the personal org. */
    signIn: (userId = "user-1") => {
      signedInUser = userId;
      signIns += 1;
      return issue(PERSONAL_ORG);
    },
    /** Tokens reissued inside the current sign-in, for the org the caller is on. */
    reissue: issue,
    refresh,
    /** Ends the sign-in: the live refresh token stops working. */
    revoke: () => {
      liveRefreshToken = "revoked";
    },
    requests,
    refusals,
  };
};
