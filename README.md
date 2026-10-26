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

## Compatibility

`@rixl/sdk` is the supported Rixl SDK. It targets Rixl API **v1** and is generated from [rixlhq/openapi](https://github.com/rixlhq/openapi). While the package is 0.x, a minor release may contain breaking changes; check the [CHANGELOG](CHANGELOG.md) before upgrading.

The API contract is documented once, in the Rixl docs:

- [Versioning and deprecation](https://docs.rixl.com/en/home/platform/api-documentation/versioning)
- [Errors, retries and idempotency](https://docs.rixl.com/en/home/platform/api-documentation/error-handling)
- [Pagination](https://docs.rixl.com/en/home/platform/api-documentation/pagination)

## Development

This repository uses [Vite+](https://viteplus.dev/guide/) as the unified toolchain and package manager wrapper, with Bun underneath.

```bash
vp install # Install dependencies
vp pack    # Build the library
vp check   # Run formatting, linting, and type checks
vp test    # Run Vitest test suite
```

## Issues

[github.com/rixlhq/rixl-js/issues](https://github.com/rixlhq/rixl-js/issues)
