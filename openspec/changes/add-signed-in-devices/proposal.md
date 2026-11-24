# Proposal

## Why

Users can't see where they're signed in or sign out a lost device. auth-api tracks one sign-in per refresh-token family and, after its `rename-sessions-to-sign-ins` change, exposes these endpoints:

| Endpoint                                | What it does                                    |
| --------------------------------------- | ----------------------------------------------- |
| `GET /auth/v1/sign-ins`                 | List the user's sign-ins                        |
| `DELETE /auth/v1/sign-ins/{sign_in_id}` | Revoke one sign-in                              |
| `POST /auth/v1/sign-ins/revoke-others`  | Revoke every sign-in except the current one     |
| `POST /auth/v1/logout/all`              | Revoke every sign-in, including the current one |

Refresh rotates the refresh token and drops the old one. Every access token carries the `sign_in_id` claim, and the gateway immediately rejects access tokens of a revoked sign-in. The org-split cutover revokes every earlier token, so no access token without `sign_in_id` remains. `@rixl/sdk` exposes none of this, because the published OpenAPI spec it is generated from lacks these routes.

## What Changes

- Get the four routes into the OpenAPI document the SDK is generated from (`rixlhq/openapi`, fed by the gateway docs), then regenerate the client.
- Add hand-written SDK functions and types:
  - `listSignedInDevices()` returns the user's sign-ins, most recently used first. Each entry has an id, created / last-used / expiry times, sign-in method, user agent, IP, country, and a `current` flag.
  - `signOutDevice(id)` revokes one sign-in. Revoking the current one behaves like `logout()`: local tokens are cleared and the logout is announced to other tabs.
  - `signOutOtherDevices()` revokes every sign-in except the current one.
  - `signOutEverywhere()` revokes every sign-in, then clears local state like `logout()`.
- A parsed device summary (browser, OS, device type) is derived from the user agent in the SDK, so every client shows the same labels.

## Capabilities

### New Capabilities

- `signed-in-devices`: listing the user's signed-in devices and signing them out from the SDK.

### Modified Capabilities

None.

## Non-goals

- No change to auth-api's endpoints or token behavior. The route rename is auth-api's `rename-sessions-to-sign-ins` change.
- No dashboard UI (the `dashboard` repo's `add-signed-in-devices` change).
- No device naming or trusted-device features.

## Impact

- `src/generated/*` (regenerated), a new `src/auth/devices/` module, exports from `src/auth/index.ts`.
- Pipeline: the gateway OpenAPI docs and `rixlhq/openapi` must include the token-service sign-in routes.
- Depends on auth-api `rename-sessions-to-sign-ins` and the gateway publishing its routes.
