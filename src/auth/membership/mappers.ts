import type {
  AuthV1Membership,
  AuthV1MembershipApplication,
  AuthV1MembershipApplicationState,
  AuthV1OrgMember,
  AuthV1MembershipRole,
  AuthV1MembershipState,
} from "../../generated/types.gen";
import {toOrganization} from "../organization-mappers";
import {MembershipRole, MembershipState, type Membership, type Member, type MembershipApplication} from "./types";

const ROLE_FROM_PROTO: Record<AuthV1MembershipRole, MembershipRole> = {
  MEMBERSHIP_ROLE_UNSPECIFIED: MembershipRole.MEMBER,
  MEMBERSHIP_ROLE_OWNER: MembershipRole.OWNER,
  MEMBERSHIP_ROLE_ADMIN: MembershipRole.ADMIN,
  MEMBERSHIP_ROLE_MEMBER: MembershipRole.MEMBER,
};

const STATE_FROM_PROTO: Record<AuthV1MembershipState, MembershipState> = {
  MEMBERSHIP_STATE_UNSPECIFIED: MembershipState.PENDING,
  MEMBERSHIP_STATE_ACTIVE: MembershipState.ACCEPTED,
  MEMBERSHIP_STATE_SUSPENDED: MembershipState.SUSPENDED,
};

const APPLICATION_STATE_FROM_PROTO: Record<AuthV1MembershipApplicationState, MembershipState> = {
  MEMBERSHIP_APPLICATION_STATE_UNSPECIFIED: MembershipState.PENDING,
  MEMBERSHIP_APPLICATION_STATE_PENDING: MembershipState.PENDING,
  MEMBERSHIP_APPLICATION_STATE_APPROVED: MembershipState.ACCEPTED,
  MEMBERSHIP_APPLICATION_STATE_DECLINED: MembershipState.DECLINED,
  MEMBERSHIP_APPLICATION_STATE_CANCELLED: MembershipState.DECLINED,
};

export function toRole(role?: AuthV1MembershipRole): MembershipRole {
  return ROLE_FROM_PROTO[role ?? "MEMBERSHIP_ROLE_UNSPECIFIED"];
}

export function toState(state?: AuthV1MembershipState): MembershipState {
  return STATE_FROM_PROTO[state ?? "MEMBERSHIP_STATE_UNSPECIFIED"];
}

function toApplicationState(state?: AuthV1MembershipApplicationState): MembershipState {
  return APPLICATION_STATE_FROM_PROTO[state ?? "MEMBERSHIP_APPLICATION_STATE_UNSPECIFIED"];
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

export function toMembershipApplication(m: AuthV1MembershipApplication): MembershipApplication {
  return {
    id: m.id ?? "",
    user_id: m.user_id ?? "",
    org_id: m.org_id ?? "",
    role: toRole(m.role),
    state: toApplicationState(m.state),
    organization: toOrganization(m.organization),
    created_at: m.created_at ?? undefined,
    decided_at: m.decided_at ?? undefined,
    invitation_expires_at: m.invitation_expires_at ?? undefined,
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
    invitation_expires_at: m.invitation_expires_at ?? undefined,
  };
}
