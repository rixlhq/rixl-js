# Rixl SDK examples

Runnable TypeScript examples for `@rixl/sdk`.

Each example is a self-contained script. It calls `connect({baseUrl})`, sends the API key in the `X-API-Key` header via `client.setConfig`, and handles the `{ data, error, response }` result inline.

## Setup

Build the local package entrypoint before running examples from this repository:

```bash
vp install
vp pack
```

Set your Rixl API key and project ID:

```bash
export RIXL_API_KEY="rk_..."
export RIXL_PROJECT_ID="proj_..."
```

## Base URL

> **Examples target production (`https://api.rixl.com`) by default.** Destructive examples will hit your real account unless you override the base URL.

To target another environment:

```bash
export RIXL_BASE_URL="https://api.staging.rixl.com"
```

## Destructive operations

Examples that delete or replace existing resources refuse to run unless you opt in:

```bash
export RIXL_RUN_DESTRUCTIVE=1
```

Without this flag the destructive code paths throw a clear error and exit.

## Available examples

```bash
bun examples/01-client-setup.ts
bun examples/02-public-feeds.ts
bun examples/03-image-management.ts
bun examples/04-image-upload.ts
bun examples/05-video-management.ts
bun examples/06-video-upload.ts
bun examples/07-video-chapters.ts
bun examples/08-audio-tracks.ts
bun examples/09-subtitles.ts
bun examples/10-pagination.ts
```

- `01-client-setup.ts` requires `RIXL_API_KEY` and `RIXL_PROJECT_ID`.
- `02-public-feeds.ts` requires `RIXL_FEED_ID`, `RIXL_POST_ID`, and `RIXL_CREATOR_ID`. It does not need `RIXL_API_KEY` — public feed endpoints are unauthenticated.
- `03-image-management.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, and `RIXL_IMAGE_ID`. To exercise the delete path, also set `RIXL_DELETE_IMAGE_ID` and `RIXL_RUN_DESTRUCTIVE=1`.
- `04-image-upload.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, and `RIXL_IMAGE_FILE` (a path to a local image).
- `05-video-management.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, and `RIXL_VIDEO_ID`. Optionally set `RIXL_UPDATE_VISIBILITY=1` to update video visibility. To exercise the delete path, set `RIXL_DELETE_VIDEO_ID` and `RIXL_RUN_DESTRUCTIVE=1`.
- `06-video-upload.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, `RIXL_VIDEO_FILE`, and `RIXL_POSTER_FILE`.
- `07-video-chapters.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, and `RIXL_VIDEO_ID`.
- `08-audio-tracks.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, `RIXL_VIDEO_ID`, `RIXL_AUDIO_FILE`, and `RIXL_AUDIO_LANGUAGE_CODE`.
- `09-subtitles.ts` requires `RIXL_API_KEY`, `RIXL_PROJECT_ID`, `RIXL_VIDEO_ID`, `RIXL_SUBTITLE_FILE`, and `RIXL_SUBTITLE_LANGUAGE_CODE`.
- `10-pagination.ts` requires `RIXL_API_KEY` and `RIXL_PROJECT_ID`.

## Typecheck

```bash
vp run examples:check
```
