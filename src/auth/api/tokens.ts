import {getToken, limitedAccessToken, setTokens} from "../authStore";
import {beginSignIn, storeRefreshToken, wantsTokensFor} from "../stored-sign-in";
import {HTTP_STATUS} from "../constants";
import {serializeRefresh} from "../refresh-lock";
import {captureSignInContext, isSignInContextCurrent} from "../sign-in-context";
import {commit} from "../store-commit";
import {isCurrentSignIn, signInMarkerOf} from "../sign-in-cookies";
import {decodeOrgClaims, type OrgClaims} from "../utils/jwt";
import {ApiError} from "./types";
import {getLeftOrg, getLostOrg, lastActiveOrgId, retirePermissionScope, tabOrgId} from "../tab-org";

interface TokenFields {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  last_active_org_id?: string;
}

type CompleteTokens = Required<Pick<TokenFields, "access_token" | "refresh_token" | "expires_in">> & TokenFields;

const isComplete = (tokens: TokenFields): tokens is CompleteTokens => !!(tokens.access_token && tokens.refresh_token && tokens.expires_in);

export interface RotationScope {
  signIn: string | undefined;
  orgId: string;
  tabOrg: string | undefined;
  explicitSelection?: boolean;
}

type RotationResult = "applied" | "sign-in-changed" | "org-changed" | "unexpected-token";

const canAdoptOrg = ({tabOrg, orgId, explicitSelection}: RotationScope): boolean =>
  tabOrgId.get() === tabOrg ||
  (!!explicitSelection && tabOrg !== orgId && !tabOrgId.get() && (getLostOrg()?.orgId ?? getLeftOrg()) === tabOrg);

/** Commits a rotation only for its original sign-in and adopts the access token only within its original tab scope. */
export function persistRotatedTokens(
  {access_token: access, refresh_token: refresh, expires_in: expiresIn}: CompleteTokens,
  scope: RotationScope
): RotationResult {
  const {signIn, orgId, explicitSelection} = scope;
  if (!wantsTokensFor(signIn)) return "sign-in-changed";

  const claims = decodeOrgClaims(access);
  if (!claims || signInMarkerOf(claims) !== signIn) return "unexpected-token";

  if (claims.orgId !== orgId || !canAdoptOrg(scope)) {
    storeRefreshToken(refresh);
    return claims.orgId !== orgId ? "unexpected-token" : "org-changed";
  }

  if (explicitSelection) retirePermissionScope();
  setTokens(access, refresh, Number(expiresIn));
  return "applied";
}

type SignInContext = ReturnType<typeof captureSignInContext>;

const holdsLimitedBearer = (context: SignInContext, bearer: string): boolean =>
  !context.marker &&
  (!context.limited || context.limited === bearer) &&
  limitedAccessToken.get() === bearer &&
  isSignInContextCurrent(context);

const promoteLimitedSignIn = (tokens: CompleteTokens, caller: OrgClaims): boolean => {
  const claims = decodeOrgClaims(tokens.access_token);
  return !!claims && claims.orgId === caller.orgId && signInMarkerOf(claims) === signInMarkerOf(caller) && persistSignInTokens(tokens);
};

/** Runs a rotation under the caller's sign-in lock. Resolve its bearer before joining the queue. */
export async function reissueTokens<T>(
  request: (headers: Record<string, string>) => Promise<T>,
  tokensOf: (response: T) => TokenFields | null | undefined,
  {allowLimited = false} = {}
): Promise<{response: T; applied: boolean}> {
  const limited = allowLimited ? limitedAccessToken.get() : null;
  const bearer = limited || (await getToken());
  const claims = bearer && decodeOrgClaims(bearer);
  if (!claims) throw new ApiError("No access token available for reissuing tokens", HTTP_STATUS.UNAUTHORIZED);

  const context = captureSignInContext();
  const signIn = signInMarkerOf(claims);
  const {orgId} = claims;
  return serializeRefresh(signIn, async () => {
    if (!(limited ? holdsLimitedBearer(context, limited) : isCurrentSignIn(signIn))) {
      throw new ApiError("The sign-in changed before reissuing tokens", HTTP_STATUS.UNAUTHORIZED);
    }
    const response = await request({Authorization: `Bearer ${bearer}`});
    const tokens = tokensOf(response);
    if (!tokens || !isComplete(tokens)) return {response, applied: false};

    if (limited) {
      return {response, applied: holdsLimitedBearer(context, limited) && promoteLimitedSignIn(tokens, claims)};
    }
    const applied = persistRotatedTokens(tokens, {signIn, orgId, tabOrg: orgId}) === "applied";
    return {response, applied};
  });
}

/** Stores the tokens of an interactive sign-in, which are for the user's personal org. */
export function persistSignInTokens(data: TokenFields | null | undefined): boolean {
  const tokens = data ?? {};
  if (!isComplete(tokens)) return false;

  commit(() => {
    beginSignIn(tokens.access_token);
    setTokens(tokens.access_token, tokens.refresh_token, Number(tokens.expires_in));
    // The gateway sends "" when there is no earlier org.
    lastActiveOrgId.set(tokens.last_active_org_id || undefined);
  });
  return true;
}
