/**
 * Email invitations. An invitation is addressed to an email address and isn't a
 * membership until its recipient accepts it.
 *
 * The organization routes need a token for that org: call selectOrganization()
 * first. The recipient's routes act on the account, so a token for any org
 * works. lookupInvitation() needs no sign-in.
 *
 * auth-api checks the input. Refusals reject with ApiError; where auth-api names
 * a reason, such as `INVITATION_EXPIRED`, it is on `error.data.reason`. To revoke
 * or decline, call authV1InvitationServiceRevokeInvitation() or
 * authV1InvitationServiceDeclineInvitation().
 */
import {
  authV1InvitationServiceAcceptInvitation,
  authV1InvitationServiceCreateInvitation,
  authV1InvitationServiceListMyInvitations,
  authV1InvitationServiceListOrganizationInvitations,
  authV1InvitationServiceLookupInvitation,
  authV1InvitationServiceResendInvitation,
} from "../../generated/sdk.gen";
import type {AuthV1AcceptInvitationRequest} from "../../generated/types.gen";
import {apiCall} from "../api/utils";
import {INVITATION_STATE_TO_PROTO, ROLE_TO_PROTO, toInvitation, toInvitationList, toInvitationLookup, toMembership} from "./mappers";
import type {
  AssignableRole,
  Invitation,
  InvitationList,
  InvitationLookup,
  InvitationPageParams,
  ListInvitationsParams,
  Membership,
} from "./types";

/**
 * Invites an email address into the org. A 409 with reason `INVITATION_PENDING`
 * means the address already has a pending invitation: resend that one instead.
 */
export const createInvitation = (orgId: string, email: string, role: AssignableRole): Promise<Invitation> =>
  apiCall(async () => {
    const {data} = await authV1InvitationServiceCreateInvitation({
      path: {org_id: orgId},
      body: {email, role: ROLE_TO_PROTO[role]},
      throwOnError: true,
    });
    return toInvitation(data);
  });

/** The org's invitations in one state, pending unless `state` says otherwise. */
export const listOrganizationInvitations = (orgId: string, params?: ListInvitationsParams): Promise<InvitationList> =>
  apiCall(async () => {
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
  });

/** Emails the invitation again. This rotates its token, so earlier links stop working. */
export const resendInvitation = (orgId: string, invitationId: string): Promise<Invitation> =>
  apiCall(async () => {
    const {data} = await authV1InvitationServiceResendInvitation({
      path: {org_id: orgId, invitation_id: invitationId},
      throwOnError: true,
    });
    return toInvitation(data);
  });

/** What an emailed link is for. Public, and changes nothing. */
export const lookupInvitation = (token: string): Promise<InvitationLookup> =>
  apiCall(async () => {
    const {data} = await authV1InvitationServiceLookupInvitation({body: {token}, throwOnError: true});
    return toInvitationLookup(data);
  });

/**
 * The pending invitations sent to the signed-in user's email, one page at a
 * time. The list is empty until that email is verified.
 */
export const listMyInvitations = (params?: InvitationPageParams): Promise<InvitationList> =>
  apiCall(async () => {
    const {data} = await authV1InvitationServiceListMyInvitations({
      query: params && {page_size: params.page_size, page_token: params.page_token},
      throwOnError: true,
    });
    return toInvitationList(data);
  });

/**
 * Accepts an invitation, named by the token of an emailed link or by its ID from
 * listMyInvitations(). The user must be signed in, with the invited email
 * verified. The tab stays on its org: call selectOrganization(membership.org_id)
 * to switch.
 */
export const acceptInvitation = (target: {token: string} | {invitation_id: string}): Promise<Membership> =>
  apiCall(async () => {
    const body: AuthV1AcceptInvitationRequest = target;
    const {data} = await authV1InvitationServiceAcceptInvitation({body, throwOnError: true});
    return toMembership(data);
  });
