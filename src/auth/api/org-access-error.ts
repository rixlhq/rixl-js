import {HTTP_STATUS} from "../constants";
import {ApiError, type ApiErrorContext, type WireErrorBody} from "./types";

const ORG_ACCESS_REASONS = ["MEMBERSHIP_SUSPENDED", "ORG_DELETED", "NOT_A_MEMBER"] as const;

/** Why auth-api refused to issue a token for an org. */
export type OrgAccessReason = (typeof ORG_ACCESS_REASONS)[number];

export interface OrgRefusal {
  reason: OrgAccessReason;
  orgId: string;
}

/**
 * A refresh into an org the user can't act in. The sign-in is still good: no
 * token is cleared, and the caller chooses the org to select next.
 */
export class OrgAccessError extends ApiError {
  public reason: OrgAccessReason;
  public orgId: string;

  constructor({reason, orgId}: OrgRefusal, context: ApiErrorContext) {
    super(`Organization ${orgId} is unavailable: ${reason}`, context);
    this.name = "OrgAccessError";
    this.reason = reason;
    this.orgId = orgId;
  }
}

const isOrgAccessReason = (reason: unknown): reason is OrgAccessReason => ORG_ACCESS_REASONS.some((known) => known === reason);

/** The error of a refresh into `orgId`, typed when the gateway names an org reason. */
export const toOrgAccessError = (error: unknown, orgId: string): unknown => {
  if (!(error instanceof ApiError) || error.status !== HTTP_STATUS.FORBIDDEN) return error;

  // `data` is the response body, which only a request that reached the gateway has.
  const reason = (error.data as WireErrorBody | undefined)?.reason;
  return isOrgAccessReason(reason) ? new OrgAccessError({reason, orgId}, error) : error;
};
