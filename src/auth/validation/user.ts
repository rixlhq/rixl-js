import * as v from "valibot";
import {NameSchema} from "./base";

/**
 * Update name request schema
 */
export const UpdateNameSchema = v.object({
  full_name: NameSchema,
});
