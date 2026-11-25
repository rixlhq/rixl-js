import * as v from "valibot";
import {EmailSchema} from "./base";

export const PublicInviteResponseSchema = v.object({
  state: v.union([v.literal("accept"), v.literal("decline")]),
});

export const InvitationTokenSchema = v.pipe(v.string("Invitation token must be text"), v.minLength(1, "Invitation token is required"));

export const InvitationIdSchema = v.pipe(v.string("Invitation ID must be text"), v.minLength(1, "Invitation ID is required"));

/**
 * Membership management schemas
 */
export const InviteMemberSchema = v.object({
  email: v.pipe(v.string("Email must be text"), v.trim(), EmailSchema),
  role: v.union([v.literal("admin"), v.literal("member")]),
});

export const UpdateMemberRoleSchema = v.object({
  role: v.union([v.literal("admin"), v.literal("member")]),
});
