# Testing

| Tool                 | Purpose                                                   | Command                           |
| -------------------- | --------------------------------------------------------- | --------------------------------- |
| Vitest               | Unit tests for auth flows, stores, mappers and the client | `vp test`                         |
| fast-check           | Property tests for logic with wide inputs                 | inside the unit tests             |
| Vitest coverage (v8) | Fails below the floor in `vite.config.ts`                 | `vp run test:coverage`            |
| Examples typecheck   | `examples/` still compiles against the public API         | `vp run examples:check`           |
| size-limit           | `dist/index.js` stays within `.size-limit.json`           | `vp run budget`, after `vp pack`  |
| publint              | The `package.json` exports map resolves                   | `vp run publint`, after `vp pack` |

Tests import Vitest APIs from `vite-plus/test`.

## When to use each

- **Unit** — Every public function: the success path, each `ApiError` status it handles, and what reaches the caller when the request fails. Assert outcomes (returned value, store state, rejection), not calls.
- **fast-check** — Encoders, parsers and mappers with wide inputs: the passkey codec (`passkey-codec.test.ts`), URL and cookie parsing, PKCE. Assert an invariant (round trip, alphabet, length) across generated inputs.
- **Examples** — A change to a public signature must keep `examples/` compiling, or update them in the same change.

## Location

- `src/__tests__/`, mirroring `src/auth/` (`src/__tests__/domain/`, `src/__tests__/auth/`…).

## Coverage

The floor (`coverage.thresholds`) is a ratchet: it started just under the measured level. Raise it when tests land; never lower it to make a change pass.

## Quality gates

- Deterministic: no network, no real clock (`vi.useFakeTimers()`), no shared state between tests. Mock the generated request functions, not `fetch` internals.
- Before trusting a new test, break the code it covers and watch it fail, then restore the code.
- A test that only restates the implementation is slop.
