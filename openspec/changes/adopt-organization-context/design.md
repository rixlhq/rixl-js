# Design

## Context

- `src/auth/authStore.ts` holds `accessToken`, `refreshToken`, `expireAt` and `isLogged` as nanostores mirrored into cookies prefixed `GLOBAL_PREFIX` (`src/auth/cookie/index.ts`, `setStoreCookie`). Every tab reads and writes the same cookies.
- Refresh runs under a Web Lock across tabs (`acrossTabs`, lock `${GLOBAL_PREFIX}_refresh`). Before and after refreshing, a tab adopts tokens another tab stored (`adoptStoredSession`), because the gateway accepts a refresh token once.
- `refreshTokens()` (`src/auth/api/refresh-tokens.ts`) posts to `/auth/v1/token` with `token_type` and `refresh_token`, and no org.
- `isRejectedRefresh` treats 400, 401 and 403 from refresh as a dead refresh token and calls `removeTokens()`.
- `updateActiveMembership(orgId)` (`src/auth/membership/manage.ts`) calls the removed endpoint, clears the access token and calls `getToken()`.
- `decodeToken` (`src/auth/utils/jwt.ts`) maps `org_id` into `User`, which `src/auth/userStore.ts` persists in `localStorage`, shared by every tab.
- `ApiError` carries `status` and the raw error body as `data` (`src/auth/api/types.ts`, `src/auth/api/sdk-client.ts`). The wire body type is `{error?, details?, code?}`.

## Decisions

### Access tokens are tab-local; the refresh token stays shared

- **Chosen:** Keep the refresh token in the shared cookie. Hold the access token, its expiry and the tab's org in memory per tab, and keep only the tab's org ID in `sessionStorage` so a reload stays on it. A reload refreshes into that org.
- **Alternatives considered:** Keeping the access token in the shared cookie lost because two tabs on different orgs would overwrite each other's token. Per-org cookies lost because cookie size and count grow with orgs, and a tab still needs to know which one is its own.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Refresh names the org", two-tab scenario.

### Other tabs adopt the rotated refresh token, never another tab's access token

- **Chosen:** Rename `adoptStoredSession` to `adoptStoredRefreshToken`. It takes the newer refresh token from the cookie and drops this tab's access token only when its expiry has passed. It never takes the other tab's access token. Refresh stays under the cross-tab lock.
- **Alternatives considered:** Adopting both tokens, as today, lost because the stored access token can be for another org.
- **Dropped:** None.
- **Evidence:** `src/auth/authStore.ts`, `adoptStoredSession` and its `scopeOf` permission reset.

### Refresh always names the org

- **Chosen:** `getToken()` sends the tab's org as `org_id`. `selectOrganization(orgId)` refreshes into `orgId` under the lock and commits the tab's org only on success. A tab with no org yet uses the org of the token sign-in returned, which is the personal org.
- **Alternatives considered:** Keeping `updateActiveMembership` as a wrapper lost because the endpoint is removed and its server-side state is what the new contract drops.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Refresh names the org" and "Sign-in issues the personal org".

### An org refusal is a typed error, not a sign-out

- **Chosen:** A 403 from refresh whose reason is `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER` becomes `OrgAccessError` (`reason`, `orgId`, extends `ApiError`). It keeps every token and the tab's previous org. `isRejectedRefresh` excludes it, and only a refresh rejected without an org reason clears tokens.
- **Alternatives considered:** Retrying into the personal org lost because auth removed that fallback on purpose: the consumer decides what to show. Signing out lost because the refresh token stays valid.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "A refresh into an org the user can't act in fails". `src/auth/authStore.ts`, `isRejectedRefresh`.

### Reasons reach the SDK through the gateway error body

- **Chosen:** Read the reason from the `ErrorInfo` detail in the error body and add it to `WireErrorBody`. If the gateway's body doesn't carry it today, a gateway change is required before task 3.1 can close.
- **Alternatives considered:** Matching on the message text lost because it isn't a contract.
- **Dropped:** None.
- **Evidence:** Assumed: the body shape is only known as `{error?, details?, code?}` in `src/auth/api/sdk-client.ts`. Task 3.1 measures it.

### The sign-in hint is data, not an action

- **Chosen:** Expose the sign-in response's `last_active_org_id` as `lastActiveOrgId`. The SDK doesn't refresh into it on its own.
- **Alternatives considered:** Switching automatically lost because a refusal would then surface during sign-in with no UI context.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Sign-in issues the personal org".

### Org claims move out of the shared user

- **Chosen:** Remove `org_id` from `User`, which stays a shared profile in `localStorage`. Add a per-tab `orgContext` atom `{orgId, role}` decoded from the tab's access token. `role` is a display hint. Permissions are resolved per tab org, and `clearPermissions()` runs when the tab's org changes.
- **Alternatives considered:** Keeping `User.org_id` lost because `localStorage` is shared and the org is not.
- **Dropped:** None.
- **Evidence:** `src/auth/userStore.ts` (`localStorage`), auth-api `token-org-context/spec.md`, "Access token claims".

### No "session" in SDK names

- **Chosen:** Rename the passkey and TOTP login `session_id` to `challenge_id`, and the internal names listed in `specs/auth-naming/spec.md`. Browser and protocol names stay.
- **Alternatives considered:** Renaming only the public API lost because internal names keep the wrong model alive in code review and docs.
- **Dropped:** None.
- **Evidence:** auth-api `rename-sessions-to-sign-ins`. `git grep -ni session -- src ':!src/generated'` on `main` at `49067d4`.

### No legacy path

- **Chosen:** No fallback org, no `org_fallback_reason`, no support for refresh without an org or for the removed switch.
- **Alternatives considered:** A transition release supporting both contracts lost because the auth cutover revokes every token and ships every service together.
- **Dropped:** None.
- **Evidence:** auth-api `separate-organizations-from-users/design.md`, migration plan.

## Risks / Trade-offs

- **[Risk]** A reload costs a refresh, which rotates the shared refresh token. → Rotation stays under the cross-tab lock. Tabs adopt the newer refresh token before and after their own refresh.
- **[Risk]** Browsers without Web Locks can still race. → Unchanged from today: the losing tab adopts the newer refresh token and retries once.
