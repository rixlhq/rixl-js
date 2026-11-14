# Anti-slop rules

Slop is work that looks finished but isn't: it compiles, often passes checks and reads confidently, yet adds nothing or is wrong.

## Code

- No dead code. If nothing calls it, delete it. `vp run knip` fails on unused files, exports and dependencies; `src/index.ts` is the published entry point.
- No commented-out code. Git keeps the history.
- No premature abstraction. Extract at three real call sites, not one.
- No "just in case" code: no handling for cases that can't happen, no fallbacks nobody asked for.
- No lint suppression without a reason after `--` (`// oxlint-disable-next-line rule -- why`). `vp run lint:suppressions` fails on a bare one.
- No TODO or FIXME without a linked ticket (`// TODO(CU-<id>): …`).
- No magic numbers or strings. Name the constant (`src/auth/constants.ts`).
- Functions do one thing; names say what they do; comments explain why, never what.
- A change is as big as the problem. No drive-by refactors in a feature or fix.

## The package

`@rixl/sdk` is published to npm and runs inside customer apps and Rixl's own (dashboard, internal-dashboard, blog-posts). Most releases are generated from the API spec and merged by a bot, so the release job's `vp run ci` is the only check before `npm publish`.

- Never edit `src/generated/`. It is rebuilt from `rixlhq/openapi` (`vp run generate`); fix the spec or the hand-written wrapper instead.
- Removing or renaming anything `src/index.ts` exports, or changing its signature, is breaking (`feat!:` or a `BREAKING CHANGE:` footer). Release Please turns it into the next major.
- No new runtime dependency without checking its size: `vp run budget` fails over `.size-limit.json`.
- Never lower the coverage floor or the size budget to make CI pass.

## Tokens and sessions

The SDK holds access tokens, refresh cookies, PKCE verifiers and passkey credentials.

- Never log, throw or return a token, a verifier or a credential. Error messages name what failed, not the value.
- Never commit a real key or token. Tests use obvious fakes.
- Responses from the API are untrusted until mapped: errors arrive as `ApiError` (`src/auth/api/types.ts`); check `.status`.

## Prose (PR descriptions, commit messages, docs)

- Every technical claim points at something real: a file, a command's output, a doc link.
- No invented metrics, timings or percentages.
- Say what changed and why. Don't narrate the steps you took.
