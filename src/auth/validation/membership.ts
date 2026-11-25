import * as v from "valibot";

/**
 * Membership management schemas
 */
export const UpdateMemberRoleSchema = v.object({
  role: v.union([v.literal("admin"), v.literal("member")]),
});
