import {
  createClient,
  videosV1VideoServiceDeleteVideo,
  videosV1VideoServiceGetVideo,
  videosV1VideoServiceListVideos,
  videosV1VideoServiceUpdateVideoVisibility,
} from "@rixl/sdk";

import {assertDestructiveEnabled, optionalEnv, requiredEnv} from "./shared";

const client = createClient({
  auth: requiredEnv("RIXL_API_KEY"),
  baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com/",
});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to a Rixl project ID.");

// 1. List videos.
const list = await videosV1VideoServiceListVideos({
  client,
  path: {project_id: projectId},
  query: {"pagination.limit": 10, "pagination.offset": 0},
});

if (list.error) {
  console.error(`List videos failed (${list.response?.status ?? "no response"}):`, list.error);
  process.exit(1);
}

const videos = list.data?.videos ?? [];
console.log(`Listed ${videos.length} of ${list.data?.total ?? "?"} videos.`);
for (const video of videos) {
  console.log(`  - ${video.id} (${video.width ?? "?"}x${video.height ?? "?"}, ${video.duration ?? "?"}s)`);
}

// 2. Fetch a single video by ID.
const videoId = requiredEnv("RIXL_VIDEO_ID", "Set it to an existing video ID.");

const detail = await videosV1VideoServiceGetVideo({
  client,
  path: {video_id: videoId},
});

if (detail.error) {
  console.error(`Get video failed (${detail.response?.status ?? "no response"}):`, detail.error);
  process.exit(1);
}

console.log(
  `Video ${detail.data?.video?.id}: ${detail.data?.video?.width ?? "?"}x${detail.data?.video?.height ?? "?"}, duration=${detail.data?.video?.duration ?? "?"}s.`
);

// 3. Update visibility.
const updateVisibility = optionalEnv("RIXL_UPDATE_VISIBILITY");

if (updateVisibility) {
  const updated = await videosV1VideoServiceUpdateVideoVisibility({
    client,
    path: {project_id: projectId, video_id: videoId},
    body: {visibility: "VISIBILITY_PUBLIC"},
  });

  if (updated.error) {
    console.error(`Visibility update failed (${updated.response?.status ?? "no response"}):`, updated.error);
    process.exit(1);
  }

  console.log(`Visibility updated for video ${videoId}.`);
}

// 4. Delete the video — only when explicitly opted in.
const deleteVideoId = optionalEnv("RIXL_DELETE_VIDEO_ID");

if (!deleteVideoId) {
  console.log("Skipping delete: set RIXL_DELETE_VIDEO_ID to run the destructive path.");
} else {
  assertDestructiveEnabled(`Deleting video ${deleteVideoId}`);

  const deleted = await videosV1VideoServiceDeleteVideo({
    client,
    path: {project_id: projectId, video_id: deleteVideoId},
  });

  if (deleted.error) {
    console.error(`Delete video failed (${deleted.response?.status ?? "no response"}):`, deleted.error);
    process.exit(1);
  }

  console.log(`Deleted video ${deleteVideoId} (status ${deleted.response?.status ?? "unknown"}).`);
}
