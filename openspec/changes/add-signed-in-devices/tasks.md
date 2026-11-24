# Tasks

## 1. Generated client

- [ ] 1.1 Find where the published OpenAPI document gets the auth token-service routes (gateway `docs/`, `rixlhq/openapi`), and get `GET /auth/v1/sign-ins`, `DELETE /auth/v1/sign-ins/{sign_in_id}`, `POST /auth/v1/sign-ins/revoke-others` and `POST /auth/v1/logout/all` published. Blocked on auth-api `rename-sessions-to-sign-ins`: the routes below were measured under their earlier `/auth/v1/sessions` names and must be published again under the new ones. Verify the published `openapi.yaml` contains all four paths. If this needs a change in another repo, record its PR here and leave the task open until it merges.
  - Measured on 2026-11-23: the SDK generator input on `rixlhq/openapi` `main` (`ab5b2e6499759f6068e0511e873d486fad8344ab`) parses as 185 OpenAPI paths. All four method/path pairs are missing. `POST /auth/v1/logout` is present. The checked-in generated client also lacks the four paths.
  - Gateway publication findings:
    - Verified against source: `rixlhq/openapi` is a copy of the gateway's `docs/swagger.{yaml,json}` (`.github/workflows/openapi-copy.yml`). The gateway generates that file with `buf generate` over protos pinned by git ref in `docs/buf.gen.yaml` (`.github/workflows/openapi-gen.yml`, `mise run docs`). The auth-api pin is `7ffb9cb15bd2` (2026-11-15), also pinned in `go.mod`. The four routes were added to `proto/auth/v1/token.proto` in auth-api `f87ceb87` (2026-11-21), which is not an ancestor of the pin (`git merge-base --is-ancestor` fails; the gateway `docs/swagger.yaml` has none of the routes).
    - Measured on the local gateway branch `rixl/publish-device-routes` at `254e200`: the exact auth-api ref `f87ceb87` builds the complete gateway Swagger with all four operations. `mise run docs-check` and `go test -race ./...` passed. A later auth-api ref needs its own generation and domain-tag check.
    - A local gateway test verified that all four routes reject anonymous requests and forward the authenticated user and device to the corresponding RPC over an in-process gRPC connection. Gateway publication and a deployed smoke test remain pending. SDK regeneration can start once all four operations appear in the published OpenAPI document.
- [ ] 1.2 Regenerate the client (`vp run generate`). Verify `src/generated/sdk.gen.ts` contains the four operations and `vp check` passes.

## 2. Device functions

- [ ] 2.1 Add `src/auth/devices/` with `listSignedInDevices`, `signOutDevice`, `signOutOtherDevices` and `signOutEverywhere`, plus the device types, exported from `src/auth/index.ts`. Verify unit tests in `src/__tests__/devices/*.test.ts` cover every spec scenario, including clearing local state for the current device and on a failed sign-out-everywhere. No legacy-token cases (design: "No legacy-token handling").
- [ ] 2.2 Add user-agent parsing into a device summary. Verify table-driven tests for Chrome/Safari/Firefox on desktop and mobile, and for empty and unknown agents. Verify that `vp pack` stays within the bundle budget.
  - The parser and tests are prepared. Include them with the first device wrapper that calls the parser, then verify the packed SDK with the wrapper in place.
  - Measured: 41 parser tests pass, covering Chrome, Safari, Firefox, Edge, Opera and Samsung Internet, device and OS tokens, and empty or unknown input. Tablet detection uses the reported user agent. Desktop-mode iPad Safari reports macOS and desktop.
  - Measured: with a temporary export from `src/index.ts` to include the parser in the packed SDK, `vp pack`, `vp run budget` and `vp run examples:check` pass at 32.23 kB Brotli against a 32.9 kB limit. The temporary export was reverted. Repeat the budget check with the SDK device functions during integration.
- [ ] 2.3 Document the functions in the SDK README or docs, following the existing pattern. Verify `vp run examples:check` passes.

## 3. Integration

- [ ] 3.1 Run `vp check`, `vp test --run` and `vp pack`, and record the results here.
