import {getUserInfo} from "../user";
import {adoptStoredRefreshToken} from "../stored-sign-in";
import {permissions, permissionsResolved} from "../permissionStore";
import {permissionEpoch, retirePermissionEpoch} from "./epoch";

/** An `ensurePermissions` call already in flight, so concurrent guards share one request. */
let pending: Promise<void> | null = null;

/** The scope `pending` was issued under; once retired, its answer is worthless. */
let pendingEpoch = 0;

/**
 * Invalidates any resolution already in flight.
 *
 * Call before switching the active organization: without it, a request issued
 * for the previous organization can land afterwards and repopulate the store
 * with permissions the user no longer holds. Sign-out needs no such call —
 * `clearPermissions` retires the scope itself.
 */
export const invalidatePermissions = (): void => {
  retirePermissionEpoch();
  pending = null;
};

/**
 * Loads the effective permissions for the signed-in user.
 *
 * `GET /auth/v1/userinfo` is the authoritative source: it returns the
 * permissions and the policies granting them, scoped to the org of this tab's
 * access token. Call this after sign-in and again after selectOrganization(),
 * which empties the set.
 *
 * Always issues a fresh request — it is the caller's way of saying the answer
 * may have changed. On failure the error propagates and the held set is left
 * untouched, so a transient network error does not revoke the interface; a
 * caller changing scope should clear the set first so a failure denies rather
 * than keeps stale grants.
 */
export const resolvePermissions = async (): Promise<void> => {
  // Before the scope is read: found later, by the request's own token lookup,
  // another tab's sign-in would retire the scope and drop the answer for it.
  adoptStoredRefreshToken();
  const started = permissionEpoch();
  const info = await getUserInfo();

  // A switch or a sign-out happened while this was in flight; its answer is for
  // the old scope.
  if (started !== permissionEpoch()) return;

  permissions.set(new Set(info.permissions));
  permissionsResolved.set(true);
};

/**
 * Resolves permissions unless they already have been for the tab's
 * organization.
 *
 * Route guards need an answer before deciding whether to redirect, but must not
 * pay for a request on every navigation. Use `resolvePermissions` when the
 * answer must be refreshed — after an organization switch — and this when any
 * current answer will do.
 */
export const ensurePermissions = async (): Promise<void> => {
  // Empties the set if another tab has signed in since it was resolved.
  adoptStoredRefreshToken();
  if (permissionsResolved.get()) return;

  // A request issued under a retired scope will discard its own answer, so
  // joining it would leave the caller with nothing resolved.
  const started = permissionEpoch();
  if (pending && pendingEpoch === started) return pending;

  pendingEpoch = started;
  const request: Promise<void> = resolvePermissions().finally(() => {
    // Only if a newer request has not already taken the slot.
    if (pending === request) pending = null;
  });
  pending = request;

  return request;
};
