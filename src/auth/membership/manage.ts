import {
  authV1MembershipServiceUpdateActiveMembership,
  authV1MembershipServiceUpdateMemberRole,
  authV1MembershipServiceRemoveMember,
  authV1MembershipServiceLeaveOrganization,
} from "../../generated/sdk.gen";
import type {AuthV1MembershipRole} from "../../generated/types.gen";
import {accessToken, expireAt, getToken} from "../authStore";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";
import type {AssignableRole} from "./types";
import {validateInput} from "../validation/base";
import {UpdateMemberRoleSchema} from "../validation/membership";

const ROLE_TO_PROTO: Record<AssignableRole, AuthV1MembershipRole> = {
  admin: "MEMBERSHIP_ROLE_ADMIN",
  member: "MEMBERSHIP_ROLE_MEMBER",
};

/**
 * Switches the caller's active organization.
 *
 * Identified by org id, not by `Membership.id`. The API models a membership as
 * the pair (user_id, org_id): every sibling endpoint takes `user.org_id` as a
 * path param, and this call's own `MembershipMutation` response is keyed by that
 * pair. `Membership.id` is a `user_id:org_id` concatenation that no endpoint
 * accepts — passing it here is rejected with "invalid membership ID". The
 * backend takes user_id from the bearer token.
 */
export const updateActiveMembership = async (orgId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1MembershipServiceUpdateActiveMembership({
        body: {user: {org_id: orgId}},
        throwOnError: true,
      });
      accessToken.set(undefined);
      expireAt.set(0);
      await getToken();
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update active membership!"),
    }
  );
};

export const updateMemberRole = async (orgId: string, userId: string, role: AssignableRole): Promise<void> => {
  return apiCall(
    async () => {
      const validated = validateInput(UpdateMemberRoleSchema, {role});
      await authV1MembershipServiceUpdateMemberRole({
        path: {"user.org_id": orgId, user_id: userId},
        body: {role: ROLE_TO_PROTO[validated.role]},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to update member roles!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Member not found!"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Cannot change role of organization owner!"),
    }
  );
};

export const deleteMember = async (orgId: string, userId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1MembershipServiceRemoveMember({
        path: {"user.org_id": orgId, user_id: userId},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to delete members!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Member not found!"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Cannot remove organization owner!"),
    }
  );
};

export const leaveOrganization = async (orgId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1MembershipServiceLeaveOrganization({
        path: {org_id: orgId},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to leave an organization!"),
      [HTTP_STATUS.FORBIDDEN]: () => new Error("Cannot leave organization as you are the last member!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Organization not found!"),
    }
  );
};
