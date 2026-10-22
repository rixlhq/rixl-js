import * as v from "valibot";
import {UsernameSchema, NameSchema} from "./base";

/**
 * Update username request schema
 */
export const UpdateUsernameSchema = v.object({
  username: UsernameSchema,
});

/**
 * Update name request schema
 */
export const UpdateNameSchema = v.object({
  full_name: NameSchema,
});
