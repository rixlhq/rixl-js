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

Requires Node.js 18+. ESM only.

## Quick Start

```ts
import {createClient, imagesV1ImageServiceListImages} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  auth: process.env.RIXL_API_KEY,
});

const {data, error} = await imagesV1ImageServiceListImages({
  client,
  path: {project_id: "your_project_id"},
  query: {"pagination.limit": 10},
});

if (error) {
  console.error("Failed to list images:", error);
} else {
  console.log(data?.images?.map((image) => image.id));
}
```

`auth` can be either a string or a function, so you can plug in API keys, bearer tokens, or runtime token refresh logic.

## Feed API

Fetch a feed and read posts:

```ts
import {createClient, postsV1PostServiceListPosts3} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
});

const {data, error} = await postsV1PostServiceListPosts3({
  client,
  path: {feed_id: "FD4y3QB38S"},
});

for (const post of data?.posts ?? []) {
  console.log(post.id, post.creator_id);
}
```

## Image API

List images and fetch one by ID:

```ts
import {createClient, imagesV1ImageServiceGetImage, imagesV1ImageServiceListImages} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  auth: process.env.RIXL_API_KEY,
});

const list = await imagesV1ImageServiceListImages({
  client,
  path: {project_id: "your_project_id"},
  query: {"pagination.limit": 25},
});

const image = await imagesV1ImageServiceGetImage({
  client,
  path: {image_id: "PS5IMKoFLm"},
});

console.log(list.data?.images?.length, image.data?.image?.id);
```

Initialize an upload and PUT the bytes to storage:

```ts
import {createClient, imagesV1ImageServiceCreateImageUpload} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  auth: process.env.RIXL_API_KEY,
});

const init = await imagesV1ImageServiceCreateImageUpload({
  client,
  path: {project_id: "your_project_id"},
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
import {createClient, videosV1VideoServiceGetVideo, videosV1VideoServiceListVideos} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  auth: process.env.RIXL_API_KEY,
});

const page = await videosV1VideoServiceListVideos({
  client,
  path: {project_id: "your_project_id"},
  query: {"pagination.limit": 25},
});

const video = await videosV1VideoServiceGetVideo({
  client,
  path: {video_id: "VI9VXQxWXQ"},
});

console.log(page.data?.videos?.length, video.data?.video?.id, video.data?.video?.duration);
```

Video uploads request presigned URLs for both the video and its poster:

```ts
import {createClient, videosV1VideoServiceCreateVideoUpload} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  auth: process.env.RIXL_API_KEY,
});

const init = await videosV1VideoServiceCreateVideoUpload({
  client,
  path: {project_id: "your_project_id"},
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
