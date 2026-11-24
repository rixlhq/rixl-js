# Spec Delta

## Purpose

Keeps the SDK's own names for auth state aligned with auth-api: access and refresh tokens, sign-ins and login challenges, never sessions, with one current form of each API.

## ADDED Requirements

### Requirement: SDK names don't say session

First-party SDK code, comments, messages, shared-runtime keys, channel names, tests and OpenSpec text SHALL NOT use "session" for auth state. The browser `sessionStorage` API and the OAuth `session_state` parameter are the only exceptions. There SHALL be no alias, re-export or listener for a renamed name.

#### Scenario: Logout in another tab

- **WHEN** one tab calls `logout()`
- **THEN** other tabs on the same SDK version receive it on `${GLOBAL_PREFIX}_logout`, and nothing is posted to or read from `${GLOBAL_PREFIX}_session`

### Requirement: One form per API

`verifyEmailWithCode` SHALL accept only its params object. Login error handling SHALL read only the SDK's `ApiError`.

#### Scenario: Positional call

- **WHEN** code calls `verifyEmailWithCode` with positional code, type, verification ID and email arguments
- **THEN** it fails type-checking
