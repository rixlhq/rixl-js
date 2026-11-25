# Proposal

## Why

auth-api splits organizations from users (`separate-organizations-from-users`). An access token now carries one org, and the client names that org on every refresh:

- Sign-in issues an access token for the user's personal org and returns `last_active_org_id` as a hint.
- Refresh requires `org_id`. An org the user can't act in fails with PERMISSION_DENIED and an `ErrorInfo` reason: `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER`. The refresh token stays valid and is not rotated.
- `UpdateActiveMembership`, `UpdateOrgName` and `UpdateOrgUsername` are removed. Orgs have their own `OrganizationService`.
- The access token has no `pms` claim. `role` is a display hint. It carries `sign_in_id` (auth-api `rename-sessions-to-sign-ins`).
- Login challenges use `challenge_id`.
- The cutover revokes every token, so every user signs in again.

The SDK today refreshes without an org (`src/auth/api/refresh-tokens.ts`), keeps the access token in a cookie every tab shares (`src/auth/authStore.ts`, `accessToken` atom with `setStoreCookie`), switches org through `updateActiveMembership` (`src/auth/membership/manage.ts`), and treats any 403 from refresh as a rejected refresh token that signs the user out (`isRejectedRefresh`). None of that fits.

## What Changes

- **Tab-local org context.** Each tab holds its own org and its own access token for it. The refresh token stays shared across tabs, and refresh and reissue share the rotation lock.
- **Refresh names the org.** `getToken()` refreshes into the tab's org. `selectOrganization(orgId)` replaces `updateActiveMembership(orgId)`: it refreshes into `orgId` and resolves with the tab on that org.
- **Typed org errors.** A refresh into an unavailable org rejects with `OrgAccessError` carrying the reason and org ID. A refused switch keeps the previous org. A refusal of the current org clears it on removal or deletion. Suspension keeps the org and clears permissions. All three reasons keep the user signed in.
- **Sign-in hint.** The sign-in response's `last_active_org_id` is exposed as a hint. The SDK doesn't act on it.
- **Claims.** `User` loses `org_id`. A per-tab `orgContext` holds `orgId` and `role` (display only). No `pms` handling.
- **Regenerated client.** Org resources, membership routes under `/auth/v1/organizations/{org_id}`, invitation and sign-in routes. Wrappers for `updateOrgName` and `updateOrgUsername` are removed in favour of `updateOrganization` with a field mask. Wrappers for the org lifecycle operations are pending (task 2.10).
- **Contract follow-through.** Domain auto-join becomes a join suggestion (`updateSuggestJoin`, `suggest_join`), memberships carry an `organization` summary, `updateMemberRole` uses `UpdateMember`, suspended memberships are reported as suspended, and `UserInfo.active_org_id` becomes `last_active_org_id`.
- **Email invitations.** Invitations are addressed to an email, not a username. `inviteMember`, `resendMemberInvite`, `listPendingMemberships` and `publicRespondToInvitation` move to the invitation routes; `listMyInvitations`, `listOrganizationInvitations`, `lookupInvitation`, `revokeInvitation` and `respondToMyInvitation` are new. Answering needs a signed-in user; looking up a link doesn't. The cross-org `respondToInvitation(orgId)` wrapper is removed.
- **No "session" names.** `challenge_id` replaces `session_id` in the passkey and TOTP login functions and types. The SDK's other "session" names are renamed on their own branch, `feat/rename-session-names` (change `remove-session-names`).
- **No legacy handling.** There is no fallback org and no support for the removed switch.

## Capabilities

### New Capabilities

- `org-token-context`: how the SDK chooses, refreshes and reports the org of the access token per tab.
- `auth-naming`: the SDK's auth names and messages use tokens, sign-ins and login challenges, never sessions.

### Modified Capabilities

None (rixl-js has no archived specs yet).

## Non-goals

- No dashboard UI. That's the dashboard change `adopt-organization-context`.
- No automatic move to another org, and no retry into the personal org on the consumer's behalf.
- No compatibility with tokens issued before the auth cutover or with auth-api releases that still have `UpdateActiveMembership`.
- Browser and protocol names stay: `sessionStorage`, the OAuth `session_state` callback parameter.

## Impact

- **Breaking** (`feat(auth)!`). It removes `updateActiveMembership`, `updateOrgName`, `updateOrgUsername`, `respondToInvitation` and `User.org_id`, makes `publicRespondToInvitation` need a signed-in user, renames the `session_id` parameters and fields to `challenge_id`, renames the domain auto-join API to the join suggestion API, replaces the `organization_*` membership fields with `organization`, renames `UserInfo.active_org_id` to `last_active_org_id`, makes `logout()` return a revocation result,, separates signup and email-change verification, requires a verification ID to resend signup verification, removes `RegisterResponse.user_id` from the wrapper, makes `inviteMember` take an email and `resendMemberInvite` an invitation ID, drops `MembershipApplication.user_id` and `decided_at`, `Member.invitation_expires_at`, `ResendInviteMemberRequest` and `VerifyStatusResponse.verified`, and removes `show_deleted` from the organization list wrapper until lifecycle support lands.
- Changes `src/auth/authStore.ts`, `src/auth/api/refresh-tokens.ts`, `src/auth/membership/manage.ts`, `src/auth/organization.ts`, `src/auth/utils/jwt.ts`, `src/auth/types.ts`, `src/auth/passkey.ts`, `src/auth/auth/login.ts`, `src/auth/auth/types.ts`, `src/auth/validation/auth.ts`, `src/auth/logout-channel.ts`, `src/auth/permissionStore.ts`, `src/index.ts`, `src/auth/index.ts` and `src/generated/*` (regenerated).
- Depends on the auth-api changes `separate-organizations-from-users` and `rename-sessions-to-sign-ins` being published in `rixlhq/openapi`. Also depends on the gateway passing the `ErrorInfo` reason through in its error body (design.md, "Reasons reach the SDK through the gateway error body").
- Consumers: dashboard `adopt-organization-context` and `add-signed-in-devices`, internal-dashboard, blog-posts.
