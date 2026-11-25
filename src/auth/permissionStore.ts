import {atom, type WritableAtom} from "nanostores";
import {shared} from "../shared-runtime";
import {matches} from "./permissions/matcher";
import {retirePermissionEpoch} from "./permissions/epoch";

/**
 * The current identity's effective permissions in this tab's organization.
 *
 * Populated by `resolvePermissions`. Empty until then, so every check denies —
 * an unresolved set must never read as permissive.
 *
 * Resolution lives in `./permissions/resolve` rather than here: it needs
 * `getUserInfo`, whose module graph reaches back into `authStore`, and keeping
 * this module free of that import avoids an initialization cycle.
 */
export const permissions: WritableAtom<ReadonlySet<string>> = shared("permissions", () => atom<ReadonlySet<string>>(new Set()));

/**
 * Whether the set has been resolved at least once for the tab's organization.
 *
 * An empty set is ambiguous on its own: it means both "not loaded yet" and
 * "this user holds nothing". Hiding a control cannot tell them apart and should
 * not try — denying while unresolved is the safe default. A redirect must:
 * bouncing someone out of a page before their permissions arrive would lock
 * them out of the app.
 */
export const permissionsResolved: WritableAtom<boolean> = shared("permissionsResolved", () => atom(false));

/** Whether the held permissions satisfy `required`, honoring the verb hierarchy. */
export const hasPermission = (required: string): boolean => matches(permissions.get(), required);

/**
 * Empties the permission set and marks it unresolved.
 *
 * Called on sign-out so no grant outlives the sign-in, and before an
 * organization switch so the previous organization's grants cannot be read as
 * the new one's while the fresh answer is in flight.
 *
 * Emptying the set is not enough on its own: a resolution issued before the
 * clear can land after it and repopulate the store with the retired scope's
 * grants. Retiring the epoch here makes any such answer be discarded, so
 * sign-out cannot be undone by a request that was already in the air.
 */
export const clearPermissions = (): void => {
  retirePermissionEpoch();
  permissions.set(new Set());
  permissionsResolved.set(false);
};
