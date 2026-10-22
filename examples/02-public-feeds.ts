import {createClient, postsV1PostServiceGetPost3, postsV1PostServiceListPosts3, postsV1PostServiceListPosts4} from "@rixl/sdk";

import {optionalEnv, requiredEnv} from "./shared";

// Public feed endpoints don't require an API key, so we construct a client
// without `auth`. The same `createClient` factory still applies.
const client = createClient({
  baseUrl: optionalEnv("RIXL_BASE_URL") ?? "https://api.rixl.com/",
});

const feedId = requiredEnv("RIXL_FEED_ID", "Set it to a feed ID to list posts from.");
const postId = requiredEnv("RIXL_POST_ID", "Set it to a post ID inside RIXL_FEED_ID.");
const creatorId = requiredEnv("RIXL_CREATOR_ID", "Set it to a creator ID inside RIXL_FEED_ID.");

const feed = await postsV1PostServiceListPosts3({
  client,
  path: {feed_id: feedId},
});

if (feed.error) {
  console.error(`Get feed failed (${feed.response?.status ?? "no response"}):`, feed.error);
  process.exit(1);
}

console.log(`Feed ${feedId}: ${feed.data?.posts?.length ?? 0} posts (total ${feed.data?.total ?? "?"}).`);

const post = await postsV1PostServiceGetPost3({
  client,
  path: {feed_id: feedId, post_id: postId},
});

if (post.error) {
  console.error(`Get post failed (${post.response?.status ?? "no response"}):`, post.error);
  process.exit(1);
}

console.log(`Post ${postId}: creator=${post.data?.post?.creator_id ?? "?"}`);

const creatorFeed = await postsV1PostServiceListPosts4({
  client,
  path: {feed_id: feedId, creator_id: creatorId},
});

if (creatorFeed.error) {
  console.error(`Get creator feed failed (${creatorFeed.response?.status ?? "no response"}):`, creatorFeed.error);
  process.exit(1);
}

console.log(`Creator ${creatorId} in feed ${feedId}: ${creatorFeed.data?.posts?.length ?? 0} posts.`);
