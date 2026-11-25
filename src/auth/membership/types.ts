import type {Organization} from "../organization-mappers";

// Membership role and state types
export enum MembershipRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export type AssignableRole = MembershipRole.ADMIN | MembershipRole.MEMBER;

export enum MembershipState {
  ACTIVE = "active",
  SUSPENDED = "suspended",
}

interface Common {
  id: string;
  user_id: string;
  org_id: string;
  role: MembershipRole;
  state: MembershipState;
  joined_at?: string;
}

export interface Membership extends Common {
  organization: Organization;
}

export interface Member extends Common {
  username: string;
  first_name: string;
  last_name: string;
}

export type InvitationState = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface Invitation {
  id: string;
  organization: Organization;
  email: string;
  role: MembershipRole;
  /** A pending invitation past its expiry reads as expired. */
  state: InvitationState;
  /** Unset once the inviter's account is deleted. `id` is empty in the recipient's own list. */
  invited_by?: {id: string; display_name: string};
  created_at?: string;
  last_sent_at?: string;
  /** Set while a daily sending limit would delay a resend by the caller. */
  resend_available_at?: string;
  expires_at?: string;
}

export interface InvitationList {
  invitations: Invitation[];
  /** Empty on the last page. */
  next_page_token: string;
}

/** What an emailed link is for. A closed invitation reports only its state, so the rest is empty. */
export interface InvitationLookup {
  state: InvitationState;
  org_name: string;
  org_image_id: string;
  role?: MembershipRole;
  inviter_display_name: string;
  email: string;
  expires_at?: string;
}

export interface InvitationPageParams {
  page_size?: number;
  page_token?: string;
}

export interface ListInvitationsParams extends InvitationPageParams {
  state?: InvitationState;
}
