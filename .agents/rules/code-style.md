# Code style

Lint rules and complexity caps live in the `lint` block of `vite.config.ts`. `vp check` enforces them (type-aware, zero warnings) on hand-written code; `src/generated/` and tests are outside the caps. This file doesn't repeat them. Over a cap is a design smell: split the function.

## TypeScript

- Keep strict typing. Don't weaken `tsconfig.json` to make code compile.
- No `any` (lint rule). Use the generated types from `src/generated/types.gen.ts` or a domain type.
- `as` only with a comment on the line above saying why the compiler can't know.
- Imports inside `src/` are relative.
- Map generated response types to the SDK's own shapes in one place (the `mappers` and `to*` functions), not at each call site.

## Errors

- The client's error interceptor (`src/auth/api/sdk-client.ts`) turns every failed request into an `ApiError` with `.status`. Branch on `error instanceof ApiError && error.status === HTTP_STATUS.…`, never on message text.
- A public function that returns a promise lets its rejection reach the caller. Don't swallow it, and don't fire one off without returning or awaiting it.

## Public API

- Everything consumers can import is in `src/index.ts`. Add to it on purpose; Knip flags exports nothing uses.
- Keep the public surface framework-free: no React, no DOM APIs outside the auth flows that need a browser (cookies, WebAuthn, popups).
