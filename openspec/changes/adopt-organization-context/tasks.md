# Tasks

## 1. Generated client

- [ ] 1.1 Regenerate the client (`vp run generate`) once `rixlhq/openapi` carries the auth-api org split, invitations, lifecycle and `rename-sessions-to-sign-ins`. Verify `src/generated/sdk.gen.ts` has the `OrganizationService` operations, the moved membership routes, the sign-in routes and `challenge_id`, no `UpdateActiveMembership`, `UpdateOrgName` or `UpdateOrgUsername`, and that `vp check` passes. Blocked on publication; record the openapi commit here.

## 2. Org token context

- [ ] 2.1 Move the access token, its expiry and the tab's org to per-tab state, keep the refresh token in the shared cookie, and keep the tab's org ID in `sessionStorage`. Test: `src/__tests__/auth/org-context.test.ts`, "Two tabs on different orgs" and "Reload keeps the tab's org".
- [ ] 2.2 Send `org_id` on every refresh and rename `adoptStoredSession` to `adoptStoredRefreshToken`, which adopts only the refresh token. Test: same file, "Refresh after another tab rotated".
- [ ] 2.3 Add `selectOrganization(orgId)` and remove `updateActiveMembership`. Test: "Switching org".
- [ ] 2.4 Add `OrgAccessError` and exclude org reasons from `isRejectedRefresh`. Test: "Selecting an org that removed the user", "The tab's org is deleted" and "A rejected refresh token still signs out".
- [ ] 2.5 Expose `lastActiveOrgId` from the sign-in response. Test: "Sign-in on a new device".
- [ ] 2.6 Remove `User.org_id`, add `orgContext {orgId, role}`, and scope permissions to the tab's org. Test: "Another tab changes org".
- [ ] 2.7 Replace `updateOrgName` and `updateOrgUsername` with `getOrganization`, `listOrganizations` and `updateOrganization` (field mask over name, slug, image). Add wrappers for the invitation and lifecycle operations the dashboard change uses. Test each wrapper's request shape and error mapping in `src/__tests__/organization/*.test.ts`.

## 3. Errors from the gateway

- [ ] 3.1 Measure the gateway's error body for a PERMISSION_DENIED refresh with an `ErrorInfo` reason against a deployed or local gateway, and record it here. If the reason is missing, open the gateway change and link it. Leave this open until the reason reaches `ApiError.data`.

## 4. Naming

- [ ] 4.1 Rename `session_id` to `challenge_id` in `src/auth/passkey.ts`, `src/auth/auth/login.ts`, `src/auth/auth/types.ts` and `src/auth/validation/auth.ts`, and update `src/__tests__/auth/login.test.ts` and `src/__tests__/auth/passkey-credential.test.ts`. Test: "Two-factor login".

## 5. Integration

- [ ] 5.1 Update the README and examples for `selectOrganization`, `OrgAccessError` and `orgContext`. Run `vp check`, `vp test --run`, `vp pack`, `vp run budget` and `vp run examples:check`, and record the results here.
