# Proposal

## Why

Users can't see where they're signed in or sign out a lost device. auth-api stores each refresh-token family as a **sign-in** and, after its `rename-sessions-to-sign-ins` change, exposes these account-scoped routes:

| Endpoint                                | auth-api RPC         | What it does                                                   |
| --------------------------------------- | -------------------- | -------------------------------------------------------------- |
| `GET /auth/v1/sign-ins`                 | `ListSignIns`        | List the user's sign-ins, most recently used first             |
| `DELETE /auth/v1/sign-ins/{sign_in_id}` | `RevokeSignIn`       | Revoke one sign-in                                             |
| `POST /auth/v1/sign-ins/revoke-others`  | `RevokeOtherSignIns` | Revoke every sign-in except the current one                    |
| `POST /auth/v1/logout/all`              | `LogoutAll`          | Revoke every sign-in, including the current one, and its token |

Refresh rotates the refresh token and drops the old one. Every access token carries the `sign_in_id` claim, and the gateway rejects a revoked sign-in's access tokens on their next request. The org-split cutover revokes every earlier token, so no access token without `sign_in_id` remains. `@rixl/sdk` exposes none of this, because the published OpenAPI document it is generated from lacks these routes.

## What Changes

- Get the four routes into the OpenAPI document the SDK is generated from (`rixlhq/openapi`, a copy of the gateway's `docs/`), then regenerate the client.
- Add hand-written SDK functions named after the auth-api RPCs:
  - `listSignIns()` returns the user's sign-ins, most recently used first. Each `SignIn` has `id`, `auth_method`, `user_agent`, `ip`, `country`, `created_at`, `last_used_at`, `expires_at`, `current`, and a parsed `device` summary.
  - `revokeSignIn(signInId)` revokes one sign-in. Revoking the current one also clears local state like `logout()`.
  - `revokeOtherSignIns()` revokes every sign-in except the current one.
  - `logoutAll()` revokes every sign-in including the current one, then clears local state like `logout()`, even when the request fails.
- A parsed device summary (browser, OS, device type) is derived from the user agent in the SDK, so every client shows the same labels.

## Capabilities

### New Capabilities

- `sign-ins`: listing the user's sign-ins and revoking one, all others, or all of them from the SDK.

### Modified Capabilities

None.

## Non-goals

- No change to auth-api's endpoints or token behavior.
- No UI. "Signed-in devices" is the dashboard's label (dashboard change `add-signed-in-devices`).
- No device naming or trusted-device features.

## Impact

- `src/generated/*` (regenerated), a new `src/auth/sign-ins/` module, exports from `src/auth/index.ts` and `src/index.ts`. Adding exports is not breaking.
- Pipeline: gateway change `adopt-organization-context` (gateway#178) publishes the routes in `docs/`, and `rixlhq/openapi` copies them.
- Depends on auth-api `rename-sessions-to-sign-ins` and gateway `adopt-organization-context`.
