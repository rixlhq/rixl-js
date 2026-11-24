# Spec Delta

## Purpose

Keeps the SDK's auth vocabulary aligned with auth-api: access and refresh tokens, sign-ins and login challenges, never sessions.

## ADDED Requirements

### Requirement: Login challenges use challenge_id

The passkey and TOTP login functions and types SHALL take and return `challenge_id`: `verifyTOTPForLogin(code, challengeId)`, `finishPasskeyLogin(challengeId, credential)`, `verifyPasskeyForLogin(challengeId, credential)`, `finishPasskeyRegistration(challengeId, name, credential)`, `TwoFactorResponse.challenge_id`, `LoginOTPVerifyRequest.challenge_id` and the passkey begin results.

#### Scenario: Two-factor login

- **WHEN** login returns a two-factor challenge and the user submits a TOTP code
- **THEN** the SDK sends the code with the response's `challenge_id`
