import * as v from "valibot";
import {DomainSchema} from "./base";

/**
 * Add domain request schema
 */
export const AddDomainSchema = v.object({
  domain: DomainSchema,
});

/**
 * Update auto-join setting schema
 */
export const UpdateAutoJoinSchema = v.object({
  enabled: v.boolean("Auto-join setting must be a boolean"),
});
