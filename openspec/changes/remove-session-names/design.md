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

### No automated wording check

- **Chosen:** the rename ships without a script or CI job that searches for "session".
- **Alternatives considered:** a `scripts/check-no-session.sh` guard in lefthook and `vp run ci`, modeled on auth-api's. The owner rejected it on 2026-11-25, and auth-api removed its own (`8705ee8a`).
- **Dropped:** the guard and its allowlist.

### Remove the two compatibility paths

- **Chosen:** object-only `verifyEmailWithCode`; `ApiError`-only `handleLoginError`.
- **Alternatives considered:** a deprecation release, rejected: pre-production, and the one caller already uses the object form.
- **Dropped:** none.
- **Evidence:** `src/auth/auth/email.ts:80-95`, `src/auth/auth/login.ts:100-104`, dashboard `src/hooks/useEmailVerification.ts:48`.

### Open changes also said "session"

- **Chosen:** reworded three lines in `add-github-personal-oauth` and `add-permission-resolution`, so open changes use the current names.
- **Evidence:** the grep in proposal.md over `openspec/changes`.

### Raw-body branch had a second arm

- **Chosen:** `handleLoginError` also drops the arm that wrapped a non-`ApiError` body into a new `ApiError`; it only served the raw-body path, and a non-`ApiError` now rethrows unchanged.
- **Evidence:** `src/auth/auth/login.ts`.

## Risks / Trade-offs

- **[Risk]** The challenge-field rename in #165 also touches `passkey.ts`, `login.ts` and tests. → Whichever lands second rebases; neither renames the other's names.
