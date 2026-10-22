import * as v from "valibot";
import {UsernameSchema, NameSchema} from "./base";

/**
 * Update username request schema
 */
export const UpdateUsernameSchema = /* @__PURE__ */ v.object({
  username: UsernameSchema,
});

/**
 * Update name request schema
 */
export const UpdateNameSchema = /* @__PURE__ */ v.object({
  full_name: NameSchema,
});
