# @rixl/sdk

Official TypeScript / JavaScript SDK for the [Rixl](https://rixl.com) REST API.

Published on npm as [`@rixl/sdk`](https://www.npmjs.com/package/@rixl/sdk).

[![npm](https://img.shields.io/npm/v/@rixl/sdk.svg)](https://www.npmjs.com/package/@rixl/sdk)

## Install

| **Tool**  | **Command**        |
| --------- | ------------------ |
| npm       | `npm i @rixl/sdk`  |
| pnpm      | `pnpm i @rixl/sdk` |
| bun       | `bun i @rixl/sdk`  |
| vite plus | `vp i @rixl/sdk`   |

Requires Node.js 24+. ESM only.

## Quick Start

```ts
import {client, connect, imagesV1ImageServiceListImages} from "@rixl/sdk";

await connect({baseUrl: "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": process.env.RIXL_API_KEY!}});

const {data, error} = await imagesV1ImageServiceListImages({
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  query: {"pagination.limit": 10},
});

if (error) {
  console.error("Failed to list images:", error);
} else {
  console.log(data?.images?.map((image) => image.id));
}
```

`connect()` configures every generated request function, so calls don't take a `client` argument. Send server-side API keys in the `X-API-Key` header as shown. Don't use `connect({apiKey})`: the gateway rejects the token it exchanges the key for. Pass `token` to `connect()` to use a bearer token you already hold. Most project-scoped operations need a `project_id`; copy it from the dashboard into `RIXL_PROJECT_ID`.

## Feed API

Fetch a feed and read posts:

```ts
import {connect, postsV1PostServiceListPosts3} from "@rixl/sdk";

// Public feeds need no API key.
await connect({baseUrl: "https://api.rixl.com"});

const {data, error} = await postsV1PostServiceListPosts3({
  path: {feed_id: "FD4y3QB38S"},
});

if (error) {
  console.error("Failed to list posts:", error);
}

for (const post of data?.posts ?? []) {
  console.log(post.id, post.creator_id);
}
```

## Image API

List images and fetch one by ID:

```ts
import {client, connect, imagesV1ImageServiceGetImage, imagesV1ImageServiceListImages} from "@rixl/sdk";

await connect({baseUrl: "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": process.env.RIXL_API_KEY!}});

const list = await imagesV1ImageServiceListImages({
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  query: {"pagination.limit": 25},
});

const image = await imagesV1ImageServiceGetImage({
  path: {image_id: "PS5IMKoFLm"},
});

console.log(list.data?.images?.length, image.data?.image?.id);
```

Initialize an upload and PUT the bytes to storage:

```ts
import {client, connect, imagesV1ImageServiceCreateImageUpload} from "@rixl/sdk";

await connect({baseUrl: "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": process.env.RIXL_API_KEY!}});

const init = await imagesV1ImageServiceCreateImageUpload({
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  body: {name: "photo.jpg"},
});

await fetch(init.data?.upload_url!, {
  method: "PUT",
  body: imageBytes,
  headers: {"Content-Type": "image/jpeg"},
});

console.log(`Image ${init.data?.image_id} uploaded.`);
```

## Video API

List videos and fetch one by ID:

```ts
import {client, connect, videosV1VideoServiceGetVideo, videosV1VideoServiceListVideos} from "@rixl/sdk";

await connect({baseUrl: "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": process.env.RIXL_API_KEY!}});

const page = await videosV1VideoServiceListVideos({
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  query: {"pagination.limit": 25},
});

const video = await videosV1VideoServiceGetVideo({
  path: {video_id: "VI9VXQxWXQ"},
});

console.log(page.data?.videos?.length, video.data?.video?.id, video.data?.video?.duration);
```

To walk every page, advance `pagination.offset` until `offset + videos.length >= total`; see [examples/10-pagination.ts](examples/10-pagination.ts).

Video uploads request presigned URLs for both the video and its poster:

```ts
import {client, connect, videosV1VideoServiceCreateVideoUpload} from "@rixl/sdk";

await connect({baseUrl: "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": process.env.RIXL_API_KEY!}});

const init = await videosV1VideoServiceCreateVideoUpload({
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  body: {
    name: "clip.mp4",
    video_quality: "VIDEO_QUALITY_PRO",
  },
});

await Promise.all([
  fetch(init.data?.video_upload_url!, {
    method: "PUT",
    body: videoBytes,
    headers: {"Content-Type": "video/mp4"},
  }),
  fetch(init.data?.poster_upload_url!, {
    method: "PUT",
    body: posterBytes,
    headers: {"Content-Type": "image/jpeg"},
  }),
]);

console.log(`Video ${init.data?.video_id} uploaded.`);
```

More runnable scripts live in [examples/](examples/README.md).

## Organizations

In a browser app, an access token is for exactly one organization. An org ID is never a user ID.

```ts
import {ApiError, OrgAccessError, connect, orgContext, resolvePermissions, selectOrganization} from "@rixl/sdk";

// Run once at startup, before wiring up the organization picker.
try {
  await connect({baseUrl: "https://api.rixl.com", auth: {}});
} catch (error) {
  if (error instanceof ApiError && error.status === 401) {
    // Show sign-in.
  } else if (!(error instanceof OrgAccessError)) {
    throw error;
  }
}

async function openOrganization(orgId: string) {
  try {
    await selectOrganization(orgId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    if (!(error instanceof OrgAccessError)) throw error;
    console.warn(error.orgId, error.reason);
    return "not-switched";
  }

  // Render the new org now. Permission loading can be retried separately.
  console.log(orgContext.get());
  try {
    await resolvePermissions();
    return "ready";
  } catch {
    return "permissions-pending";
  }
}
```

- Sign-in issues a token for the user's personal org. Capture the in-memory `lastActiveOrgId` hint from the sign-in response before any reload, or keep your own org preference. A refresh updates the server’s last active org. To use the saved org, select it explicitly. `personalOrgId` is the personal org.
- A tab's org, permissions and user belong to one sign-in. When another tab signs in, as the same user or another, this tab drops them and moves to the new sign-in's personal org on its next call.
- A stored sign-in the SDK can't refresh, such as one from before organizations, is signed out.
- When auth-api refuses the refresh token (revoked, expired or an inactive account), the call rejects with a 401 `ApiError`, including `connect()`. The SDK removes the stored sign-in, so the next page load starts with `isLogged` false.
- Each tab has its own org and access token, and keeps its org across a reload. Tabs share the refresh token and the `signIn`, `personalOrgId`, `isLogged` and temporary `refusedSignIn` cookies, as well as `limitedAccessToken` and `requiresAction` during a limited-access flow. A tab that never selected an org uses the personal org.
- `orgContext.get()?.role` is for display. Authorize with permissions (`resolvePermissions`, `hasPermission`).
- A refresh into an org the user can't act in rejects with `OrgAccessError`; `reason` is `MEMBERSHIP_SUSPENDED`, `ORG_DELETED` or `NOT_A_MEMBER`. The user stays signed in.
- A request that needs the tab's org can reject with it too. When the gateway refuses the tab's own token with one of these reasons, the SDK stops using that token and treats the tab's org as after a refused refresh. Other API failures reject with `ApiError` (`status`, and the error body in `data`). So does a reason from a route that acts on your account, such as listing organizations or answering an invitation: it isn't about the tab's org, and the tab doesn't change.
- When `getToken()` is refused for the tab's own org with `NOT_A_MEMBER` or `ORG_DELETED`, the tab drops that org and keeps rejecting, also after a reload, until `selectOrganization` succeeds. The SDK never picks another org. `connect()` with `auth` ends with `getToken()`, so it rejects the same way: catch it. A suspended tab keeps its org and can refresh into it once the membership is restored. Call `resolvePermissions()` again after recovery.
- Subscribe to the read-only `orgRefusal` store for refusals of this tab's org. It exposes `{reason, orgId}` while the tab is signed in and awaiting a usable access token. It becomes undefined on sign-out, including after a final refresh 401. Meanwhile `orgContext` is undefined, because the tab has no token. Suspension clears this tab's permissions; the tab keeps the org, which `orgRefusal.orgId` names, and refreshes into it again.
- A refused tab has no usable token, so `listOrganizations()` rejects too. To show an org picker, call `selectOrganization(personalOrgId.get()!)` first.
- `logout()` clears browser state and tells matching tabs before returning its promise. It then makes one revocation request with the saved credentials. `const {revoked} = await logout()` reports only whether auth-api acknowledged it within five seconds. Sign-in-wide revocation of rotated credentials requires auth-api support for the access token’s `sign_in_id` (OpenSpec task 10.2). The browser stays signed out even if `revoked` is false.
- `listPendingMemberships()` can display pending invitations. In-app responses await the account-scoped invitation routes in OpenSpec task 2.8.
- To leave an org, call `selectOrganization(orgId)`, then `leaveOrganization(orgId)`, then select another org such as `personalOrgId.get()!`. A successful leave clears that tab’s org, access token and permissions. The tab stays signed in. While `orgSelectionRequired` is true, including after a reload, `getToken()` resolves undefined and authenticated requests need a new org selection. Offer the personal org or another known org, then load the picker.
- Verify a pending signup with `verifyEmailWithCode({verification_id, code})`. Resending needs the email and the signup’s verification ID. Password login before verification reports invalid credentials.
- Verify an account email change with `verifyEmailChange(verificationId, code)`. The SDK uses the caller’s full or limited-access credentials and keeps the same sign-in and org.
- A request that names an org, such as `getOrganization` or `updateOrganization`, needs a token for that org: select it first.

[examples/11-organizations.ts](examples/11-organizations.ts) shows the whole flow: switching with a permissions retry, a screen for a suspended or lost org, a paged org picker, and reading and renaming an org.

## Compatibility

`@rixl/sdk` is the supported Rixl SDK. It targets Rixl API **v1** and is generated from [rixlhq/openapi](https://github.com/rixlhq/openapi). While the package is 0.x, a minor release may contain breaking changes; check the [CHANGELOG](CHANGELOG.md) before upgrading.

The API contract is documented once, in the Rixl docs:

- [Versioning and deprecation](https://docs.rixl.com/en/home/platform/api-documentation/versioning)
- [Errors, retries and idempotency](https://docs.rixl.com/en/home/platform/api-documentation/error-handling)
- [Pagination](https://docs.rixl.com/en/home/platform/api-documentation/pagination)

## Development

This repository uses [Vite+](https://viteplus.dev/guide/) as the unified toolchain and package manager wrapper, with Bun underneath.

```bash
vp install         # Install dependencies
vp pack            # Build the library
vp check           # Run formatting, linting, and type checks
vp test            # Run Vitest test suite
vp run ci          # The full gate the release job runs before publishing
vp run generate    # Regenerate src/generated from rixlhq/openapi
```

`src/generated/` is rebuilt from the API spec and opened as a PR automatically; don't edit it by hand. The release workflow runs `vp run ci` on every PR and on `main` before `npm publish`. Contributor and agent rules are in `AGENTS.md` and `.agents/rules/`.

## Issues

[github.com/rixlhq/rixl-js/issues](https://github.com/rixlhq/rixl-js/issues)
