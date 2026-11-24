# Design

## Context

See proposal.md. The SDK coordinates logout across tabs with a BroadcastChannel created in `src/auth/session-channel.ts` and stored in the shared runtime (`src/shared-runtime.ts`) under `sessionChannel`.

## Decisions

### Rename the channel without a bridge

- **Chosen:** new channel name `${GLOBAL_PREFIX}_logout`, new key `logoutChannel`, nothing listening on the old name.
- **Alternatives considered:** listening on both channels for one release, rejected: it is the dual-read the owner's rules forbid, and pre-production there are no long-lived tabs on an old SDK worth bridging.
- **Dropped:** none.
- **Evidence:** `src/auth/session-channel.ts:10-11`, `src/__tests__/auth/logout.test.ts:63,73,84`.

### Names for the renamed concepts

- **Chosen:** "logout channel" for the cross-tab broadcast (it only carries logout), "stored tokens" for what another tab rotated, "sign-in" in user-facing messages.
- **Alternatives considered:** "auth channel", rejected as vaguer than what the channel does.
- **Dropped:** none.
- **Evidence:** `src/auth/authStore.ts:16-46,129-228`.

### Guard

- **Chosen:** `scripts/check-no-session.sh` greps `src` (minus `src/generated`), `examples`, `README.md`, `openspec/config.yaml` and `openspec/changes` (minus `archive` and this change) for `session` not preceded by a letter, or `[[:alnum:]]Session`, and fails on any hit not covered by `scripts/session-allowlist.txt` (`sessionStorage`, `session_state`). It runs in lefthook pre-commit and as `vp run check:terminology` inside `vp run ci`.
- **Alternatives considered:** an oxlint rule, rejected because comments, Markdown and YAML must be covered too.
- **Dropped:** none.
- **Evidence:** auth-api `scripts/check-no-session.sh`.

### Remove the two compatibility paths

- **Chosen:** object-only `verifyEmailWithCode`; `ApiError`-only `handleLoginError`.
- **Alternatives considered:** a deprecation release, rejected: pre-production, and the one caller already uses the object form.
- **Dropped:** none.
- **Evidence:** `src/auth/auth/email.ts:80-95`, `src/auth/auth/login.ts:100-104`, dashboard `src/hooks/useEmailVerification.ts:48`.

## Risks / Trade-offs

- **[Risk]** The challenge-field rename in #165 also touches `passkey.ts`, `login.ts` and tests. → Whichever lands second rebases; neither renames the other's names.
