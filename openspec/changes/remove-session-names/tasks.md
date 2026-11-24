# Tasks

## 1. Renames

- [x] 1.1 Move `src/auth/session-channel.ts` to `src/auth/logout-channel.ts`, rename the shared key to `logoutChannel` and the channel to `${GLOBAL_PREFIX}_logout`, and update imports in `src/auth/auth/logout.ts` and `src/auth/authStore.ts`. Update `src/__tests__/auth/logout.test.ts`. Verify the test "tells the other tabs" passes on the new channel name and no code opens the old one.
- [x] 1.2 Rename `ensureSessionSync`, `sessionSyncInitialized` and `adoptStoredSession` in `src/auth/authStore.ts`, and `sessionToken` in `src/auth/social/socialConnections.ts`. Verify `vp check`.
- [x] 1.3 Change the messages in `src/auth/auth/email.ts:66` and `src/auth/passkey.ts:214`, and update the tests that assert them.
- [x] 1.4 Reword every remaining first-party hit listed by the grep in proposal.md, in `src/` (comments in `api/refresh-tokens.ts`, `api/sdk-client.ts`, `authConfig.ts`, `permissionStore.ts`, `pkce.ts`, `providers/telegram.ts`, `social/socialState.ts`, `state.ts`, `auth/logout.ts`, `platform/platformAuthStore.ts`), in `src/__tests__/` (test names and fixture values) and in `openspec/config.yaml`. Leave `src/auth/validation/auth.ts` and the `session_id` fields to #165 task 4.1.

## 2. Compatibility paths

- [x] 2.1 Delete the positional overload of `verifyEmailWithCode` and `isLegacyVerifyEmailArgs` (`src/auth/auth/email.ts:80-95`). Test that the object form verifies. Mark the commit `feat(auth)!`.
- [x] 2.2 Delete the raw-body branch in `handleLoginError` (`src/auth/auth/login.ts:100-104`). Update tests that pass raw bodies to pass `ApiError`.

## 3. Verification

- [x] 3.1 Ship without a wording guard: the owner decided on 2026-11-25 that the script and its CI job must not exist (design.md, "No automated wording check").
- [x] 3.2 Run `vp check`, `vp test --run`, `vp pack`, `vp run examples:check` and `vp run ci`, and record the results here.
  - Measured on 2026-11-25 after rebasing onto `main` at `e964d50`:
  - `vp check`: no warnings, lint errors or type errors in 93 files.
  - `vp test --run`: 887 tests in 82 files passed.
  - `vp run ci`: exit 0; size 31.49 kB Brotli against the 32.9 kB limit.
