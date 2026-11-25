import {
  authV1MembershipServiceInviteMember,
  authV1MembershipServiceResendInvitation,
  authV1MembershipServiceAcceptInvitation,
  authV1MembershipServiceDeclineInvitation,
} from "../../generated/sdk.gen";
import type {AuthV1MembershipRole} from "../../generated/types.gen";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";
import {MembershipState, type AssignableRole} from "./types";
import {validateInput} from "../validation/base";
import {PublicInviteResponseSchema, InviteMemberSchema, ResendInviteSchema} from "../validation/membership";

const ROLE_TO_PROTO: Record<AssignableRole, AuthV1MembershipRole> = {
  admin: "MEMBERSHIP_ROLE_ADMIN",
  member: "MEMBERSHIP_ROLE_MEMBER",
};

export const inviteMember = async (orgId: string, username: string, role: AssignableRole): Promise<void> => {
  return apiCall(
    async () => {
      const validated = validateInput(InviteMemberSchema, {username, role});
      await authV1MembershipServiceInviteMember({
        path: {"user.org_id": orgId},
        body: {username: validated.username, role: ROLE_TO_PROTO[validated.role]},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to invite members!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error(`User with username ${username} not found!`),
    }
  );
};

export const resendMemberInvite = async (orgId: string, userId: string): Promise<void> => {
  return apiCall(
    async () => {
      validateInput(ResendInviteSchema, {user_id: userId});
      await authV1MembershipServiceResendInvitation({
        path: {"user.org_id": orgId},
        body: {user_id: userId},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to invite members!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error(`User with ID ${userId} not found!`),
    }
  );
};

export const publicRespondToInvitation = async (token: string, state: MembershipState.ACCEPT | MembershipState.DECLINE): Promise<void> => {
  return apiCall(
    async () => {
      validateInput(PublicInviteResponseSchema, {state});

      if (state === MembershipState.ACCEPT) {
        await authV1MembershipServiceAcceptInvitation({
          path: {token},
          throwOnError: true,
        });
      } else {
        await authV1MembershipServiceDeclineInvitation({
          path: {token},
          throwOnError: true,
        });
      }
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid invitation token!"),
    }
  );
};
