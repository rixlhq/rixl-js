# Tasks

## 1. Generated client

- [x] 1.1 Regenerate the client (`vp run generate`) from the gateway's org-split document, and adapt the hand-written wrappers to it (design.md, "Hand-written wrappers follow the regenerated contract"). Verify `src/generated/sdk.gen.ts` has the `OrganizationService` operations, the moved membership routes, the sign-in routes and `challenge_id`, no `UpdateActiveMembership`, `UpdateOrgName` or `UpdateOrgUsername`, and that `vp check` passes.
  - Source: `rixlhq/gateway` `origin/rixl/remove-legacy` at `345c52452b5bc07e374147790f2cd5ea876806e5`, `docs/swagger.yaml`. `vp run generate` with the generator `input` in `vite.config.ts` pointed at a local copy for that run only, then `vp check --fix`. The committed generator source is unchanged. The `generate` script exits non-zero at its packing step while the hand-written code still names removed operations; the client is written before that step.
  - Measured: the five `authV1OrganizationService*` operations, `authV1MembershipServiceUpdateMember` on `/auth/v1/organizations/{org_id}/members/{user_id}`, `authV1TokenServiceListSignIns`, `RevokeSignIn`, `RevokeOtherSignIns`, `LogoutAll` and `challenge_id` are present; `grep -cE 'UpdateActiveMembership|UpdateOrgName|UpdateOrgUsername' src/generated/*.ts` is 0. The remaining `session_id` fields are analytics events and Stripe Checkout, not auth.
  - The document has no email-invitation (`InvitationService`) or organization lifecycle operations: auth-api `rixl/remove-legacy` has neither proto yet (task 2.8).
- [x] 1.2 After the gateway change merges and `rixlhq/openapi` has copied it, run `vp run generate` against the committed generator source and record the openapi commit here. Include auth-api #249 and #253 wire changes once the gateway publishes them and replace the direct email-change call with the generated operation.
  - Measured on 2026-11-25 against `rixlhq/openapi` `d62ac55b901ed19900179ab9a3f259d465e6e390` (gateway `c0a8891`, auth-api `92d208bd`). `verifyEmailChange` calls `authV1EmailServiceVerifyEmailChange`. The document drops `EmailStatusResponse.verified` (auth-api stores an email only once verified) and `OrgMember.invitation_expires_at`, so the wrappers drop them too.
  - `rixlhq/auth-api#258` renamed the org parameter of the member list, domain, policy and notification routes from `user.org_id` to `org_id` without changing the URLs. Measured on 2026-11-25 against `rixlhq/openapi` `dc93fd7aa98710870673de82093fe18720e3436e`: the regenerated client has the same 228 operations, and `listOrganizationMembers` and two domain wrappers take the new name.

## 2. Org token context

- [x] 2.1 Move the access token, its expiry and the tab's org to per-tab state, keep the refresh token in the shared cookie, and keep the tab's org ID in `sessionStorage`. Test: `src/__tests__/auth/org-context.test.ts`, "Two tabs on different orgs" and "Reload keeps the tab's org".
- [x] 2.2 Send `org_id` on every refresh and rename `adoptStoredSession` to `adoptStoredRefreshToken`, which adopts only the refresh token. Test: same file, "Refresh after another tab rotated".
- [x] 2.3 Add `selectOrganization(orgId)` and remove `updateActiveMembership`. Test: "Switching org".
- [x] 2.4 Add `OrgAccessError` and exclude org reasons from `isRejectedRefresh`. Test: "Selecting an org that removed the user", "The tab's org is deleted" and "A rejected refresh token signs out this tab".
- [x] 2.4a Clear the tab's stored org when a refresh into it is refused with `NOT_A_MEMBER` or `ORG_DELETED`, make `getToken()` reject with that `OrgAccessError` until `selectOrganization` succeeds, and leave a refused `selectOrganization` untouched. Test: "Reload after removal", "Reload after deletion" and "A refused live switch keeps the org".
- [x] 2.5 Expose `lastActiveOrgId` from the sign-in response, and `personalOrgId`, the org of the token sign-in returned (design.md, "The sign-in hint is data, not an action"). Test: "Sign-in on a new device" and "names the personal org, so a tab that lost its org can select it".
- [x] 2.6 Remove `User.org_id`, add `orgContext {orgId, role}`, and scope permissions to the tab's org. Test: "Another tab changes org".
- [x] 2.7 Replace `updateOrgName` and `updateOrgUsername` with `getOrganization`, `listOrganizations` and `updateOrganization` (field mask over name, slug, image). Test each wrapper's request shape and error mapping in `src/__tests__/organization/*.test.ts`.
  - Measured with the gateway's own mux (`routes.NewServeMux`, `rixl/remove-legacy` at `345c524`) in front of a stub gRPC service: `update_mask: "image_id"` is refused with 400 (`google.protobuf.FieldMask.paths contains invalid path: "image_id"`), and `"name,imageId"` reaches the service as `["name", "image_id"]`. The wrapper sends `imageId`.
- [x] 2.8 Add wrappers for the invitation operations the dashboard change uses, with their tests (design.md, "Invitations are addressed to an email"). Tests: `src/__tests__/membership/invite.test.ts` and `list.test.ts`.
  - `listPendingMemberships` reads `GET /auth/v1/users/current/invitations`; auth-api removed `GET /auth/v1/membership-applications`. The account-scoped route list follows gateway `c0a8891`: `invitations/accept`, `invitations/decline` and `POST organizations`. Tests in `api/request-refusal.test.ts`.
  - The gateway forwards an `ErrorInfo` reason but not its metadata, so a 409 `INVITATION_PENDING` doesn't name the pending invitation and a 429 limit carries no `retry_after` in the body (read from gateway `internal/routes/errors.go`; not run against a gateway).
  - Not run against a deployed environment: the tests use mocked generated calls and mocked HTTP responses.
- [x] 2.9 Mirror the gateway's public routes: `rixlhq/gateway` `e7dd721` narrows the anonymous prefix `/auth/v1/invitations/` to `/auth/v1/invitations/lookup`, so accepting and declining by token need an access token. `publicRespondToInvitation` sent none and would get 401. Test: `src/__tests__/api/sdk-client-public-routes.test.ts`.
  - `/auth/v1/invitations/lookup` is only an allowlist entry so far: the generated client has no such operation. The route lands with `rixlhq/auth-api#252`.

- [ ] 2.10 Add wrappers for the org lifecycle operations (create, convert to team, transfer ownership). The published document has them since `d62ac55`; the generated functions are exported. It publishes no delete or restore operation. Expose `show_deleted` in the list wrapper together with the deletion marker (`Organization.state`, `delete_time`).

## 3. Errors from the gateway

- [x] 3.1 Measure the gateway's error body for a PERMISSION_DENIED refresh with an `ErrorInfo` reason against a deployed or local gateway, and record it here. If the reason is missing, open the gateway change and link it. Leave this open until the reason reaches `ApiError.data`.
  - Measured on 2026-11-24 against a local gateway: `rixlhq/gateway` `origin/rixl/remove-legacy` at `345c524`, its own `routes.NewServeMux` (marshaler and error handler) over a real gRPC connection to a stub `TokenService` that refuses as auth-api does (`internal/tokens/tokens.go`, `orgAccessDenied`). Not run: the gateway's middleware, a deployed gateway, a real auth-api. `/auth/v1/token` is a public route there.
  - `POST /auth/v1/token` answers 403 with `{"error":"forbidden","reason":"MEMBERSHIP_SUSPENDED"}`, and the same shape for `ORG_DELETED` and `NOT_A_MEMBER`.
  - The SDK from this branch, sending real requests to it: `selectOrganization` rejected with `OrgAccessError`, `status` 403, `ApiError.data` equal to that body, and the sign-in was kept.
  - The gateway's `internal/routes` `TestWriteGRPCErrorReason` passes. No gateway change is needed: `internal/routes/errors.go` (`errorReason`, `WriteJSONErrorReason`) already forwards the reason.

## 4. Naming

- [x] 4.1 Rename `session_id` to `challenge_id` in `src/auth/passkey.ts`, `src/auth/auth/login.ts`, `src/auth/auth/types.ts` and `src/auth/validation/auth.ts`, and update `src/__tests__/auth/login.test.ts` and `src/__tests__/auth/passkey-credential.test.ts`. Test: "Two-factor login".
  - `feat/rename-session-names` (rixl-js#168) does not do this rename: its proposal leaves it here, and its `scripts/session-allowlist.txt` allows `session_id`, `sessionId` and `Session ID` until this task. Whichever of the two lands second removes those three lines. The "Session not found" message in `src/auth/passkey.ts` stays with rixl-js#168.

## 5. Integration

- [x] 5.1 Update the README and examples for `selectOrganization`, `OrgAccessError` and `orgContext`. Run `vp check`, `vp test --run`, `vp pack`, `vp run budget` and `vp run examples:check`, and record the results here.
  - README section "Organizations" and `examples/11-organizations.ts` are written. Open because the size budget fails, so `vp run ci` fails.
  - Measured after section 11: `vp check`, `openspec validate adopt-organization-context --strict`, `vp pack`, `vp run examples:check`, `vp run lint:suppressions`, `vp run knip` and `vp run publint` passed. Three full runs of `vp test --run` each exited 0 with 1,023 tests in 86 files. `vp test --coverage --run` passed with 90.37 / 80.76 / 83.26 / 90.13 (statements / branches / functions / lines).
  - `vp run budget` exited 1 at 37.71 kB Brotli against the 32.9 kB limit. The reviewed baseline `b9d7943` was 37.11 kB.
  - Measured on 2026-11-25 after rebasing onto `main` with rixl-js#168 and adding task 2.8: `vp run ci` exits 0 with 1,083 tests in 87 files, coverage 91.18 / 82.11 / 85.34 / 90.98 (statements / branches / functions / lines) and 38.75 kB Brotli. The limit in `.size-limit.json` is raised from 32.9 kB to 39.5 kB: the org token context and the regenerated client account for the growth. The SDK exports every generated operation, so the bundle grows with the published document.
  - The round 6 fixes (section 11) and task 2.8 have had no independent review.

## 6. Level 3 review, round 1

- [x] 6.1 (F1) End a sign-in that has no org to refresh into, renew its cookies with the refresh token, and delete the old access token cookie on sign-out. Test: `shared-sign-in.test.ts`, "A refresh token without an org to refresh into".
- [x] 6.2 (F2) Bind each tab's state to a shared sign-in marker, and discard a refresh that outlives its sign-in. Test: `shared-sign-in.test.ts`, "Tab state belongs to one sign-in". `resolvePermissions()` takes up the stored sign-in before it reads its scope ("keeps the answer when resolvePermissions() is what finds the other account").
- [x] 6.3 (F3) Handle a rejected refresh locally, retry if another tab has rotated its token, and document the race. The rule for announcements was corrected in 7.2. Test: `shared-sign-in.test.ts`, "A rejected refresh that may be a rotation race".
- [x] 6.4 (F4) Handle an org refusal of the tab's token on any request like a refused refresh, and export `ApiError`, `ApiErrorContext` and `WireErrorBody`. Test: `src/__tests__/api/request-refusal.test.ts`.
- [x] 6.5 (F5) Empty permissions before `orgContext` announces the selected org's token. Test: `org-context.test.ts`, "keeps the permissions an orgContext subscriber resolves when selecting …".
- [x] 6.6 (F6) Remove `POST /auth/v1/providers/connect` from the SDK's anonymous routes: the gateway's `publicRoutes` doesn't list it. Test: `sdk-client-public-routes.test.ts`, "attaches Authorization to provider linking".
- [x] 6.7 (F7) State in design.md that only `NOT_A_MEMBER` and `ORG_DELETED` clear the stored org.
- [x] 6.8 (F8) Sign out only when a refresh is answered 401. Test: `org-context.test.ts`, "keeps every tab signed in when selectOrganization() gets …"; `authStore-refresh.test.ts`, "keeps the tokens when the refresh fails with 400" and "403".
- [x] 6.9 (F9) Document that a lost or suspended tab selects `personalOrgId` before listing organizations: it has no token to list them with, and the SDK can't get one without an org. Test: `request-refusal.test.ts`, "lists organizations only after selecting an org it can use".

Open objections, checked and left to their owners:

- O1, accepting an invitation in the app: `respondToInvitation(orgId)` can't work through the gateway. `OrgMatchDialOption` has no exemption and go-common's `CheckOrgMatch` denies a request whose `org_id` isn't the caller's, which an invitee can't select. Measured on 2026-11-25 with the gateway's `routes.NewServeMux` and that dial option in front of a stub `MembershipService`: another org's invitation answers 403 `{"error":"forbidden"}` and never reaches the service; the caller's own org passes. The SDK wrapper was removed in 7.5. The replacement remains task 2.8.
- O2, authenticated email change now uses `VerifyEmailChange` from auth-api #253. It reissues the caller’s sign-in. Public `VerifyEmail` completes signup only and starts a new sign-in.

## 7. Level 3 review, round 2

- [x] 7.1 (G1–G3) Route refresh and reissue through a guarded write and the shared rotation lock. Discard responses after sign-out or a different sign-in, and keep the tab's org when a reissue belongs to its previous org. Tests in `shared-sign-in.test.ts`.
- [x] 7.2 (F3) Wait for rotation on refresh 401 and clear the rejected token locally. Explicit logout alone broadcasts. Test: queued refresher times out during the current holder's turn.
- [x] 7.3 (G4, N1) Expose `orgRefusal`, clear permissions on suspension and keep a replacement access token when an older request is refused. Tests in `request-refusal.test.ts`.
- [x] 7.4 (G5, G6) Correct the integration example, startup error handling and the supported gateway route inventory.
- [x] 7.5 (G7) Remove `respondToInvitation(orgId)` and its PATCH call, `/auth/v1/membership-applications/{org_id}/state`. `rixlhq/auth-api#252` removes the membership-application routes (read from its diff at `9f9a7c5`; open, not merged). The account-scoped replacements remain task 2.8.
- [x] 7.6 (N3) Warm the root module outside the request-refusal test case timeout.
- [x] 7.7 Preserve gateway messages for 409s. The current auth-api slug conflict has a message and no structured reason (`internal/organizations/service/service.go:126`). Tests cover a taken slug and another conflict.

## 8. Level 3 review, round 3

- [x] 8.1 (R1) Commit each change of sign-in, tokens or tab org to every store and cookie before any subscriber hears of it. Test: `sign-in-commit.test.ts`.
- [x] 8.2 (R2) End the stored sign-in once its refresh token is refused and no newer one explains it, let a slower rotation of it still land within a minute, and compare with the token that was sent. Test: `shared-sign-in.test.ts`, "A refused refresh token ends the stored sign-in" and "A rejected refresh that may be a rotation race". This replaces the part of 7.2 that kept the cookies.
- [x] 8.3 (G2) Remember that a tab read the sign-in cookie on the first adoption too, so a tab that loaded signed out treats a later missing marker as sign-out. Test: `shared-sign-in.test.ts`, "does not restore an ended sign-in when a tab that loaded signed out selects an org first".
- [x] 8.4 (R3) Leave the tab alone when an account-scoped route answers an org reason. The list mirrors gateway `internal/routes/account_scoped.go`. Test: `request-refusal.test.ts`, "An org reason from an account-scoped route".
- [x] 8.5 Empty `orgContext` whenever `orgRefusal` is set, a suspension included (design.md, "An org refusal is a typed error, not a sign-out"). Test: `request-refusal.test.ts`, "keeps a suspended tab's org, and has the next getToken() ask again" and "shows the same for a suspension the next refresh reports".
- [x] 8.6 Let `inviteMember` and `resendMemberInvite` pass a 409's gateway message through, as `updateOrganization` does (7.7). Test: `invite.test.ts`, "keeps the gateway's message for a conflict".
- [x] 8.7 Add `POST /platform/clientauth/v1/token` to the SDK's anonymous routes, as gateway `internal/routes/routes.go` lists it. Test: `sdk-client-public-routes.test.ts`, "does not attach Authorization to POST /platform/clientauth/v1/token".
- [x] 8.8 (round 3, integrator) In example 11 and the README, treat a committed switch and loaded permissions as separate outcomes with a permissions retry, and add a refusal and suspension screen, a paged picker and a get and update example. Verified by `vp run examples:check`.
- [x] 8.9 Add `respondToInvitation` and the signed-in requirement of `publicRespondToInvitation` to the proposal's breaking changes, and cite `rixlhq/auth-api#252` for the membership-application routes and for `/auth/v1/invitations/lookup`. Checked against the export diff with `main` at `d3ae710`.

## 9. Level 3 review, round 4

- [x] 9.1 (S1) Complete an explicit switch after the old org is dropped on removal or deletion. Use typed errors for discarded rotation responses. Test: `request-refusal.test.ts`, "completes a switch after the old org reports".
- [x] 9.2 (S2) Hide `orgRefusal` while signed out and keep the internal refusal for recovery. Show and dismiss the refusal screen in example 11, and wait for an explicit personal-org choice. Test: `request-refusal.test.ts`, "dismisses a suspended refusal when the refresh token is rejected".
- [x] 9.3 (S3) Scope logout cookie cleanup and notifications to their original sign-in. Test: `shared-sign-in.test.ts`, "preserves a different sign-in made while an earlier logout is pending".
- [x] 9.4 (S4) Wait for rotation before reading credentials for best-effort revocation. Test: `shared-sign-in.test.ts`, "waits for the current rotation before sending the refresh token to revoke" and "takes the latest refresh token after waiting for another tab's lock".
- [x] 9.5 (S5) Separate startup, switch, and permission outcomes in the README. Document permissions after suspension, shared cookies, and pending invitation responses. Verify example 11 with `vp run examples:check`.
- [x] 9.6 (N1) Preserve both an active selection and a lost org across reload while the refusal marker matches. Tests in `shared-sign-in.test.ts`, "retains the tab's selection across reload" and "retains a lost org across reload".
- [x] 9.7 (N2) Keep successful-response application outside network retries. Test: `shared-sign-in.test.ts`, "does not rotate its own refresh token again when the server returns another org".
- [x] 9.8 Map null organization messages and membership timestamps emitted by protojson to SDK defaults. Tests in `organization.test.ts` and `membership/list.test.ts`.

## 10. Level 3 review, round 5

- [x] 10.1 (R1–R4, S3–S4) Snapshot credentials and sign out synchronously before one bounded revocation. Scoped logout messages also support markerless flows. Tests in `auth/logout.test.ts` and `auth/shared-sign-in.test.ts` cover a stalled revocation, hung refreshes, late replies, and markerless logout. Supersedes task 9.4's queue-based logout.
- [ ] 10.2 Publish the auth-api Logout contract that revokes the whole sign-in using the access token's `sign_in_id`. The SDK relies on it to revoke a sign-in even when its refresh token rotates during logout.
  - Read on 2026-11-25 at auth-api `92d208bd`: not shipped. `Logout` blacklists the access token and calls `RevokeByRefreshToken`, which leaves the sign-in active when the refresh token has already rotated (`internal/signins/sign_ins.go`, `TestRevokeByRefreshToken`).
- [x] 10.3 (S2, j2) Clear the previous refusal when limited access begins. Capture `lastActiveOrgId` before reload. Example 11 returns `signed-out` on a 401.
- [x] 10.4 (j2) Preserve membership management 403 messages and clear the tab's selection without a refusal after voluntary leave. Tests in `api/request-refusal.test.ts`.
- [x] 10.5 (M9) Compare the SDK's public route inventory with the gateway's `publicRoutes` declaration from `345c524`. Test in `api/sdk-client-public-routes.test.ts`.
- [x] 10.6 (M10) Remove `show_deleted` from the list wrapper until task 2.8 supplies the deletion marker. Test in `organization/organization.test.ts`.

## 11. Level 3 review, round 6

- [x] 11.1 (N1, N5–N7) End and revoke the full sign-in replaced by limited access. Set keepalive, isolate failing subscribers, and document logout acknowledgement. Tests in `auth/shared-sign-in.test.ts` and `auth/logout.test.ts`.
- [x] 11.2 (N2) Scope the in-flight request and rotation lock to a sign-in. Test: a new sign-in uses and rotates its token before a held refresh for the old sign-in finishes.
- [x] 11.3 (P1, h2 F2) Guard signup verification and reissue email-change tokens in the original sign-in, including limited access. Tests in `api/request-refusal.test.ts`. Auth-api `05e43d21` defines the route in `proto/auth/v1/token.proto` and reissues via `IssueForSignIn`. Generated route remains task 1.2.
- [x] 11.4 Align signup wrapper requests and response types with auth-api #249 (`5437f541`, `proto/auth/v1/token.proto`). Tests for verification ID, registration response and invalid credentials in `auth/register.test.ts` and `auth/login.test.ts`.
- [x] 11.5 (N3, N4, h2 F1) Expose `orgSelectionRequired`, preserve it across reload, and clear a refusal when voluntary leave finishes. Tests in `api/request-refusal.test.ts`.
- [x] 11.6 Start the SDK once in the README flow and demonstrate org selection and sign-out in example 11. Verified with `vp run examples:check` and an isolated startup probe that failed on `b9d7943` and passed after the fix.
