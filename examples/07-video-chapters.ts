import {
  client,
  connect,
  videosV1ChapterServiceGetVideoChapters,
  videosV1ChapterServiceUpdateVideoChapters,
  videosV1ChapterServiceUpdateVideoChapters2,
} from "@rixl/sdk";

import {assertDestructiveEnabled, optionalEnv, requiredEnv} from "./shared";

await connect({baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": requiredEnv("RIXL_API_KEY")}});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to your Rixl project ID.");
const videoId = requiredEnv("RIXL_VIDEO_ID", "Set it to a video ID to manage chapters for.");

// 1. Replace the chapter list.
const updated = await videosV1ChapterServiceUpdateVideoChapters({
  path: {project_id: projectId, video_id: videoId},
  body: {
    chapters: [
      {start_time_sec: 0, title: "Intro"},
      {start_time_sec: 30, title: "Main content"},
      {start_time_sec: 120, title: "Outro"},
    ],
  },
});

if (updated.error) {
  console.error(`Update chapters failed (${updated.response?.status ?? "no response"}):`, updated.error);
  process.exit(1);
}

const chapters = updated.data?.chapters ?? [];
console.log(`Set ${chapters.length} chapters on video:`);
for (const chapter of chapters) {
  console.log(`  - [${chapter.start_time_sec ?? "?"}s] ${chapter.title ?? "(untitled)"}`);
}

// 2. Fetch chapters.
const fetched = await videosV1ChapterServiceGetVideoChapters({
  path: {project_id: projectId, video_id: videoId},
});

if (fetched.data?.chapters) {
  console.log(`Fetched ${fetched.data.chapters.length} chapters.`);
}

// 3. Clear all chapters — destructive.
if (optionalEnv("RIXL_RUN_DESTRUCTIVE") !== "1") {
  console.log("Skipping clear: set RIXL_RUN_DESTRUCTIVE=1 to clear all chapters.");
} else {
  assertDestructiveEnabled(`Clearing chapters on video ${videoId}`);

  const cleared = await videosV1ChapterServiceUpdateVideoChapters2({
    path: {project_id: projectId, video_id: videoId},
  });

  if (cleared.error) {
    console.error(`Clear chapters failed (${cleared.response?.status ?? "no response"}):`, cleared.error);
    process.exit(1);
  }

  console.log(`Cleared chapters on video ${videoId}.`);
}
