import {
  authV1MembershipServiceInviteMember,
  authV1MembershipServiceResendInvitation,
  authV1MembershipServiceAcceptInvitation,
  authV1MembershipServiceDeclineInvitation,
  authV1MembershipServiceRespondToMembershipApplication,
} from "../../generated/sdk.gen";
import type {AuthV1MembershipRole, AuthV1MembershipApplicationState} from "../../generated/types.gen";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";
import {MembershipState, type AssignableRole} from "./types";
import {validateInput} from "../validation/base";
import {AcceptDeclineMembershipSchema, PublicInviteResponseSchema, InviteMemberSchema, ResendInviteSchema} from "../validation/membership";

const ROLE_TO_PROTO: Record<AssignableRole, AuthV1MembershipRole> = {
  admin: "MEMBERSHIP_ROLE_ADMIN",
  member: "MEMBERSHIP_ROLE_MEMBER",
};

const STATE_TO_PROTO: Record<"accepted" | "declined", AuthV1MembershipApplicationState> = {
  accepted: "MEMBERSHIP_APPLICATION_STATE_APPROVED",
  declined: "MEMBERSHIP_APPLICATION_STATE_DECLINED",
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
      [HTTP_STATUS.CONFLICT]: () => new Error(`User with username ${username} already exists!`),
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
      [HTTP_STATUS.CONFLICT]: () => new Error(`User with ID ${userId} already exists!`),
    }
  );
};

export const respondToInvitation = async (orgId: string, state: MembershipState.ACCEPTED | MembershipState.DECLINED): Promise<void> => {
  return apiCall(
    async () => {
      const validated = validateInput(AcceptDeclineMembershipSchema, {state}) as {state: "accepted" | "declined"};

      // The invitee's own endpoint: UpdateMembershipState is an org admin deciding someone else's application.
      await authV1MembershipServiceRespondToMembershipApplication({
        path: {org_id: orgId},
        body: {state: STATE_TO_PROTO[validated.state]},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to accept/decline an Invite!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Invite not found!"),
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
