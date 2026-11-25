/**
 * Email invitations. An invitation is addressed to an email address and isn't a
 * membership until its recipient accepts it.
 *
 * The organization routes need a token for that org: call selectOrganization()
 * first. The recipient's routes act on the account, so a token for any org
 * works. lookupInvitation() needs no sign-in.
 *
 * Refusals reject with ApiError. Where auth-api names a reason, such as
 * `INVITATION_EXPIRED` or `INVITATION_PENDING`, it is on `error.data.reason`.
 */
import {
  authV1InvitationServiceAcceptInvitation,
  authV1InvitationServiceCreateInvitation,
  authV1InvitationServiceDeclineInvitation,
  authV1InvitationServiceListMyInvitations,
  authV1InvitationServiceListOrganizationInvitations,
  authV1InvitationServiceLookupInvitation,
  authV1InvitationServiceResendInvitation,
  authV1InvitationServiceRevokeInvitation,
} from "../../generated/sdk.gen";
import type {AuthV1AcceptInvitationRequest} from "../../generated/types.gen";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";
import {validateInput} from "../validation/base";
import {InvitationIdSchema, PublicInviteResponseSchema, InvitationTokenSchema, InviteMemberSchema} from "../validation/membership";
import {INVITATION_STATE_TO_PROTO, ROLE_TO_PROTO, toInvitationList, toInvitationLookup, toMembership} from "./mappers";
import {
  MembershipState,
  type AssignableRole,
  type InvitationList,
  type InvitationLookup,
  type InvitationPageParams,
  type ListInvitationsParams,
  type Membership,
} from "./types";

type InvitationResponse = MembershipState.ACCEPT | MembershipState.DECLINE;

const notAuthorized = (action: string) => (): Error => new Error(`User is not authorized to ${action}!`);
const invitationNotFound = (): Error => new Error("Invitation not found!");

/**
 * Invites an email address into the org. A 409 with reason `INVITATION_PENDING`
 * means the address already has a pending invitation: resend that one instead.
 */
export const inviteMember = async (orgId: string, email: string, role: AssignableRole): Promise<void> => {
  return apiCall(
    async () => {
      const validated = validateInput(InviteMemberSchema, {email, role});
      await authV1InvitationServiceCreateInvitation({
        path: {org_id: orgId},
        body: {email: validated.email, role: ROLE_TO_PROTO[validated.role]},
        throwOnError: true,
      });
    },
    {[HTTP_STATUS.UNAUTHORIZED]: notAuthorized("invite members")}
  );
};

/** The org's invitations in one state, pending unless `state` says otherwise. */
export const listOrganizationInvitations = async (orgId: string, params?: ListInvitationsParams): Promise<InvitationList> => {
  return apiCall(
    async () => {
      const {data} = await authV1InvitationServiceListOrganizationInvitations({
        path: {org_id: orgId},
        query: params && {
          state: params.state && INVITATION_STATE_TO_PROTO[params.state],
          page_size: params.page_size,
          page_token: params.page_token,
        },
        throwOnError: true,
      });
      return toInvitationList(data);
    },
    {[HTTP_STATUS.UNAUTHORIZED]: notAuthorized("list invitations")}
  );
};

/**
 * Emails the invitation again. This rotates its token, so earlier links stop
 * working. `invitationId` comes from listOrganizationInvitations(): a pending
 * invitee has no user ID.
 */
export const resendMemberInvite = async (orgId: string, invitationId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1InvitationServiceResendInvitation({
        path: {org_id: orgId, invitation_id: validateInput(InvitationIdSchema, invitationId)},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: notAuthorized("invite members"),
      [HTTP_STATUS.NOT_FOUND]: invitationNotFound,
    }
  );
};

export const revokeInvitation = async (orgId: string, invitationId: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1InvitationServiceRevokeInvitation({
        path: {org_id: orgId, invitation_id: validateInput(InvitationIdSchema, invitationId)},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: notAuthorized("revoke invitations"),
      [HTTP_STATUS.NOT_FOUND]: invitationNotFound,
    }
  );
};

/** What an emailed link is for. Public, and changes nothing. */
export const lookupInvitation = async (token: string): Promise<InvitationLookup> => {
  return apiCall(
    async () => {
      const {data} = await authV1InvitationServiceLookupInvitation({
        body: {token: validateInput(InvitationTokenSchema, token)},
        throwOnError: true,
      });
      return toInvitationLookup(data);
    },
    {[HTTP_STATUS.NOT_FOUND]: invitationNotFound}
  );
};

/**
 * The pending invitations sent to the signed-in user's email, one page at a
 * time. The list is empty until that email is verified.
 */
export const listMyInvitations = async (params?: InvitationPageParams): Promise<InvitationList> => {
  return apiCall(
    async () => {
      const {data} = await authV1InvitationServiceListMyInvitations({
        query: params && {page_size: params.page_size, page_token: params.page_token},
        throwOnError: true,
      });
      return toInvitationList(data);
    },
    {[HTTP_STATUS.UNAUTHORIZED]: notAuthorized("list invitations")}
  );
};

const respond = async (target: AuthV1AcceptInvitationRequest, state: InvitationResponse): Promise<Membership | undefined> => {
  validateInput(PublicInviteResponseSchema, {state});

  if (state === MembershipState.DECLINE) {
    await authV1InvitationServiceDeclineInvitation({body: target, throwOnError: true});
    return undefined;
  }
  const {data} = await authV1InvitationServiceAcceptInvitation({body: target, throwOnError: true});
  return toMembership(data);
};

const responseErrors = {
  [HTTP_STATUS.UNAUTHORIZED]: (): Error => new Error("Sign in to respond to the invitation!"),
  [HTTP_STATUS.NOT_FOUND]: invitationNotFound,
};

/**
 * Answers the invitation behind an emailed link. The user must be signed in, and
 * their verified email must be the invited one. Accepting resolves with the new
 * membership and leaves the tab on its org: call
 * selectOrganization(membership.org_id) to switch. Declining resolves with
 * nothing.
 */
export const publicRespondToInvitation = async (token: string, state: InvitationResponse): Promise<Membership | undefined> => {
  return apiCall(async () => respond({token: validateInput(InvitationTokenSchema, token)}, state), responseErrors);
};

/** publicRespondToInvitation() for an invitation from listMyInvitations(). */
export const respondToMyInvitation = async (invitationId: string, state: InvitationResponse): Promise<Membership | undefined> => {
  return apiCall(async () => respond({invitation_id: validateInput(InvitationIdSchema, invitationId)}, state), responseErrors);
};
