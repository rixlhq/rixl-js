import * as v from "valibot";
import {DomainSchema} from "./base";

/**
 * Add domain request schema
 */
export const AddDomainSchema = v.object({
  domain: DomainSchema,
});

/**
 * Update join suggestion setting schema
 */
export const UpdateSuggestJoinSchema = v.object({
  enabled: v.boolean("Join suggestion setting must be a boolean"),
});
