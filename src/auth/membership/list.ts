import {authV1MembershipServiceListMemberships, authV1MembershipServiceListOrganizationMembers} from "../../generated/sdk.gen";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";
import {toMembership, toMembershipApplication, toMember} from "./mappers";
import type {PaginationParams} from "../pagination-utils";
import {listMyInvitations} from "./invite";
import type {InvitationPageParams, Membership, MembershipApplication, Member} from "./types";

export const listActiveMemberships = async (paginationParams?: PaginationParams): Promise<Membership[]> => {
  return apiCall(
    async () => {
      const {data} = await authV1MembershipServiceListMemberships({
        query: {state: "MEMBERSHIP_STATE_ACTIVE", limit: 25, ...paginationParams},
        throwOnError: true,
      });

      return (data.memberships || []).map(toMembership);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to list memberships!"),
    }
  );
};

/**
 * One page of listMyInvitations(), shaped as pending memberships. Use
 * listMyInvitations() to page through them all.
 */
export const listPendingMemberships = async (params?: InvitationPageParams): Promise<MembershipApplication[]> => {
  const {invitations} = await listMyInvitations(params);
  return invitations.map(toMembershipApplication);
};

export const listOrganizationMembers = async (orgId: string, paginationParams?: PaginationParams): Promise<Member[]> => {
  return apiCall(
    async () => {
      const {data} = await authV1MembershipServiceListOrganizationMembers({
        path: {"user.org_id": orgId},
        query: paginationParams,
        throwOnError: true,
      });

      return (data.members || []).map(toMember);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to list organization members!"),
    }
  );
};
