# Tasks

## 1. Renames

- [x] 1.1 Move `src/auth/session-channel.ts` to `src/auth/logout-channel.ts`, rename the shared key to `logoutChannel` and the channel to `${GLOBAL_PREFIX}_logout`, and update imports in `src/auth/auth/logout.ts` and `src/auth/authStore.ts`. Update `src/__tests__/auth/logout.test.ts`. Verify the test "tells the other tabs" passes on the new channel name and no code opens the old one.
- [x] 1.2 Rename `ensureSessionSync`, `sessionSyncInitialized` and `adoptStoredSession` in `src/auth/authStore.ts`, and `sessionToken` in `src/auth/social/socialConnections.ts`. Verify `vp check`.
- [x] 1.3 Change the messages in `src/auth/auth/email.ts:66` and `src/auth/passkey.ts:214`, and update the tests that assert them.
- [x] 1.4 Reword every remaining first-party hit listed by the grep in proposal.md, in `src/` (comments in `api/refresh-tokens.ts`, `api/sdk-client.ts`, `authConfig.ts`, `permissionStore.ts`, `pkce.ts`, `providers/telegram.ts`, `social/socialState.ts`, `state.ts`, `auth/logout.ts`, `platform/platformAuthStore.ts`), in `src/__tests__/` (test names and fixture values) and in `openspec/config.yaml`. Leave `src/auth/validation/auth.ts` and the `session_id` fields to #165 task 4.1.

## 2. Compatibility paths

- [ ] 2.1 Delete the positional overload of `verifyEmailWithCode` and `isLegacyVerifyEmailArgs` (`src/auth/auth/email.ts:80-95`). Test that the object form verifies. Mark the commit `feat(auth)!`.
- [ ] 2.2 Delete the raw-body branch in `handleLoginError` (`src/auth/auth/login.ts:100-104`). Update tests that pass raw bodies to pass `ApiError`.

## 3. Guard

- [ ] 3.1 Add `scripts/check-no-session.sh` and `scripts/session-allowlist.txt` as in design.md. Add `"check:terminology": "sh scripts/check-no-session.sh"` to `package.json`, call it first in `ci`, and add a lefthook pre-commit command. Verify it passes on the tree, and fails on a planted `// session` comment in `src/`.
- [ ] 3.2 Run `vp check`, `vp test --run`, `vp pack`, `vp run examples:check` and `vp run ci`, and record the results here.
