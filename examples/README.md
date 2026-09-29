# Rixl SDK examples

Runnable TypeScript examples for `@rixl/sdk`.

Each example is a small, self-contained script. The client is constructed inline and the Hey API `{ data, error, response }` result tuple is handled inline — copy any example into your own project and it will work with minimal edits.

## Setup

Build the local package entrypoint before running examples from this repository:

```bash
vp install
vp pack
```

Set a Rixl API key:

```bash
export RIXL_API_KEY="rk_..."
```

## Base URL

> **Examples target production (`https://api.rixl.com/`) by default.** Destructive examples will hit your real account unless you override the base URL.

To target another environment:

```bash
export RIXL_BASE_URL="https://api.staging.rixl.com/"
```

## Destructive operations

Examples that delete or replace existing resources refuse to run unless you opt in:

```bash
export RIXL_RUN_DESTRUCTIVE=1
```

Without this flag the destructive code paths throw a clear error and exit.

## Available examples

```bash
node examples/01-client-setup.ts
node examples/02-public-feeds.ts
node examples/03-image-management.ts
node examples/04-image-upload.ts
node examples/05-video-management.ts
node examples/06-video-upload.ts
node examples/07-video-chapters.ts
node examples/08-audio-tracks.ts
node examples/09-subtitles.ts
```

`02-public-feeds.ts` requires `RIXL_FEED_ID`, `RIXL_POST_ID`, and `RIXL_CREATOR_ID`. It does not need `RIXL_API_KEY` — public feed endpoints are unauthenticated.

`03-image-management.ts` requires `RIXL_API_KEY` and `RIXL_IMAGE_ID`. To exercise the delete path, also set `RIXL_DELETE_IMAGE_ID` and `RIXL_RUN_DESTRUCTIVE=1`.

`04-image-upload.ts` requires `RIXL_API_KEY` and `RIXL_IMAGE_FILE` (a path to a local image). Optionally set `RIXL_IMAGE_FORMAT` to override the format inferred from the file extension.

`05-video-management.ts` requires `RIXL_API_KEY` and `RIXL_VIDEO_ID`. Optionally set `RIXL_THUMBNAIL_FILE` to update the thumbnail. To exercise the delete path, set `RIXL_DELETE_VIDEO_ID` and `RIXL_RUN_DESTRUCTIVE=1`.

## Typecheck

```bash
vp run examples:check
```
