# Spec Delta

## Purpose

Keeps the SDK's auth vocabulary aligned with auth-api: access and refresh tokens, sign-ins and login challenges, never sessions.

## ADDED Requirements

### Requirement: Login challenges use challenge_id

The passkey and TOTP login functions and types SHALL take and return `challenge_id`: `verifyTOTPForLogin(code, challengeId)`, `finishPasskeyLogin(challengeId, credential)`, `verifyPasskeyForLogin(challengeId, credential)`, `finishPasskeyRegistration(challengeId, name, credential)`, `TwoFactorResponse.challenge_id`, `LoginOTPVerifyRequest.challenge_id` and the passkey begin results.

#### Scenario: Two-factor login

- **WHEN** login returns a two-factor challenge and the user submits a TOTP code
- **THEN** the SDK sends the code with the response's `challenge_id`

### Requirement: SDK names don't say session

First-party SDK names, messages, comments, shared-runtime keys and channel names SHALL NOT use "session" for auth state. That covers `ensureSessionSync`, `sessionSyncInitialized`, `adoptStoredSession`, `session-channel.ts`, the `sessionChannel` key, the `${GLOBAL_PREFIX}_session` channel, the "Session expired" and "Session not found" messages, and session wording in comments and `openspec/config.yaml`. Browser and protocol names stay: `sessionStorage` and the OAuth `session_state` parameter.

#### Scenario: Source check

- **WHEN** `git grep -niw "session\|sessions\|sessionid\|session_id" -- src ':!src/generated'` runs, ignoring `sessionStorage` and `session_state`
- **THEN** it finds nothing
