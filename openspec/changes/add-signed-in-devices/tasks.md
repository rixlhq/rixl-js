# Tasks

## 1. Generated client

- [x] 1.1 Get `GET /auth/v1/sign-ins`, `DELETE /auth/v1/sign-ins/{sign_in_id}`, `POST /auth/v1/sign-ins/revoke-others` and `POST /auth/v1/logout/all` into the published OpenAPI document. This is gateway `adopt-organization-context` task 4.1 (gateway#178), which regenerates `docs/` from the auth-api ref with the sign-in routes. Verify the published `openapi.yaml` contains all four paths and no `/auth/v1/sessions` path. Leave this open until it merges and `rixlhq/openapi` has copied it.
  - Measured on 2026-11-23: the SDK generator input on `rixlhq/openapi` `main` (`ab5b2e6499759f6068e0511e873d486fad8344ab`) parses as 185 OpenAPI paths. All four method/path pairs are missing. `POST /auth/v1/logout` is present. The checked-in generated client also lacks the four paths.
  - Verified against source: `rixlhq/openapi` is a copy of the gateway's `docs/swagger.{yaml,json}` (`.github/workflows/openapi-copy.yml`). The gateway generates that file with `buf generate` over protos pinned by git ref in `docs/buf.gen.yaml` (`.github/workflows/openapi-gen.yml`, `mise run docs`), also pinned in `go.mod`.
  - Measured on the local gateway branch `rixl/publish-device-routes` at `254e200`: an earlier auth-api ref built the four operations under `/auth/v1/sessions*`. Verified on 2026-11-24: that branch was never pushed and has no PR, and gateway `adopt-organization-context` drops it in favour of the sign-in names.
  - Measured on 2026-11-25: `rixlhq/openapi` `main` at `d62ac55b901ed19900179ab9a3f259d465e6e390` publishes all four paths and no `/auth/v1/sessions` path. The proposal's and design's statements that the document lacks them describe the earlier measurement.
- [ ] 1.2 Regenerate the client (`vp run generate`). Verify `src/generated/sdk.gen.ts` contains `authV1TokenServiceListSignIns`, `authV1TokenServiceRevokeSignIn`, `authV1TokenServiceRevokeOtherSignIns` and `authV1TokenServiceLogoutAll`, that none of them takes a `user_id` parameter, and that `vp check` passes.

## 2. Sign-in functions

- [x] 2.1 Move the prepared parser from `src/auth/devices/user-agent.ts` to `src/auth/sign-ins/user-agent.ts` and its tests from `src/__tests__/devices/` to `src/__tests__/sign-ins/`. Verify the 41 parser tests still pass with `vp test --run src/__tests__/sign-ins/user-agent.test.ts`.
  - Measured earlier: 41 parser tests pass, covering Chrome, Safari, Firefox, Edge, Opera and Samsung Internet, device and OS tokens, and empty or unknown input. Tablet detection uses the reported user agent. Desktop-mode iPad Safari reports macOS and desktop.
  - Measured earlier: with a temporary export of the parser from `src/index.ts`, `vp pack`, `vp run budget` and `vp run examples:check` pass at 32.23 kB Brotli against a 32.9 kB limit. Repeat with the functions below in place (task 3.1).
- [ ] 2.2 Add `src/auth/sign-ins/index.ts` with `listSignIns`, `revokeSignIn`, `revokeOtherSignIns`, `logoutAll` and the `SignIn` type, following `src/auth/passkey.ts` (`apiCall`, `throwOnError: true`). Export them from `src/auth/index.ts` and `src/index.ts`. Verify `src/__tests__/sign-ins/sign-ins.test.ts`, with one test named after each spec scenario.
- [ ] 2.3 Document the functions in the SDK README following the existing pattern. Verify `vp run examples:check` passes.

## 3. Integration

- [ ] 3.1 Run `vp check`, `vp test --run`, `vp pack`, `vp run budget` and `vp run examples:check`, and record the results here.
