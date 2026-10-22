import * as v from "valibot";
import {UsernameSchema} from "./base";

/**
 * Membership state schemas
 */
export const AcceptDeclineMembershipSchema = /* @__PURE__ */ v.object({
  state: /* @__PURE__ */ v.union([/* @__PURE__ */ v.literal("accepted"), /* @__PURE__ */ v.literal("declined")]),
});

export const PublicInviteResponseSchema = /* @__PURE__ */ v.object({
  state: /* @__PURE__ */ v.union([/* @__PURE__ */ v.literal("accept"), /* @__PURE__ */ v.literal("decline")]),
});

/**
 * Membership management schemas
 */
export const InviteMemberSchema = /* @__PURE__ */ v.object({
  username: UsernameSchema,
  role: /* @__PURE__ */ v.union([/* @__PURE__ */ v.literal("admin"), /* @__PURE__ */ v.literal("member")]),
});

export const UpdateMemberRoleSchema = /* @__PURE__ */ v.object({
  role: /* @__PURE__ */ v.union([/* @__PURE__ */ v.literal("admin"), /* @__PURE__ */ v.literal("member")]),
});

export const ResendInviteSchema = /* @__PURE__ */ v.object({
  user_id: /* @__PURE__ */ v.pipe(/* @__PURE__ */ v.string("User ID must be text"), /* @__PURE__ */ v.minLength(1, "User ID is required")),
});
