import {client, connect, imagesV1ImageServiceDeleteImage, imagesV1ImageServiceGetImage, imagesV1ImageServiceListImages} from "@rixl/sdk";

import {assertDestructiveEnabled, optionalEnv, requiredEnv} from "./shared";

await connect({baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com"});
client.setConfig({headers: {"X-API-Key": requiredEnv("RIXL_API_KEY")}});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to a Rixl project ID.");

// 1. List images.
const list = await imagesV1ImageServiceListImages({
  path: {project_id: projectId},
  query: {"pagination.limit": 10, "pagination.offset": 0},
});

if (list.error) {
  console.error(`List images failed (${list.response?.status ?? "no response"}):`, list.error);
  process.exit(1);
}

const images = list.data?.images ?? [];
console.log(`Listed ${images.length} of ${list.data?.total ?? "?"} images.`);
for (const image of images) {
  console.log(`  - ${image.id} (${image.width ?? "?"}x${image.height ?? "?"})`);
}

// 2. Fetch a single image by ID.
const imageId = requiredEnv("RIXL_IMAGE_ID", "Set it to an existing image ID.");

const detail = await imagesV1ImageServiceGetImage({
  path: {image_id: imageId},
});

if (detail.error) {
  console.error(`Get image failed (${detail.response?.status ?? "no response"}):`, detail.error);
  process.exit(1);
}

console.log(`Image ${detail.data?.image?.id}: ${detail.data?.image?.width ?? "?"}x${detail.data?.image?.height ?? "?"}`);

// 3. Delete an image — only when explicitly opted in.
const deleteImageId = optionalEnv("RIXL_DELETE_IMAGE_ID");

if (!deleteImageId) {
  console.log("Skipping delete: set RIXL_DELETE_IMAGE_ID to run the destructive path.");
} else {
  assertDestructiveEnabled(`Deleting image ${deleteImageId}`);

  const deleted = await imagesV1ImageServiceDeleteImage({
    path: {project_id: projectId, image_id: deleteImageId},
  });

  if (deleted.error) {
    console.error(`Delete image failed (${deleted.response?.status ?? "no response"}):`, deleted.error);
    process.exit(1);
  }

  console.log(`Deleted image ${deleteImageId} (status ${deleted.response?.status ?? "unknown"}).`);
}
