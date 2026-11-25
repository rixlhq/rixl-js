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

- **Chosen:** Keep the refresh token in the shared cookie. Hold the access token, its expiry and the tab's org in memory per tab. `sessionStorage` keeps the tab's org ID so a reload stays on it, with the sign-in it belongs to and, if the tab lost its org, that refusal. A reload refreshes into that org.
- **Alternatives considered:** Keeping the access token in the shared cookie lost because two tabs on different orgs would overwrite each other's token. Per-org cookies lost because cookie size and count grow with orgs, and a tab still needs to know which one is its own.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Refresh names the org", two-tab scenario.

### Other tabs adopt the rotated refresh token, never another tab's access token

- **Chosen:** Rename `adoptStoredSession` to `adoptStoredRefreshToken`. It takes the newer refresh token from the cookie and drops this tab's access token only when its expiry has passed. It never takes the other tab's access token. Refresh stays under the cross-tab lock. A refresh that fails while another tab rotated the token is retried once with the newer one.
- **Alternatives considered:** Adopting both tokens, as today, lost because the stored access token can be for another org.
- **Dropped:** None.
- **Evidence:** `src/auth/authStore.ts`, `adoptStoredSession` and its `scopeOf` permission reset.

### Tab state belongs to one sign-in

- **Chosen:** A `signIn` cookie, `userId:signInId` from the access token's `id` and `sign_in_id` claims, created by an interactive sign-in and renewed on rotation. Each tab records the marker its state belongs to in `sessionStorage`. `adoptStoredRefreshToken` runs before anything the tab holds is used (`getToken`, `selectOrganization`, `ensurePermissions`, `logout`), and on a different marker drops the tab's access token, org, lost org, user, permissions and sign-in hint. Both refresh and reissue match the returned token's sign-in to the request and to the browser's current sign-in before writing, with the one exception in "A refused refresh token ends the stored sign-in". They adopt the access token only if it names the requested org and the tab's org has stayed the same. An explicit switch can also land after an overlapping removal or deletion refusal clears the org it is leaving. Response rejection identifies a changed sign-in, a changed tab org or an unexpected token with an `ApiError`. A tab that has read its sign-in cookie, also on the first adoption after loading signed out, treats its disappearance as sign-out even if it missed the broadcast.
- **Alternatives considered:** Comparing user IDs lost: a second sign-in of the same user is a different token family with its own org choice. Broadcasting sign-ins to other tabs lost as the mechanism: a frozen or reloaded tab never hears them.
- **Dropped:** "A new tab or reload keeps whatever `sessionStorage` holds": it applied one account's org, and refusal, to the next.
- **Evidence:** Level 3 review round 1, finding F2. auth-api `Reissue` (connecting a provider, confirming TOTP) keeps the sign-in ID; `VerifyEmail` for a pending signup starts a new sign-in on the personal org (`internal/auth/email/service/service.go`, `tokens.Generate`).

### Subscribers hear of a change only when it is complete

- **Chosen:** One `commit()` helper (`src/auth/store-commit.ts`) runs each change that touches several stores in nanostores' `batch`: the interactive sign-in (`persistSignInTokens`, which password, TOTP, passkey, OAuth exchange and email verification all use), a rotation (`setTokens`), taking up the stored sign-in, sign-out, a refused refresh and an org refusal. The cookies are written inside the change, so they are complete when the first subscriber runs. The `batch` function is shared like the stores, so a second bundled copy holds their notifications back too.
- **Alternatives considered:** Writing the refresh cookie first lost: the clears in `beginSignIn` still notified before any new cookie existed. Reordering each writer lost because every new store or cookie would need the same care.
- **Dropped:** "`adoptTokenOrg` runs first, so whoever hears of the new access token already sees its org": a commit gives that without an order.
- **Evidence:** Level 3 review round 3, finding R1. nanostores 1.5.5 `atom/index.js`, `batch`.

### Refresh always names the org

- **Chosen:** `getToken()` sends the tab's org as `org_id`. `selectOrganization(orgId)` refreshes into `orgId` under the lock and commits the tab's org only on success. A tab with no org yet uses the org of the token sign-in returned, which is the personal org. That org ID is kept in a cookie next to the refresh token (`personalOrgId`), so a new tab has it. Only an interactive sign-in writes it: connecting a provider and confirming TOTP reissue tokens for the caller's current org, and must not change it. Refresh and reissue use the same cross-tab lock and the same in-tab queue. Reissue resolves its bearer before taking the lock, then supplies it explicitly so the interceptor does not wait for a refresh behind that lock.
- **Alternatives considered:** Keeping `updateActiveMembership` as a wrapper lost because the endpoint is removed and its server-side state is what the new contract drops.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Refresh names the org" and "Sign-in issues the personal org". In auth-api `rixl/remove-legacy` at `858419ac`, `internal/signins/sign_ins.go:253–271`, `Reissue` calls the same `renew` path as refresh and atomically replaces the refresh-token hash.

### A refresh token with no org to name is a dead sign-in

- **Chosen:** Write the sign-in's cookies (`personalOrgId`, `isLogged`) every time the refresh token is stored. A nanostores subscription writes only on a change, so on its own they would expire 30 days after sign-in while rotation keeps renewing the refresh token. A refresh token with no tab org, lost org or sign-in org ends the sign-in in every tab. `removeTokens()` also deletes the `accessToken` and `expireAt` cookies earlier releases wrote.
- **Alternatives considered:** Rejecting with an error lost: no request is ever sent, so the revoked token is never reported dead and the browser stays "logged in" with no way out. Refreshing without an org, or picking one, lost: auth requires the org and the SDK never chooses it.
- **Dropped:** The plain "No organization to refresh into" error.
- **Evidence:** Level 3 review round 1, finding F1 (cutover cookies, and a sign-in on day 35).

### An org refusal is a typed error, not a sign-out

- **Chosen:** A 403 from refresh whose reason is `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER` becomes `OrgAccessError` (`reason`, `orgId`, extends `ApiError`). It keeps every token. A refused `selectOrganization` keeps the tab's previous org. A refused refresh into the tab's own org clears the stored org only for `NOT_A_MEMBER` or `ORG_DELETED`, so the consumer must select one; after `MEMBERSHIP_SUSPENDED` the tab keeps its org, because the membership can be restored. All three empty `orgContext`: it describes the tab's access token, a refused tab has none, and a reload during a suspension couldn't rebuild it. `orgRefusal` names the org. Only a refresh answered 401 clears tokens. auth-api answers 401 (`Unauthenticated`) for a dead refresh token or an inactive account (`internal/auth/service/mappers.go`, `grpcutil.TokenErr`); 400 is an invalid request, and a 403 without an org reason says nothing about the token, so both reach the caller and keep the sign-in. An unknown org ID is refused with `NOT_A_MEMBER`.
- **Alternatives considered:** Retrying into the personal org lost because auth removed that fallback on purpose: the consumer decides what to show. Signing out lost because the refresh token stays valid.
- **Dropped:** None.
- **Also:** A tab that lost its org gets no token, so it can't call `listOrganizations()`, although the gateway lets any user token list them: it first calls `selectOrganization(personalOrgId)`. So does a suspended tab that wants to offer another org. The SDK records the tab's current-org refusal in `sessionStorage` and exposes it in the read-only `orgRefusal` store. A removal or deletion stays visible across reloads and prevents a refresh into the personal org. A suspension keeps the stored org and clears its permissions. The public store is undefined while signed out. A final refresh 401 preserves the internal refusal during the rotation recovery window. A successful access token, a new sign-in (including limited access) or explicit logout clears it. `OrgAccessError` also passes through the wrappers' status maps unchanged, so a 403 map doesn't replace the reason with an endpoint's message. Only explicit `logout()` announces sign-out. A 401 is settled as in "A refused refresh token ends the stored sign-in".
- **Evidence:** auth-api `token-org-context/spec.md`, "A refresh into an org the user can't act in fails". `src/auth/refresh-rotation.ts`, `isRejectedRefresh`.

### A refused refresh token ends the stored sign-in

- **Chosen:** After a 401 the tab waits 1 second, takes up whatever is stored, and retries once with a newer token on a failed request. Applying a successful response is outside that retry path. A refusal that nothing explains clears the tab's tokens. While the stored refresh token is still the one sent, it also removes the refresh, `signIn`, `personalOrgId` and `isLogged` cookies, so a reload starts signed out. It runs inside the refresh queue and, where the tab holds it, the cross-tab lock. Nothing is announced. A `refusedSignIn` cookie then names the sign-in for one minute. A successful rotation of it that is still on its way, in a browser without Web Locks or after a lock wait timed out, stores its tokens, because it proves the sign-in alive. A reload during this window preserves the stored org and refusal when the recovery marker matches the tab binding. Only a newer usable token makes the public refusal visible again. Logout and a new sign-in delete the cookie.
- **Alternatives considered:** Keeping the cookies lost: every later load looked signed in, sent the dead token again and rejected `connect()`, for as long as the cookies lasted. Removing them with no way back lost: where no lock keeps tabs apart, a tab that lost a rotation race would delete the cookies just before the winner returned, and the winner would discard the only live token. Deleting only under the lock lost: a browser without Web Locks would never end a dead sign-in, and a waiter that timed out rotates beside the lock holder. Clearing only `isLogged` lost: the next load would still send the dead token.
- **Dropped:** The memory-only record of the refused token. "A local 401 cannot clear a cookie another tab may be about to rotate."
- **Evidence:** Level 3 review round 3, finding R2. `src/__tests__/auth/shared-sign-in.test.ts`, "A refused refresh token ends the stored sign-in" and "A rejected refresh that may be a rotation race".

### Logout ends the browser sign-in before revocation

- **Chosen:** Read the browser's current sign-in and snapshot its credentials synchronously. Clear its local and tab state, clear shared cookies if they still belong to it, and announce its marker before starting the network request. Markerless logout messages reach markerless tabs, including limited-access flows. Tabs on another marker ignore the message. An in-flight rotation cannot restore a cleared sign-in.
- Send one keepalive revocation with the snapshot and abort after five seconds. Isolate subscriber failures after local cleanup so they cannot suppress the request. The promise resolves with `{revoked: true}` on an acknowledged response, or `{revoked: false}` on failure or timeout. The SDK depends on auth-api revoking the entire sign-in by the access token's `sign_in_id`, because the snapshotted refresh token can already have rotated. When the SDK has no access token, it sends the available refresh token for best-effort revocation.
- Logout owns neither the rotation queue nor its cross-tab lock. A newer sign-in can proceed during the revocation attempt. The local request queue, cross-tab lock and in-flight access-token request are scoped to a sign-in, so a new sign-in also proceeds during a hung refresh for the old one.

### Signup verification and email changes write tokens in their original context

- Signup verification is public and starts a new sign-in. It checks the browser marker, limited-access cookie and local lifecycle generation before committing, so logout or account replacement cancels a pending reply.
- Auth-api #253 separates authenticated email-change verification. It calls `IssueForSignIn` and reissues within the caller’s sign-in and org. The SDK uses the guarded rotation path. A matching limited-access bearer may promote to full access for that same sign-in and org.
- Starting a limited-access flow over a stored full sign-in uses logout’s cleanup, broadcast and bounded revocation for the prior sign-in before storing the limited credential.

### Voluntary leave requires another selection

- After a successful leave of the tab's current org, clear the access token, context and permissions for that org. Record the departure locally in the tab so a reload cannot select the personal org implicitly. Preserve gateway messages for membership management errors. The user remains signed in. `orgSelectionRequired` identifies the state, and `getToken()` resolves undefined until another org is selected. Completing a leave also clears a refusal for that same org that arrived first.

### A refusal can arrive before the next refresh

- **Chosen:** The client's error interceptor turns a 403 with an org reason into `OrgAccessError` when the route needs the token's org and the request carried the tab's token: the tab's sign-in marker, and the org the tab is on or has just lost. Only a refusal of the exact current access token expires it and updates the org state. A response to an older token can still reach its caller as an error. The gateway's account-scoped routes are excluded (`src/auth/api/account-scoped-routes.ts`, a copy of its list): they don't require the token's org, some act on another org, such as accepting an invitation, and the gateway forwards any backend's `ErrorInfo` reason. The next `getToken()` of a suspended tab refreshes, and gets the refusal or, after reinstatement, a token.
- **Alternatives considered:** Leaving it to the next refresh lost: the gateway refuses every org route at once, while the SDK would keep the token, `orgContext` and permissions until it expires, and `selectOrganization` of the same org changes nothing on refusal. Leaving it to consumers lost: no public call drops the tab's org. Keeping a suspended tab's access token lost: `getToken()` would hand out a token the gateway refuses.
- **Dropped:** Reading a reason from any route as one about the token's org.
- **Evidence:** gateway `internal/middleware/authentication.go` (`mayActInOrg`, `WriteJSONErrorReason(…, identity.OrgInactiveReason)`), `internal/routes/account_scoped.go` and `errors.go`. Level 3 review round 1, finding F4, and round 3, finding R3.

### Reasons reach the SDK through the gateway error body

- **Chosen:** The gateway extracts the gRPC `ErrorInfo` reason and writes it as the top-level JSON `reason`. The SDK reads that field from `WireErrorBody`.
- **Alternatives considered:** Matching on the message text lost because it isn't a contract.
- **Dropped:** None.
- **Evidence:** Measured in task 3.1: the body is `{"error", "reason"}` (gateway `internal/routes/errors.go`), and the reason reaches `ApiError.data`.

### The sign-in hint is data, not an action

- **Chosen:** Expose the sign-in response's `last_active_org_id` as `lastActiveOrgId`. The SDK doesn't refresh into it on its own. Also expose `personalOrgId`, the org of the token sign-in returned: a tab that lost its org gets no token from `getToken()`, so it can't list organizations, and needs an org ID it can select.
- **Alternatives considered:** Switching automatically lost because a refusal would then surface during sign-in with no UI context.
- **Dropped:** None.
- **Evidence:** auth-api `token-org-context/spec.md`, "Sign-in issues the personal org".

### Org claims move out of the shared user

- **Chosen:** Remove `org_id` from `User`, which stays a shared profile in `localStorage`. Add a per-tab `orgContext` atom `{orgId, role}` decoded from the tab's access token. `role` is a display hint. Permissions are resolved per tab org, and `clearPermissions()` runs when the tab's user or org changes. The first token of a page load clears nothing: after a reload every first request refreshes, and clearing then would discard a permission request that asked for the token.
- **Alternatives considered:** Keeping `User.org_id` lost because `localStorage` is shared and the org is not.
- **Dropped:** None.
- **Evidence:** `src/auth/userStore.ts` (`localStorage`), auth-api `token-org-context/spec.md`, "Access token claims".

### No "session" in SDK names

- **Chosen:** Rename the passkey and TOTP login `session_id` to `challenge_id`, which follows the regenerated API. The SDK-internal names move to their own change, `remove-session-names` on `feat/rename-session-names`, so this branch carries only the org rework. Browser and protocol names stay.
- **Alternatives considered:** Renaming only the public API lost because internal names keep the wrong model alive in code review and docs.
- **Dropped:** None.
- **Evidence:** auth-api `rename-sessions-to-sign-ins`. `git grep -ni session -- src ':!src/generated'` on `main` at `49067d4`.

### Hand-written wrappers follow the regenerated contract

- **Chosen:** Where the regenerated client changes a shape the SDK wraps, the SDK takes the new shape under the new name, with no alias:
  - Domain auto-join is now a join suggestion: `updateSuggestJoin`, `SuggestJoinSetting`, `UpdateSuggestJoinRequest` and `DomainResponse.suggest_join`.
  - `Membership` and `MembershipApplication` carry an `organization` summary (`Organization`) in place of the three `organization_*` name fields.
  - `updateMemberRole` calls `UpdateMember` with `update_mask: "role"`.
  - A suspended membership maps to `MembershipState.SUSPENDED`; it was reported as pending. The `LEFT` and `REMOVED` wire states no longer exist.
  - `UserInfo.active_org_id` is `last_active_org_id`, which is a hint and not the org of the tab's token.
- **Alternatives considered:** Keeping the old public names over the new wire fields lost because they describe behavior auth no longer has.
- **Dropped:** None.
- **Evidence:** auth-api `proto/auth/v1/domains.proto`, `memberships.proto` and `common.proto` on `rixl/remove-legacy`.

### Invitations are addressed to an email

- **Chosen:** The wrappers follow auth-api's `InvitationService`. Where the new contract allows, a function the dashboard calls keeps its name and arguments: `inviteMember(orgId, email, role)` now takes an email, `resendMemberInvite(orgId, invitationId)` an invitation ID, `publicRespondToInvitation(token, state)` sends the token in the body, and `listPendingMemberships()` shapes a page of the user's invitations as pending memberships. `listMyInvitations`, `listOrganizationInvitations`, `lookupInvitation`, `revokeInvitation` and `respondToMyInvitation` are new. Accepting returns the membership and doesn't switch the tab's org.
- **Alternatives considered:** Renaming the four functions lost because the dashboard calls them and their intent is unchanged. Reusing the name `respondToInvitation` for answering by ID lost: it used to take an org ID, and both are strings.
- **Dropped:** `MembershipApplication.user_id` and `decided_at`, `Member.invitation_expires_at`, `ResendInviteMemberRequest` and `VerifyStatusResponse.verified`: the contract no longer carries them. No `request_id` option on `inviteMember`, which would be a fourth parameter with no caller.
- **Evidence:** auth-api `proto/auth/v1/invitations.proto` and `internal/invitations` at `92d208bd`; gateway `internal/routes/account_scoped.go` and `errors.go` at `c0a8891`.

### No legacy path

- **Chosen:** No fallback org, no `org_fallback_reason`, no support for refresh without an org or for the removed switch.
- **Alternatives considered:** A transition release supporting both contracts lost because the auth cutover revokes every token and ships every service together.
- **Dropped:** None.
- **Evidence:** auth-api `separate-organizations-from-users/design.md`, migration plan.

## Risks / Trade-offs

- **[Risk]** A reload costs a refresh, which rotates the shared refresh token. → Rotation stays under the cross-tab lock. Tabs adopt the newer refresh token before and after their own refresh.
- **[Risk]** Two tabs can spend the same refresh token where nothing keeps them apart: a browser without Web Locks, or after a tab stops waiting for a hung lock holder after 10 seconds. auth-api answers the loser 401 and keeps the sign-in (`internal/signins`, rotation doesn't revoke on reuse). → The loser waits 1 second for the winner to store its token, adopts it and retries once. If no newer token has arrived by then, the loser clears its local tokens, keeps its org and takes the refused sign-in out of the cookies. The winner, answered within a minute, stores them again, and the loser adopts its token on its next call. In between, a page that loads sees a signed-out browser, and a request slower than that minute loses the sign-in.
- **[Risk]** A waiter can time out during a later lock holder's turn and rotate beside it. → The same one-minute window covers it. A revoked or expired sign-in ends in the cookies with the first refused refresh. Each open tab drops its own tokens on its next refresh, or once the minute has passed. Only explicit logout broadcasts.
