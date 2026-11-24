## Why

The RIXL API models fine-grained access: `auth.v1.Policy` bundles permission strings, attached to identities via `PolicyAttachment`. Consumers of `@rixl/sdk` — the dashboard, the iframe, rixl-ui — cannot use any of it, because the SDK never surfaces **"what may the current user do?"**.

The data is already being fetched and then thrown away. `GET /auth/v1/userinfo` returns `auth.v1.UserInfo`, which carries both `policies: Policy[]` and `permissions: string[]` scoped to the caller's active organization. The SDK's `getUserInfo` wrapper hand-maps ten fields and **silently discards both**. The dashboard already calls it on every boot (`organization-store.ts` → `organizationService.fetchUserInfo()`), so the round trip happens today and the answer is dropped on the floor.

There is also no permissions store. The SDK exposes atoms for `isLogged`, `user`, `requiresAction` and `authError`, but nothing holds permissions — so each consumer would have to resolve them independently, and each would get the verb-hierarchy rules subtly different.

## What Changes

- **Stop discarding `policies` and `permissions`** in the `UserInfo` mapper (`src/auth/user.ts`). Both become required fields on the `UserInfo` interface, defaulting to `[]`.
- **Add a `permissions` store** (`src/auth/permissionStore.ts`): a `shared()` nanostore atom holding the current identity's effective permission set, following the `userStore` pattern. Empty until resolved, so an unresolved set never reads as permissive.
- **Add `resolvePermissions()`** (`src/auth/permissions/resolve.ts`): calls `getUserInfo()` and replaces the held set. Kept in its own module because `getUserInfo`'s import graph reaches back into `authStore`, and importing it from the store module would create an initialization cycle.
- **Add `hasPermission(required)`**: matches a required permission against the held set, honoring the verb hierarchy. Reconciled against the live registry, which grants only `read` and `write`: `write` satisfies a `read` check, and any verb not listed fails closed.
- **Add `clearPermissions()`**, called from `removeTokens()` so a signed-out user cannot retain a stale set.
- **Export** the permission surface from `src/index.ts`.

Out of scope: any UI gating (that lives in the dashboard's `add-permission-gating`), and role/policy composition — see Assumptions.

## Assumptions

- **`getUserInfo` is the authoritative source.** Confirmed against the spec: `auth.v1.UserInfo` carries `policies` and `permissions`. `ListUserPolicies` remains the endpoint for viewing _another_ member's policies (the admin screen already uses it that way) and is not used for self-resolution.
- **The response is scoped to the active organization.** `UserInfo` returns `active_org_id` alongside the permissions, so consumers must re-resolve after an organization switch. This change provides the function; calling it at the right moments is the consumer's responsibility.
- **Permission grammar is `service:resource:action`.** Confirmed against the live registry: 27 permissions across `org`, `media`, `project`, `analytics`, `billing` and `credentials`, with only `read` and `write` as verbs. `matches` still splits on the **last** `:` only, so a longer grammar would resolve correctly if the registry ever changes shape.
- **`auth.v1.ResolveIdentityPermissions` is not used.** Its request/response schemas exist but no path exposes them, so no client is generated. If it is routed later it can replace the `getUserInfo` call inside `resolvePermissions` without changing any exported contract.
- **Roles are not resolved into the permission set.** If the backend confirms `OWNER`/`ADMIN` are flattened into the returned permissions, consumers can drop their separate role checks; this change neither requires nor prevents that.

## Impact

- **New code**: `src/auth/permissionStore.ts`, `src/auth/permissions/matcher.ts`, `src/auth/permissions/resolve.ts`, and tests under `src/__tests__/permissions/`.
- **Modified code**: `src/auth/user.ts` (`UserInfo` gains `policies` and `permissions`), `src/auth/authStore.ts` (clear on token removal), `src/auth/index.ts` and `src/index.ts` (exports).
- **Dependencies**: none added.
- **API surface consumed**: `auth.v1.UserService.GetUserInfo` — already called, no new request.
- **Breaking change**: `UserInfo` gains two required fields. Any consumer constructing a `UserInfo` literal (test fixtures, mocks) must supply them; consumers only _reading_ the type are unaffected. Warrants a minor bump.
- **Consumers**: unblocks the dashboard's `add-permission-gating`. Symlinked consumers resolve `dist/`, so `bun run build` is required before they see the new exports.
