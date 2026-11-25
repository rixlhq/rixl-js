# Spec Delta

## Purpose

Defines how the SDK chooses, refreshes and reports the organization of the access token in each browser tab.

## ADDED Requirements

### Requirement: Each tab has its own org and access token

The SDK SHALL hold the selected org, the access token and its expiry per tab. The refresh token SHALL stay shared across tabs. A tab SHALL never use another tab's access token.

#### Scenario: Two tabs on different orgs

- **WHEN** tab 1 selects org A and tab 2 selects org B in the same sign-in
- **THEN** `getToken()` in each tab returns a token for its own org, including after either tab refreshes

#### Scenario: Reload keeps the tab's org

- **WHEN** a tab on org B reloads
- **THEN** its first `getToken()` refreshes into org B

### Requirement: Refresh names the org

Every refresh SHALL send the tab's org as `org_id`. A tab that has never selected an org SHALL use the org of the token sign-in returned. Tokens reissued within a sign-in, as when connecting a provider or confirming TOTP, SHALL NOT change that org. Refresh and token reissue SHALL share a per-sign-in rotation queue and, where available, a per-sign-in cross-tab lock, and a tab SHALL adopt a newer refresh token another tab stored, without adopting that tab's access token.

#### Scenario: Refresh after another tab rotated

- **WHEN** tab 2 rotates the refresh token while tab 1 holds an expired access token for org A
- **THEN** tab 1 refreshes with the newer refresh token and still gets a token for org A

### Requirement: A refresh token without an org ends the sign-in

The cookies a refresh depends on SHALL be written whenever the refresh token is, so none expires before it. When a tab holds a refresh token but has no org of its own, no org it lost and no sign-in org, the SDK SHALL clear the stored tokens and resolve `getToken()` as signed out. It SHALL NOT send a request or pick an org. Signing out SHALL also delete the access token cookie earlier releases wrote.

#### Scenario: Cookies from before the cutover

- **WHEN** a browser holds a refresh token, an access token cookie and `isLogged` from a release before this one
- **THEN** `getToken()` resolves undefined, no request is sent, every tab is signed out and those cookies are gone

#### Scenario: A sign-in older than the cookie lifetime

- **WHEN** a sign-in is still refreshing more than the cookie lifetime after it began, and a new tab opens
- **THEN** the new tab refreshes into the personal org

### Requirement: Tab state belongs to one sign-in

The SDK SHALL store a marker of the sign-in (user ID and sign-in ID) in a cookie next to the refresh token, created by an interactive sign-in and renewed on token rotation. Each tab SHALL bind its org, lost org, access token, user and permissions to that marker. On a different stored marker, the tab SHALL drop all of them before using any. A change of sign-in, of the tab's tokens or of the tab's org SHALL reach every store and cookie it touches before any subscriber hears of it.

#### Scenario: Signing in while an orgContext subscriber resolves permissions

- **WHEN** an `orgContext` subscriber calls `ensurePermissions()`, also while the org is cleared, and an interactive sign-in follows a sign-out or a refused refresh, or happens on a tab whose stored sign-in is older than the browser's
- **THEN** the cookies hold the new refresh token with its own sign-in marker and personal org, and the tab and a new tab refresh into it

#### Scenario: Signing out while a subscriber resolves permissions

- **WHEN** a subscriber calls `ensurePermissions()` as the sign-out reaches it
- **THEN** it finds the tab and the cookies signed out, and takes no token up again

#### Scenario: Another account signs in on another tab

- **WHEN** a tab holds a token for user 1 and another tab signs in as user 2 without signing out
- **THEN** the first tab's next `getToken()` returns user 2's token for user 2's personal org, and it sends no request naming user 1's org

#### Scenario: A restored tab finds another account

- **WHEN** a tab whose stored org, or lost org, belongs to an earlier sign-in loads again
- **THEN** it drops them and refreshes into the current sign-in's personal org

### Requirement: A rotation that outlives its sign-in is discarded

The SDK SHALL require the returned token's sign-in to match both the request's sign-in and the browser's current sign-in, or the one a refusal took out of the cookies within the last minute ("A slower rotation outlives a refusal for one minute"). It SHALL adopt an access token for the requested org only if the tab still has its original org or an explicit switch is leaving an org that was dropped on refusal. A discarded rotation SHALL report the reason as an `ApiError`.

#### Scenario: A rotation outlives its sign-in

- **WHEN** a refresh or reissue is answered after another tab signs in or signs out
- **THEN** its tokens are discarded and its refusal leaves the new state alone

#### Scenario: A tab that loaded signed out misses a sign-out

- **WHEN** a tab that loaded signed out first calls `selectOrganization` after another tab signed in, and that tab signs out, unannounced, before the answer arrives
- **THEN** the tokens are discarded and the browser stays signed out

#### Scenario: A reissue returns tokens for the tab's former org

- **WHEN** a reissue returns after the tab changes org within the same sign-in
- **THEN** the tab keeps its current org and access token and stores the rotated refresh token

### Requirement: selectOrganization replaces updateActiveMembership

`selectOrganization(orgId)` SHALL refresh into `orgId` and, on success, make it the tab's org and clear the tab's permissions, before `orgContext` announces the new token. `updateActiveMembership` SHALL be removed.

#### Scenario: Resolving permissions from an orgContext subscription

- **WHEN** an `orgContext` subscriber calls `ensurePermissions()` while `selectOrganization` runs, for another org or the same one
- **THEN** the permissions it resolves are held once both calls resolve

#### Scenario: Switching org

- **WHEN** a tab on org A calls `selectOrganization("B")` and the user is an active member of B
- **THEN** it resolves, `getToken()` returns a token for B and `orgContext` names B

#### Scenario: An old org is removed while an explicit switch is in flight

- **WHEN** the tab drops its old org on refusal while refreshing into a different org selected by the user
- **THEN** the accepted switch still applies if the sign-in is unchanged

### Requirement: Logout completes locally before revocation

Logout SHALL snapshot the browser's current sign-in and credentials, clear its local state and matching shared cookies, and broadcast its marker synchronously, outside the rotation queue and lock. A tab SHALL act on a broadcast only when its marker matches, including a markerless message for a markerless tab.

#### Scenario: A rotation or revocation stalls

- **WHEN** logout is called while a refresh is pending, or the revocation attempt stalls
- **THEN** local logout is immediate and a newly loaded page starts signed out

#### Scenario: The revocation attempt finishes or times out

- **WHEN** local logout completes
- **THEN** the SDK sends one keepalive revocation with the snapshotted credentials and resolves with `{revoked: true}` on acknowledgement within five seconds or `{revoked: false}` otherwise. Acknowledgement alone does not establish sign-in-wide revocation, which requires auth-api support for the access token’s `sign_in_id`

#### Scenario: Another account signs in during revocation

- **WHEN** another account signs in while the old sign-in's revocation is pending
- **THEN** the newer sign-in remains usable when revocation settles

### Requirement: Email verification stays within its initiating context

Public signup verification SHALL commit a new sign-in only while its initiating browser context is current. Email-change verification SHALL use the caller’s bearer and apply tokens only to the same sign-in and org. It MAY promote the matching limited-access bearer after verification.

#### Scenario: Verification completes after logout

- **WHEN** signup verification or email-change verification finishes after its initiating sign-in or browser context ended
- **THEN** the returned tokens are discarded

#### Scenario: Limited access replaces a full sign-in

- **WHEN** the SDK enters limited access while a full sign-in is active
- **THEN** the full sign-in is cleared, its tabs are notified, and revocation is attempted before the limited flow continues

### Requirement: Invitations use auth-api's invitation routes

The SDK's functions SHALL create, list and resend an org's invitations under that org, and SHALL list and accept the signed-in user's invitations on the account routes, naming an accepted invitation by emailed token or by ID in the request body. Revoking and declining use the generated operations. Looking up a token SHALL need no sign-in. A refusal SHALL reach the caller as an `ApiError` that keeps the gateway's `reason`.

#### Scenario: Accepting from an email link

- **WHEN** a signed-in user calls `acceptInvitation({token})`
- **THEN** the SDK posts the token to `/auth/v1/invitations/accept`, resolves with the membership and leaves the tab on its org

#### Scenario: Opening a link while signed out

- **WHEN** `lookupInvitation(token)` runs without a sign-in
- **THEN** the request carries no access token and changes nothing

#### Scenario: A second invitation to the same address

- **WHEN** `createInvitation` is answered 409 with reason `INVITATION_PENDING`
- **THEN** it rejects with that `ApiError`, reason included

### Requirement: Voluntary leave clears the tab's selected org

A successful leave of the tab's selected org in the current sign-in SHALL clear the selected org, access token and permissions. The tab SHALL stay signed in and wait for an explicit org selection across reloads. `orgSelectionRequired` SHALL be true, and `getToken()` SHALL resolve undefined until selection. A refusal of the same departed org that arrives before leave completes SHALL be cleared.

#### Scenario: Leaving the selected org

- **WHEN** the SDK successfully leaves the org the tab is using
- **THEN** `orgContext` and `orgRefusal` are undefined and a later explicit selection can resume authenticated requests

### Requirement: An unavailable org rejects with its reason

A refresh refused with `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER` SHALL reject with `OrgAccessError` carrying `reason` and `orgId`. It SHALL keep the refresh token. A failed `selectOrganization` SHALL also keep the tab's previous org and its access token. It SHALL NOT sign the user out or select another org.

#### Scenario: Selecting an org that removed the user

- **WHEN** a tab on org A calls `selectOrganization("B")` and B removed the user
- **THEN** it rejects with `OrgAccessError` reason `NOT_A_MEMBER` and org `B`, and the tab stays on org A and signed in

#### Scenario: The tab's org is deleted

- **WHEN** a tab's org is deleted and its access token expires
- **THEN** `getToken()` rejects with `OrgAccessError` reason `ORG_DELETED`, and `selectOrganization` with the personal org succeeds without signing in again

#### Scenario: A refresh refused for another reason keeps the sign-in

- **WHEN** a refresh fails with 400, or with 403 without one of the org reasons
- **THEN** the SDK rejects with that error, keeps every token and signs no tab out

#### Scenario: A refused refresh that may be a rotation race

- **WHEN** a refresh answers 401 after another tab rotated the token
- **THEN** the SDK waits briefly for the newer stored refresh token and retries with it if it arrives, also when the tab already took that token up during the wait

### Requirement: A refused refresh token ends the stored sign-in

When refresh answers 401 and the tab has taken up no newer token, other sign-in or sign-out after the settle wait, the SDK SHALL clear the tab's tokens. While the stored refresh token is still the one sent, it SHALL also remove the refresh token, sign-in marker, personal org and `isLogged` cookies, and SHALL NOT remove a newer token. Only explicit logout SHALL announce sign-out.

#### Scenario: A refused refresh token ends the sign-in across reloads

- **WHEN** a refresh is refused with 401, no newer token arrives, and the page is reloaded three times
- **THEN** every load starts with `isLogged` false, `getToken()` resolves undefined and no request is sent

#### Scenario: A newer stored token survives a refusal

- **WHEN** another tab stored a newer refresh token for the sign-in before the refusal is settled
- **THEN** the SDK keeps it and retries with it

### Requirement: A slower rotation outlives a refusal for one minute

No lock may keep tabs apart, so a successful rotation of a sign-in another tab has just ended on a 401 can still be on its way. The SDK SHALL store its tokens for one minute after that, unless a logout or a new sign-in happened first.

#### Scenario: A slower rotation proves the sign-in alive

- **WHEN** a tab ends the stored sign-in on a 401, and a successful rotation of that sign-in returns to another tab within one minute
- **THEN** its tokens are stored, and the refused tab takes them up on its next call, on the org it had

#### Scenario: A slower rotation after logout

- **WHEN** the user logs out, or another sign-in is stored, before that rotation returns
- **THEN** its tokens are discarded

#### Scenario: Reload during a rotation recovery window

- **WHEN** a tab reloads while the temporary refusal marker matches its stored sign-in
- **THEN** it starts signed out and keeps the stored org or refusal for a successful late rotation

### Requirement: A refused stored org is cleared

When a refresh into the tab's own org, such as the stored org after a reload, is refused with `NOT_A_MEMBER` or `ORG_DELETED`, the SDK SHALL clear the tab's stored org and keep the refresh token. `getToken()` SHALL then reject with that `OrgAccessError` until `selectOrganization` succeeds, also after the tab reloads, and the SDK SHALL NOT fall back to another org. A new sign-in or signing out ends it too. A failed `selectOrganization` SHALL NOT clear the tab's org.

#### Scenario: Reload after removal

- **WHEN** a tab whose stored org B removed the user reloads and calls `getToken()`
- **THEN** it rejects with `OrgAccessError` reason `NOT_A_MEMBER`, the stored org is cleared, the user stays signed in and the caller must select an org

#### Scenario: Reload after deletion

- **WHEN** a tab whose stored org B was deleted reloads and calls `getToken()`
- **THEN** it rejects with `OrgAccessError` reason `ORG_DELETED`, the stored org is cleared and `selectOrganization` with another org succeeds

#### Scenario: A refused live switch keeps the org

- **WHEN** a tab on org A calls `selectOrganization("B")` and is refused with `NOT_A_MEMBER`
- **THEN** the tab's org stays A and its stored org is not cleared

### Requirement: An org refusal on an org route is handled like a refused refresh

A 403 with an org reason from a route that needs the token's org, for this tab's current access token, SHALL reject with `OrgAccessError` and invalidate that token. The SDK SHALL apply the same stored-org rules as for a refused refresh. A refusal of an older or unrelated token SHALL leave the tab state unchanged. A refusal from one of the gateway's account-scoped routes SHALL reach the caller as an `ApiError` and leave the tab state unchanged.

#### Scenario: An account-scoped route refuses another org

- **WHEN** a tab on org A accepts an invitation and the answer is 403 with `ORG_DELETED`
- **THEN** it rejects with an `ApiError` carrying that reason, and the tab keeps org A, its access token and no org refusal

#### Scenario: Removed while the access token is still valid

- **WHEN** a tab on org B is removed from it and calls `getOrganization("B")` before its token expires
- **THEN** the call rejects with `OrgAccessError` reason `NOT_A_MEMBER`, the stored org is cleared and `getToken()` rejects with that error without a request

#### Scenario: Suspended while the access token is still valid

- **WHEN** a request is refused with `MEMBERSHIP_SUSPENDED`
- **THEN** the tab keeps its stored org, clears its permissions and `orgContext`, and reports the suspension in `orgRefusal`. Its next `getToken()` refreshes into it

#### Scenario: A refusal of another token

- **WHEN** a request made with another org's or another sign-in's token is refused with an org reason
- **THEN** it rejects with an `ApiError` and the tab doesn't change

### Requirement: The tab exposes its current org refusal

The SDK SHALL export a read-only `orgRefusal` store with `{reason, orgId}` when the current org is refused. The public store SHALL be undefined after a new access token and while signed out. A final refresh 401 SHALL retain the internal refusal for rotation recovery. Starting a new sign-in or limited-access flow SHALL clear the old refusal. While it is set, a suspension included, `orgContext` SHALL be undefined: the tab has no access token for it to describe.

#### Scenario: A suspended org is restored

- **WHEN** a suspended tab refreshes after its membership is restored
- **THEN** the refresh succeeds, `orgRefusal` becomes undefined and `orgContext` names the org again

### Requirement: Sign-in exposes the last org as a hint

After sign-in, the SDK SHALL expose `last_active_org_id` from the response as `lastActiveOrgId` and keep the tab on the sign-in token's org until the consumer calls `selectOrganization`.

The SDK SHALL expose the org of the token sign-in returned as `personalOrgId`, in every tab of the sign-in.

#### Scenario: Listing orgs from a tab that can't use its org

- **WHEN** a tab whose org was refused calls `listOrganizations()`
- **THEN** it rejects with that `OrgAccessError`, and succeeds after `selectOrganization(personalOrgId)`

#### Scenario: Selecting the personal org after losing the tab's org

- **WHEN** a tab lost its org and the caller selects `personalOrgId`
- **THEN** it succeeds without signing in again

#### Scenario: Sign-in on a new device

- **WHEN** a user whose last org was B signs in
- **THEN** `orgContext` names the personal org and `lastActiveOrgId` is `B`

### Requirement: Org claims are tab state

`User` SHALL NOT carry `org_id`. A per-tab `orgContext` SHALL expose `orgId` and `role` decoded from the tab's access token. `role` is for display. The SDK SHALL NOT read a `pms` claim.

#### Scenario: Another tab changes org

- **WHEN** tab 2 selects another org
- **THEN** tab 1's `orgContext` and permissions don't change
