import type {
  AuthV1Membership,
  AuthV1Invitation,
  AuthV1InvitationState,
  AuthV1ListMyInvitationsResponse,
  AuthV1LookupInvitationResponse,
  AuthV1OrgMember,
  AuthV1MembershipRole,
  AuthV1MembershipState,
} from "../../generated/types.gen";
import {toOrganization} from "../organization-mappers";
import {
  MembershipRole,
  MembershipState,
  type AssignableRole,
  type Invitation,
  type InvitationList,
  type InvitationLookup,
  type InvitationState,
  type Membership,
  type Member,
} from "./types";

const ROLE_FROM_PROTO: Record<AuthV1MembershipRole, MembershipRole> = {
  MEMBERSHIP_ROLE_UNSPECIFIED: MembershipRole.MEMBER,
  MEMBERSHIP_ROLE_OWNER: MembershipRole.OWNER,
  MEMBERSHIP_ROLE_ADMIN: MembershipRole.ADMIN,
  MEMBERSHIP_ROLE_MEMBER: MembershipRole.MEMBER,
};

const STATE_FROM_PROTO: Record<AuthV1MembershipState, MembershipState> = {
  // An unnamed state grants nothing.
  MEMBERSHIP_STATE_UNSPECIFIED: MembershipState.SUSPENDED,
  MEMBERSHIP_STATE_ACTIVE: MembershipState.ACTIVE,
  MEMBERSHIP_STATE_SUSPENDED: MembershipState.SUSPENDED,
};

const INVITATION_STATE_FROM_PROTO: Record<AuthV1InvitationState, InvitationState> = {
  INVITATION_STATE_UNSPECIFIED: "pending",
  INVITATION_STATE_PENDING: "pending",
  INVITATION_STATE_ACCEPTED: "accepted",
  INVITATION_STATE_DECLINED: "declined",
  INVITATION_STATE_REVOKED: "revoked",
  INVITATION_STATE_EXPIRED: "expired",
};

export const INVITATION_STATE_TO_PROTO: Record<InvitationState, AuthV1InvitationState> = {
  pending: "INVITATION_STATE_PENDING",
  accepted: "INVITATION_STATE_ACCEPTED",
  declined: "INVITATION_STATE_DECLINED",
  revoked: "INVITATION_STATE_REVOKED",
  expired: "INVITATION_STATE_EXPIRED",
};

export const ROLE_TO_PROTO: Record<AssignableRole, AuthV1MembershipRole> = {
  admin: "MEMBERSHIP_ROLE_ADMIN",
  member: "MEMBERSHIP_ROLE_MEMBER",
};

export function toRole(role?: AuthV1MembershipRole): MembershipRole {
  return ROLE_FROM_PROTO[role ?? "MEMBERSHIP_ROLE_UNSPECIFIED"];
}

export function toState(state?: AuthV1MembershipState): MembershipState {
  return STATE_FROM_PROTO[state ?? "MEMBERSHIP_STATE_UNSPECIFIED"];
}

export function toMembership(m: AuthV1Membership): Membership {
  return {
    id: m.id ?? "",
    user_id: m.user_id ?? "",
    org_id: m.org_id ?? "",
    role: toRole(m.role),
    state: toState(m.state),
    joined_at: m.joined_at ?? undefined,
    organization: toOrganization(m.organization),
  };
}

const toInvitationState = (state?: AuthV1InvitationState): InvitationState =>
  INVITATION_STATE_FROM_PROTO[state ?? "INVITATION_STATE_UNSPECIFIED"];

export function toInvitation(i: AuthV1Invitation): Invitation {
  return {
    id: i.id ?? "",
    organization: toOrganization(i.org),
    email: i.email ?? "",
    role: toRole(i.role),
    state: toInvitationState(i.state),
    invited_by: i.invited_by ? {id: i.invited_by.id ?? "", display_name: i.invited_by.display_name ?? ""} : undefined,
    created_at: i.created_at ?? undefined,
    last_sent_at: i.last_sent_at ?? undefined,
    resend_available_at: i.resend_available_at ?? undefined,
    expires_at: i.expires_at ?? undefined,
  };
}

// Both invitation lists answer with this shape.
export function toInvitationList(data: AuthV1ListMyInvitationsResponse): InvitationList {
  return {
    invitations: (data.invitations ?? []).map(toInvitation),
    next_page_token: data.next_page_token ?? "",
  };
}

export function toInvitationLookup(data: AuthV1LookupInvitationResponse): InvitationLookup {
  const state = toInvitationState(data.state);
  return {
    state,
    org_name: data.org_name ?? "",
    org_image_id: data.org_image_id ?? "",
    // A closed invitation has no role, which toRole() would read as member.
    role: state === "pending" ? toRole(data.role) : undefined,
    inviter_display_name: data.inviter_display_name ?? "",
    email: data.email ?? "",
    expires_at: data.expires_at ?? undefined,
  };
}

export function toMember(m: AuthV1OrgMember): Member {
  return {
    id: m.id ?? "",
    user_id: m.user_id ?? "",
    org_id: m.org_id ?? "",
    role: toRole(m.role),
    state: toState(m.state),
    joined_at: m.joined_at ?? undefined,
    username: m.username ?? "",
    first_name: m.first_name ?? "",
    last_name: m.last_name ?? "",
  };
}
