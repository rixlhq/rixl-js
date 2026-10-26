import {readFile} from "node:fs/promises";
import {basename} from "node:path";

import type {VideosV1Language} from "@rixl/sdk";
import {
  client,
  connect,
  videosV1LanguageServiceListLanguages,
  videosV1SubtitleServiceCreateSubtitleUpload,
  videosV1SubtitleServiceDeleteAllSubtitles,
  videosV1SubtitleServiceDeleteSubtitle,
  videosV1SubtitleServiceDeleteSubtitlesByLanguage,
  videosV1SubtitleServiceListSubtitles,
} from "@rixl/sdk";

import {assertDestructiveEnabled, optionalEnv, requiredEnv} from "./shared";

await connect({baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": requiredEnv("RIXL_API_KEY")}});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to your Rixl project ID.");
const videoId = requiredEnv("RIXL_VIDEO_ID", "Set it to a video ID to attach subtitles to.");
const subtitleFilePath = requiredEnv("RIXL_SUBTITLE_FILE", "Set it to a path to a subtitle file (e.g. .vtt).");
const langCode = requiredEnv("RIXL_SUBTITLE_LANGUAGE_CODE", "Set it to a BCP 47 language code, e.g. en-US.");

// 1. List supported subtitle languages.
const langs = await videosV1LanguageServiceListLanguages();

if (langs.error) {
  console.error(`List languages failed (${langs.response?.status ?? "no response"}):`, langs.error);
  process.exit(1);
}

const supported = langs.data?.languages ?? [];
console.log(`API supports ${supported.length} subtitle languages.`);

if (supported.length > 0 && !supported.some((lang: VideosV1Language) => lang.code === langCode)) {
  console.warn(`Warning: ${langCode} is not in the supported language list — the upload may fail.`);
}

// 2. List existing subtitles on the video.
const existing = await videosV1SubtitleServiceListSubtitles({
  path: {video_id: videoId},
});

console.log(`Video ${videoId} currently has ${existing.data?.subtitles?.length ?? 0} subtitle tracks.`);

// 3. Request a subtitle upload URL.
const uploadInit = await videosV1SubtitleServiceCreateSubtitleUpload({
  path: {project_id: projectId, video_id: videoId},
  body: {
    items: [
      {
        language_code: langCode,
        label: `Subtitles (${langCode})`,
        file_name: basename(subtitleFilePath),
      },
    ],
  },
});

if (uploadInit.error) {
  console.error(`Subtitle upload init failed (${uploadInit.response?.status ?? "no response"}):`, uploadInit.error);
  process.exit(1);
}

const target = uploadInit.data?.targets?.[0];
if (!target?.upload_url) {
  console.error("No upload target returned.");
  process.exit(1);
}

// 4. Upload subtitle file bytes.
const subtitleBytes = await readFile(subtitleFilePath);
const uploadRes = await fetch(target.upload_url, {
  method: "PUT",
  body: subtitleBytes,
});

if (!uploadRes.ok) {
  console.error(`Subtitle PUT failed (${uploadRes.status} ${uploadRes.statusText}).`);
  process.exit(1);
}

console.log(`Subtitles uploaded for ${langCode}: track_id=${target.id ?? "?"}.`);

// 5. Destructive: delete a specific subtitle by ID.
const subtitleId = optionalEnv("RIXL_SUBTITLE_ID");

if (!subtitleId) {
  console.log("Skipping delete-by-id: set RIXL_SUBTITLE_ID to delete one specific subtitle.");
} else {
  assertDestructiveEnabled(`Deleting subtitle ${subtitleId}`);

  const deleted = await videosV1SubtitleServiceDeleteSubtitle({
    path: {project_id: projectId, video_id: videoId, subtitle_id: subtitleId},
  });

  if (deleted.error) {
    console.error(`Delete subtitle failed (${deleted.response?.status ?? "no response"}):`, deleted.error);
    process.exit(1);
  }

  console.log(`Deleted subtitle ${subtitleId}.`);
}

// 6. Destructive: delete every subtitle for a given language, then all subtitles.
if (optionalEnv("RIXL_RUN_DESTRUCTIVE") !== "1") {
  console.log("Skipping delete-by-language and delete-all: set RIXL_RUN_DESTRUCTIVE=1 to run them.");
} else {
  assertDestructiveEnabled(`Deleting all ${langCode} subtitles on video ${videoId}`);

  const deletedLang = await videosV1SubtitleServiceDeleteSubtitlesByLanguage({
    path: {project_id: projectId, video_id: videoId, language_code: langCode},
  });

  if (deletedLang.error) {
    console.error(`Delete by language failed (${deletedLang.response?.status ?? "no response"}):`, deletedLang.error);
    process.exit(1);
  }

  console.log(`Deleted all subtitles for ${langCode}.`);

  assertDestructiveEnabled(`Deleting all subtitles on video ${videoId}`);

  const deletedAll = await videosV1SubtitleServiceDeleteAllSubtitles({
    path: {project_id: projectId, video_id: videoId},
  });

  if (deletedAll.error) {
    console.error(`Delete all subtitles failed (${deletedAll.response?.status ?? "no response"}):`, deletedAll.error);
    process.exit(1);
  }

  console.log(`Deleted all subtitles on video ${videoId}.`);
}
