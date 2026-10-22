import {readFile} from "node:fs/promises";
import {basename} from "node:path";

import {createClient, imagesV1ImageServiceCreateImageUpload} from "@rixl/sdk";

import {optionalEnv, requiredEnv} from "./shared";

const client = createClient({
  auth: requiredEnv("RIXL_API_KEY"),
  baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com/",
});

const projectId = requiredEnv("RIXL_PROJECT_ID", "Set it to your Rixl project ID.");
const filePath = requiredEnv("RIXL_IMAGE_FILE", "Set it to a path to an image file on disk.");

// 1. Ask the API for a presigned URL to upload to.
const init = await imagesV1ImageServiceCreateImageUpload({
  client,
  path: {project_id: projectId},
  body: {
    name: basename(filePath),
  },
});

if (init.error) {
  console.error(`Upload init failed (${init.response?.status ?? "no response"}):`, init.error);
  process.exit(1);
}

const {image_id: imageId, upload_url: uploadUrl} = init.data ?? {};

if (!imageId || !uploadUrl) {
  console.error("Upload init succeeded but did not return image_id and upload_url.");
  process.exit(1);
}

console.log(`Init: image_id=${imageId}`);

// 2. Upload the bytes directly to the presigned URL with native fetch.
//    This step does not go through the SDK — the API hands you a URL to
//    PUT to, and you talk to object storage directly.
const fileBytes = await readFile(filePath);

const upload = await fetch(uploadUrl, {
  method: "PUT",
  body: fileBytes,
});

if (!upload.ok) {
  console.error(`Presigned PUT failed (${upload.status} ${upload.statusText}).`);
  process.exit(1);
}

console.log(`Uploaded ${fileBytes.byteLength} bytes to presigned URL.`);
console.log(`Image ${imageId} uploaded successfully.`);
