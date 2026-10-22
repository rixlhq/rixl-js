import * as v from "valibot";
import {DomainSchema} from "./base";

/**
 * Add domain request schema
 */
export const AddDomainSchema = /* @__PURE__ */ v.object({
  domain: DomainSchema,
});

/**
 * Update auto-join setting schema
 */
export const UpdateAutoJoinSchema = /* @__PURE__ */ v.object({
  enabled: /* @__PURE__ */ v.boolean("Auto-join setting must be a boolean"),
});
