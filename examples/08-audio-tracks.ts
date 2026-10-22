import {readFile} from "node:fs/promises";
import {basename} from "node:path";

import {
  createClient,
  videosV1AudioTrackServiceCreateAudioTrackUpload,
  videosV1AudioTrackServiceDeleteAllAudioTracks,
  videosV1AudioTrackServiceDeleteAudioTrack,
  videosV1AudioTrackServiceDeleteAudioTracksByLanguage,
  videosV1AudioTrackServiceListAudioTracks,
} from "@rixl/sdk";

import {assertDestructiveEnabled, optionalEnv, requiredEnv} from "./shared";

const client = createClient({
  auth: requiredEnv("RIXL_API_KEY"),
  baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com/",
});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to your Rixl project ID.");
const videoId = requiredEnv("RIXL_VIDEO_ID", "Set it to a video ID to attach audio tracks to.");
const audioFilePath = requiredEnv("RIXL_AUDIO_FILE", "Set it to a path to an audio file on disk.");
const langCode = requiredEnv("RIXL_AUDIO_LANGUAGE_CODE", "Set it to a BCP 47 language code, e.g. en-US.");

// 1. List existing audio tracks.
const existing = await videosV1AudioTrackServiceListAudioTracks({
  client,
  path: {video_id: videoId},
});

console.log(`Video ${videoId} currently has ${existing.data?.audio_tracks?.length ?? 0} audio tracks.`);

// 2. Request a track upload URL.
const uploadInit = await videosV1AudioTrackServiceCreateAudioTrackUpload({
  client,
  path: {project_id: projectId, video_id: videoId},
  body: {
    items: [
      {
        language_code: langCode,
        label: `Audio (${langCode})`,
        file_name: basename(audioFilePath),
      },
    ],
  },
});

if (uploadInit.error) {
  console.error(`Audio track upload init failed (${uploadInit.response?.status ?? "no response"}):`, uploadInit.error);
  process.exit(1);
}

const target = uploadInit.data?.targets?.[0];
if (!target?.upload_url) {
  console.error("No upload target returned.");
  process.exit(1);
}

// 3. Upload audio file bytes.
const audioBytes = await readFile(audioFilePath);
const uploadRes = await fetch(target.upload_url, {
  method: "PUT",
  body: audioBytes,
});

if (!uploadRes.ok) {
  console.error(`Audio PUT failed (${uploadRes.status} ${uploadRes.statusText}).`);
  process.exit(1);
}

console.log(`Audio track uploaded for ${langCode}: track_id=${target.id ?? "?"}.`);

// 4. Destructive: delete a specific track by ID.
const trackId = optionalEnv("RIXL_AUDIO_TRACK_ID");

if (!trackId) {
  console.log("Skipping delete-by-id: set RIXL_AUDIO_TRACK_ID to delete one specific track.");
} else {
  assertDestructiveEnabled(`Deleting audio track ${trackId}`);

  const deleted = await videosV1AudioTrackServiceDeleteAudioTrack({
    client,
    path: {project_id: projectId, video_id: videoId, track_id: trackId},
  });

  if (deleted.error) {
    console.error(`Delete track failed (${deleted.response?.status ?? "no response"}):`, deleted.error);
    process.exit(1);
  }

  console.log(`Deleted audio track ${trackId}.`);
}

// 5. Destructive: delete every track for a given language.
if (optionalEnv("RIXL_RUN_DESTRUCTIVE") !== "1") {
  console.log("Skipping delete-by-language: set RIXL_RUN_DESTRUCTIVE=1 to delete tracks by language.");
} else {
  assertDestructiveEnabled(`Deleting all ${langCode} audio tracks on video ${videoId}`);

  const deletedLang = await videosV1AudioTrackServiceDeleteAudioTracksByLanguage({
    client,
    path: {project_id: projectId, video_id: videoId, language_code: langCode},
  });

  if (deletedLang.error) {
    console.error(`Delete by language failed (${deletedLang.response?.status ?? "no response"}):`, deletedLang.error);
    process.exit(1);
  }

  console.log(`Deleted all audio tracks for ${langCode}.`);

  // 6. Destructive: delete every audio track on the video.
  assertDestructiveEnabled(`Deleting all audio tracks on video ${videoId}`);

  const deletedAll = await videosV1AudioTrackServiceDeleteAllAudioTracks({
    client,
    path: {project_id: projectId, video_id: videoId},
  });

  if (deletedAll.error) {
    console.error(`Delete all audio tracks failed (${deletedAll.response?.status ?? "no response"}):`, deletedAll.error);
    process.exit(1);
  }

  console.log(`Deleted all audio tracks on video ${videoId}.`);
}
