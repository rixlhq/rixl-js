import {client, connect, imagesV1ImageServiceListImages} from "@rixl/sdk";

import {optionalEnv, requiredEnv} from "./shared";

await connect({baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": requiredEnv("RIXL_API_KEY", "Set it to a Rixl API key before running this example.")}});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to a Rixl project ID.");

const {data, error, response} = await imagesV1ImageServiceListImages({
  path: {project_id: projectId},
  query: {"pagination.limit": 1, "pagination.offset": 0},
});

if (error) {
  console.error(`List images failed (${response?.status ?? "no response"}):`, error);
  process.exit(1);
}

console.log("Connected to the Rixl API.");
console.log(`HTTP status: ${response?.status ?? "unknown"}`);
console.log(`Images returned: ${data?.images?.length ?? 0}`);
console.log(`Total images available: ${data?.total ?? "unknown"}`);
