import type {VideosV1Video} from "@rixl/sdk";
import {client, connect, videosV1VideoServiceListVideos} from "@rixl/sdk";

import {optionalEnv, requiredEnv} from "./shared";

await connect({baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": requiredEnv("RIXL_API_KEY")}});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to a Rixl project ID.");

// The server clamps pagination.limit to 1..100, so advance by the page length.
const all: VideosV1Video[] = [];
let offset = 0;
let total = Infinity;

while (offset < total) {
  const {data, error, response} = await videosV1VideoServiceListVideos({
    path: {project_id: projectId},
    query: {"pagination.limit": 100, "pagination.offset": offset},
  });

  if (error) {
    console.error(`List videos failed at offset ${offset} (${response?.status ?? "no response"}):`, error);
    process.exit(1);
  }

  const page = data?.videos ?? [];
  all.push(...page);
  total = Number(data?.total ?? 0);
  if (page.length === 0) break;
  offset += page.length;
}

console.log(`Fetched ${all.length} of ${total} videos.`);
