# Proposal

## Why

RIXL auth is stateless: access tokens are JWTs and each refresh-token family is a **sign-in**. The SDK still names its own auth state "session" in a file, shared-runtime keys, a BroadcastChannel name, functions, error messages, comments and tests. The owner's rule is that "session" never names a first-party concept. RIXL is in development, so the SDK also drops two compatibility paths: a positional-arguments overload of `verifyEmailWithCode` and a raw-error-body branch in `handleLoginError`.

Verified against `origin/main` (49067d4) on 2026-11-24 with `git grep -n -i -E "(^|[^a-z])session|[a-z0-9]Session" -- src examples README.md ':!src/generated'` and `git grep -n -i -E "deprecat|legacy|fallback|compat|backward"`.

## What Changes

- **BREAKING (internal)** `src/auth/session-channel.ts` becomes `src/auth/logout-channel.ts`; the shared-runtime key `sessionChannel` becomes `logoutChannel`; the BroadcastChannel `${GLOBAL_PREFIX}_session` becomes `${GLOBAL_PREFIX}_logout`. No alias, re-export or listener on the old channel: a tab running an older SDK copy simply doesn't hear the newer copy's logout.
- `ensureSessionSync`/`sessionSyncInitialized`/`adoptStoredSession` in `src/auth/authStore.ts` become `ensureLogoutSync`/`logoutSyncInitialized`/`adoptStoredTokens`; `sessionToken` in `src/auth/social/socialConnections.ts` becomes `accessToken`.
- Error messages: "Session expired - please login again" (`src/auth/auth/email.ts:66`) becomes "Sign-in expired - please log in again"; "Session not found" (`src/auth/passkey.ts:214`) becomes "Login challenge not found" (the wording rixl-js#165 chose).
- Comments, test names, test fixture values (`"session-123"` and similar) and `openspec/config.yaml` stop saying "session". Prose about the browser store says `sessionStorage`.
- **BREAKING** `verifyEmailWithCode` takes only its params object; the positional `(code, type, verification_id, new_email)` overload and `isLegacyVerifyEmailArgs` are deleted. Verified: the only caller in RIXL repos (dashboard `src/hooks/useEmailVerification.ts:48`) passes an object.
- `handleLoginError` (`src/auth/auth/login.ts:100-104`) reads only `ApiError.data`; the "legacy paths may still surface the raw body" branch goes, since the client interceptor always wraps bodies (`src/auth/api/sdk-client.ts` `toApiError`).

Not in this change: the login-challenge field `session_id` → `challenge_id` follows the generated API and stays in `adopt-organization-context` (rixl-js#165) task 4.1. The generated client is excluded; it is regenerated from auth-api.

## Capabilities

### New Capabilities

- `auth-vocabulary`: the SDK's own names for auth state.

### Modified Capabilities

None.

## Non-goals

- No change to `sessionStorage` use (browser API) or the OAuth `session_state` callback parameter (OIDC protocol name).
- No rename inside `.agents/`: those files are vendored agent-tool docs whose "session" is the AI tool's own conversation, not a RIXL concept.
- No automated wording check. The owner decided on 2026-11-25 that the guard script and its CI job must not exist; auth-api removed its own in `8705ee8a`.

## Impact

`src/auth/**`, `src/platform/platformAuthStore.ts`, `src/__tests__/**`, `openspec/config.yaml`. Public API: `verifyEmailWithCode` loses its positional overload (`feat(auth)!`).
