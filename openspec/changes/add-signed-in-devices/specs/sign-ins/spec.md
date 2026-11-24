# Spec Delta

## Purpose

Lets SDK consumers show a user their sign-ins and revoke one sign-in, all other sign-ins, or all of them, using auth-api's account-scoped sign-in routes.

## ADDED Requirements

### Requirement: List sign-ins

`listSignIns()` SHALL call `GET /auth/v1/sign-ins` and return the user's sign-ins in the server's order, most recently used first. Each `SignIn` SHALL carry:

- `id`, `auth_method`, `user_agent`, `ip` and `country`;
- `created_at`, `last_used_at` and `expires_at`;
- `current`, true only for the sign-in of the access token making the request;
- `device`, a parsed summary with `browser`, `os` and `deviceType`.

#### Scenario: Laptop and phone

- **WHEN** a user signed in on a laptop and a phone calls `listSignIns()` from the laptop
- **THEN** two entries are returned
- **AND** only the laptop entry has `current` true

#### Scenario: Unparseable user agent

- **WHEN** an entry's user agent is empty or no browser or OS can be recognized
- **THEN** its `device` reports an unknown browser, OS and device type

#### Scenario: Partially recognized user agent

- **WHEN** the parser recognizes the browser or OS but not the other
- **THEN** `device` keeps the recognized field and reports the other as unknown

### Requirement: Revoke one sign-in

`revokeSignIn(signInId)` SHALL call `DELETE /auth/v1/sign-ins/{sign_in_id}`. When `signInId` equals the `sign_in_id` claim of the stored access token and the call succeeds, it SHALL also clear local tokens and announce the logout to other tabs, exactly like `logout()`. When the call fails, it SHALL reject and keep local state.

#### Scenario: Revoke another sign-in

- **WHEN** the user revokes their phone's sign-in from the laptop
- **THEN** the call resolves and the laptop stays signed in

#### Scenario: Revoke the current sign-in

- **WHEN** the user revokes the sign-in their access token names
- **THEN** local tokens are cleared and other tabs are told to log out

#### Scenario: Revoking the current sign-in fails

- **WHEN** revoking the current sign-in gets a network error
- **THEN** the promise rejects and the user stays signed in locally

### Requirement: Revoke other sign-ins

`revokeOtherSignIns()` SHALL call `POST /auth/v1/sign-ins/revoke-others`, revoking every sign-in except the current one, and keep local state.

#### Scenario: Revoke others

- **WHEN** the user calls `revokeOtherSignIns()`
- **THEN** a following `listSignIns()` returns only the current sign-in

### Requirement: Sign out everywhere

`logoutAll()` SHALL call `POST /auth/v1/logout/all`, which revokes every sign-in including the current one and the current access token. It SHALL then clear local tokens and announce the logout like `logout()`, also when the request fails, and report a failure to the caller.

#### Scenario: Sign out everywhere

- **WHEN** the user calls `logoutAll()`
- **THEN** local tokens are cleared, other tabs are told to log out, and the other devices' next requests fail

#### Scenario: Request fails

- **WHEN** `logoutAll()` gets a network error
- **THEN** local tokens are still cleared and the promise rejects with the error

### Requirement: Errors are typed

The sign-in functions SHALL surface API failures as the SDK's `ApiError` with the HTTP status. An unknown or foreign sign-in ID SHALL reject with status 404.

#### Scenario: Unknown sign-in ID

- **WHEN** `revokeSignIn` is called with an ID that no longer exists
- **THEN** the promise rejects with an `ApiError` of status 404
