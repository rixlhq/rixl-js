// Membership role and state types
export enum MembershipRole {
  OWNER = "owner",
  ADMIN = "admin",
  MEMBER = "member",
}

export type AssignableRole = MembershipRole.ADMIN | MembershipRole.MEMBER;

export enum MembershipState {
  ACCEPTED = "accepted",
  PENDING = "pending",
  DECLINED = "declined",
  ACCEPT = "accept",
  DECLINE = "decline",
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
  organization_username: string;
  organization_first_name: string;
  organization_last_name: string;
}

export interface Member extends Common {
  username: string;
  first_name: string;
  last_name: string;
  invitation_expires_at?: string;
}

export interface MembershipApplication extends Common {
  organization_username: string;
  organization_first_name: string;
  organization_last_name: string;
  created_at?: string;
  decided_at?: string;
  invitation_expires_at?: string;
}

// Invite member request
export interface InviteMemberRequest {
  username: string;
  role: AssignableRole;
}

// Resend Invite member request
export interface ResendInviteMemberRequest {
  user_id: string;
}

// Update member role request
export interface UpdateMemberRoleRequest {
  role: AssignableRole;
}
