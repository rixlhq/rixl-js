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

Every refresh SHALL send the tab's org as `org_id`. A tab that has never selected an org SHALL use the org of the token sign-in returned. Refresh SHALL stay serialized across tabs, and a tab SHALL adopt a newer refresh token another tab stored, without adopting that tab's access token.

#### Scenario: Refresh after another tab rotated

- **WHEN** tab 2 rotates the refresh token while tab 1 holds an expired access token for org A
- **THEN** tab 1 refreshes with the newer refresh token and still gets a token for org A

### Requirement: selectOrganization replaces updateActiveMembership

`selectOrganization(orgId)` SHALL refresh into `orgId` and, on success, make it the tab's org and clear the tab's permissions. `updateActiveMembership` SHALL be removed.

#### Scenario: Switching org

- **WHEN** a tab on org A calls `selectOrganization("B")` and the user is an active member of B
- **THEN** it resolves, `getToken()` returns a token for B and `orgContext` names B

### Requirement: An unavailable org rejects with its reason

A refresh refused with `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER` SHALL reject with `OrgAccessError` carrying `reason` and `orgId`. It SHALL keep the refresh token. A failed `selectOrganization` SHALL also keep the tab's previous org and its access token. It SHALL NOT sign the user out or select another org.

#### Scenario: Selecting an org that removed the user

- **WHEN** a tab on org A calls `selectOrganization("B")` and B removed the user
- **THEN** it rejects with `OrgAccessError` reason `NOT_A_MEMBER` and org `B`, and the tab stays on org A and signed in

#### Scenario: The tab's org is deleted

- **WHEN** a tab's org is deleted and its access token expires
- **THEN** `getToken()` rejects with `OrgAccessError` reason `ORG_DELETED`, and `selectOrganization` with the personal org succeeds without signing in again

#### Scenario: A rejected refresh token still signs out

- **WHEN** refresh fails because the refresh token is invalid, expired or already used
- **THEN** the SDK clears tokens as before and tells other tabs

### Requirement: A refused stored org is cleared

When a refresh into the tab's own org, such as the stored org after a reload, is refused with `NOT_A_MEMBER` or `ORG_DELETED`, the SDK SHALL clear the tab's stored org and keep the refresh token. `getToken()` SHALL then reject with that `OrgAccessError` until `selectOrganization` succeeds, and the SDK SHALL NOT fall back to another org. A failed `selectOrganization` SHALL NOT clear the tab's org.

#### Scenario: Reload after removal

- **WHEN** a tab whose stored org B removed the user reloads and calls `getToken()`
- **THEN** it rejects with `OrgAccessError` reason `NOT_A_MEMBER`, the stored org is cleared, the user stays signed in and the caller must select an org

#### Scenario: Reload after deletion

- **WHEN** a tab whose stored org B was deleted reloads and calls `getToken()`
- **THEN** it rejects with `OrgAccessError` reason `ORG_DELETED`, the stored org is cleared and `selectOrganization` with another org succeeds

#### Scenario: A refused live switch keeps the org

- **WHEN** a tab on org A calls `selectOrganization("B")` and is refused with `NOT_A_MEMBER`
- **THEN** the tab's org stays A and its stored org is not cleared

### Requirement: Sign-in exposes the last org as a hint

After sign-in, the SDK SHALL expose `last_active_org_id` from the response as `lastActiveOrgId` and keep the tab on the sign-in token's org until the consumer calls `selectOrganization`.

#### Scenario: Sign-in on a new device

- **WHEN** a user whose last org was B signs in
- **THEN** `orgContext` names the personal org and `lastActiveOrgId` is `B`

### Requirement: Org claims are tab state

`User` SHALL NOT carry `org_id`. A per-tab `orgContext` SHALL expose `orgId` and `role` decoded from the tab's access token. `role` is for display. The SDK SHALL NOT read a `pms` claim.

#### Scenario: Another tab changes org

- **WHEN** tab 2 selects another org
- **THEN** tab 1's `orgContext` and permissions don't change
