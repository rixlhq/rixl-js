import * as v from "valibot";
import {UsernameSchema} from "./base";

/**
 * Membership state schemas
 */
export const AcceptDeclineMembershipSchema = v.object({
  state: v.union([v.literal("accepted"), v.literal("declined")]),
});

export const PublicInviteResponseSchema = v.object({
  state: v.union([v.literal("accept"), v.literal("decline")]),
});

/**
 * Membership management schemas
 */
export const InviteMemberSchema = v.object({
  username: UsernameSchema,
  role: v.union([v.literal("admin"), v.literal("member")]),
});

export const UpdateMemberRoleSchema = v.object({
  role: v.union([v.literal("admin"), v.literal("member")]),
});

export const ResendInviteSchema = v.object({
  user_id: v.pipe(v.string("User ID must be text"), v.minLength(1, "User ID is required")),
});
