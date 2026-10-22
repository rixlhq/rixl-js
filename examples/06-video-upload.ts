import {readFile} from "node:fs/promises";
import {basename} from "node:path";

import type {CommonV1VideoQuality} from "@rixl/sdk";
import {createClient, videosV1VideoServiceCreateVideoUpload} from "@rixl/sdk";

import {optionalEnv, requiredEnv} from "./shared";

const VIDEO_QUALITIES = [
  "VIDEO_QUALITY_BASIC",
  "VIDEO_QUALITY_SHORTS",
  "VIDEO_QUALITY_PRO",
] as const satisfies ReadonlyArray<CommonV1VideoQuality>;

const client = createClient({
  auth: requiredEnv("RIXL_API_KEY"),
  baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com/",
});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to your Rixl project ID.");
const videoFile = requiredEnv("RIXL_VIDEO_FILE", "Set it to a path to a local video file.");
const posterFile = requiredEnv("RIXL_POSTER_FILE", "Set it to a path to a local poster image.");

const rawQuality = optionalEnv("RIXL_VIDEO_QUALITY");
let quality: CommonV1VideoQuality | undefined;

if (rawQuality) {
  if (!(VIDEO_QUALITIES as ReadonlyArray<string>).includes(rawQuality)) {
    console.error(`RIXL_VIDEO_QUALITY must be one of: ${VIDEO_QUALITIES.join(", ")}.`);
    process.exit(1);
  }
  quality = rawQuality as CommonV1VideoQuality;
}

// 1. Ask the API for presigned URLs for both the video and its poster image.
const init = await videosV1VideoServiceCreateVideoUpload({
  client,
  path: {project_id: projectId},
  body: {
    name: basename(videoFile),
    video_quality: quality,
  },
});

if (init.error) {
  console.error(`Video upload init failed (${init.response?.status ?? "no response"}):`, init.error);
  process.exit(1);
}

const {video_id: videoId, video_upload_url: videoUrl, poster_upload_url: posterUrl} = init.data ?? {};

if (!videoId || !videoUrl || !posterUrl) {
  console.error("Upload init succeeded but did not return video_id, video_upload_url, and poster_upload_url.");
  process.exit(1);
}

console.log(`Init: video_id=${videoId}`);

// 2. Upload both files in parallel with native fetch — these go to object
//    storage directly and do not pass through the SDK.
const [videoBytes, posterBytes] = await Promise.all([readFile(videoFile), readFile(posterFile)]);

const [videoUpload, posterUpload] = await Promise.all([
  fetch(videoUrl, {method: "PUT", body: videoBytes}),
  fetch(posterUrl, {method: "PUT", body: posterBytes}),
]);

if (!videoUpload.ok) {
  console.error(`Video PUT failed (${videoUpload.status} ${videoUpload.statusText}).`);
  process.exit(1);
}

if (!posterUpload.ok) {
  console.error(`Poster PUT failed (${posterUpload.status} ${posterUpload.statusText}).`);
  process.exit(1);
}

console.log(`Uploaded video (${videoBytes.byteLength} bytes) and poster (${posterBytes.byteLength} bytes).`);
console.log(`Video ${videoId} uploaded successfully.`);
