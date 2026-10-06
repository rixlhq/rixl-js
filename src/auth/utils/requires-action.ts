import type {LimitedScopeTokenResponse, TokenResponse} from "../types";

/**
 * Whether a token response is limited scope: it names an action the user must
 * take before getting full tokens (e.g. `add_email`). The gateway emits every
 * field, so a full-scope response carries `requires_action: ""` too; only a
 * non-empty value counts.
 */
export const isLimitedScopeTokenResponse = (result: TokenResponse | LimitedScopeTokenResponse): result is LimitedScopeTokenResponse =>
  "requires_action" in result && Boolean(result.requires_action);
