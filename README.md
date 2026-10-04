# @rixl/sdk

[![npm](https://img.shields.io/npm/v/@rixl/sdk.svg)](https://www.npmjs.com/package/@rixl/sdk)

The official TypeScript client for the [Rixl](https://rixl.com) API.

Rixl handles the media side of your product: uploading and delivering images
and videos, organising them into feeds and posts, and reporting on how people
engage with them. It also covers the account layer around that: users and
organisations, sign-in, subscriptions and invoices. This SDK gives you all of it
from TypeScript, with a function per operation and a type for every request and
response. On top of that it ships a browser sign-in layer, so a web app can log
users in without you writing the token handling yourself.

The package is ESM only and needs Node.js 24 or later. It also runs in browsers
and any runtime with a global `fetch`. Types are bundled, so there is nothing
extra to install for editor completion.

## Installation

```bash
npm i @rixl/sdk
```

`pnpm i @rixl/sdk`, `bun i @rixl/sdk` and `vp i @rixl/sdk` work the same way.

## Getting started

Here is the whole thing. Create a client, then list the images in a project:

```ts
import {createClient, imagesV1ImageServiceListImages} from "@rixl/sdk";

const client = createClient({
  baseUrl: "https://api.rixl.com",
  headers: {"X-API-Key": process.env.RIXL_API_KEY!},
});

const {data, error} = await imagesV1ImageServiceListImages({
  client,
  path: {project_id: process.env.RIXL_PROJECT_ID!},
  query: {"pagination.limit": 10},
});

if (error) {
  throw new Error(`rixl: ${JSON.stringify(error)}`);
}

for (const image of data?.images ?? []) {
  console.log(image.id, image.width, image.height);
}
```

Always pass `baseUrl`. The generated client does not default to the Rixl API, so
a client created without it will send requests somewhere you did not intend.

Every operation is a standalone function taking one options object. `client` says
which client to use, `path` fills in the URL, `query` becomes the query string and
`body` is the payload. Nothing is thrown by default: you get back
`{data, error, request, response}` and check `error` yourself.

## Authentication

There are two ways to identify yourself, and they answer different questions.

### API keys, for your backend calling as itself

An API key represents your organisation. Use it for work your own systems do:
importing a catalogue, running a nightly report, reconciling invoices. Create one
in the [Rixl dashboard](https://rixl.com), keep it out of source control, and read
it from the environment:

```ts
const client = createClient({
  baseUrl: "https://api.rixl.com",
  headers: {"X-API-Key": process.env.RIXL_API_KEY!},
});
```

The key travels as the `X-API-Key` header. Anyone holding it can do anything your
organisation can, so it belongs on a server. Never put one in a browser, a mobile app, or
anything you ship to users.

### Client credentials, for acting on behalf of your users

If you are building on top of Rixl and your own users each need their own slice of
it, use client credentials. You exchange a client ID and secret for a short-lived
token scoped to a single end user, so one customer can never read another's media.

First create the credential. The response carries a secret that is returned
**once**:

```ts
import {clientauthV1ClientCredentialServiceCreateClientCredential} from "@rixl/sdk";

const {data} = await clientauthV1ClientCredentialServiceCreateClientCredential({
  client: adminClient,
  body: {name: "Production backend"},
});

console.log(data?.credential?.client_id, data?.client_secret);
```

Then, in the service that handles your users' requests, exchange it for a token.
`subject` is your own identifier for that person, whatever your database calls
them:

```ts
import {clientauthV1ClientCredentialServiceMintClientToken} from "@rixl/sdk";

const {data: token} = await clientauthV1ClientCredentialServiceMintClientToken({
  client,
  body: {
    client_id: process.env.RIXL_CLIENT_ID!,
    client_secret: process.env.RIXL_CLIENT_SECRET!,
    subject: user.id,
    project_id: process.env.RIXL_PROJECT_ID,
  },
});
```

Minting needs no credentials of its own, since the ID and secret are in the body, so a
plain client will do. The response gives you `access_token`, `token_type`,
`expires_in` and `expires_at`. Send the token as a bearer token on the calls that
follow:

```ts
const userClient = createClient({
  baseUrl: "https://api.rixl.com",
  headers: {Authorization: `Bearer ${token!.access_token}`},
});
```

Tokens last at most 15 minutes and there is no refresh token: when one expires,
mint another. The SDK does not cache or renew them for you, so if you are serving
many requests, hold each user's token in your own cache until `expires_at` and
mint again after that. Pass `ttl_minutes` if you want something shorter than the
maximum.

To retire a credential, revoke it with
`clientauthV1ClientCredentialServiceRevokeClientCredential`. New tokens stop
immediately, and any already issued expire within 15 minutes.

### Public endpoints

Some reads need no credentials at all: fetching a public image or video, reading
a public feed, listing supported languages. Call those with a client that sends no
auth header:

```ts
import {createClient, imagesV1ImageServiceGetImage, postsV1PostServiceListPosts3} from "@rixl/sdk";

const publicClient = createClient({baseUrl: "https://api.rixl.com"});

const {data: image} = await imagesV1ImageServiceGetImage({
  client: publicClient,
  path: {image_id: imageId},
});

const {data: feed} = await postsV1PostServiceListPosts3({
  client: publicClient,
  path: {feed_id: feedId},
  query: {"pagination.limit": 20},
});
```

The public set is: the sign-in flows under `/auth/v1/`, `GET /media/v1/images/*`,
`GET /media/v1/videos/*`, `GET /media/v1/languages`, `GET /posts/v1/feeds/*`, and
the token endpoints under `/platform/`. Everything else needs a key or a token.

### Signing users in from the browser

For a web app, `connect` sets up the shared client and the sign-in machinery in
one call:

```ts
import {connect} from "@rixl/sdk";

await connect({
  baseUrl: "https://api.rixl.com",
  auth: {
    loginRedirectUrl: window.location.origin,
    google: {clientId: "..."},
  },
});
```

After that, operations called without an explicit `client` use the shared client,
and the session is available as [nanostores](https://github.com/nanostores/nanostores)
atoms you can subscribe to:

```ts
import {isLogged, user, login, loginWithEmail, logout, getToken} from "@rixl/sdk";

isLogged.subscribe((loggedIn) => render(loggedIn, user.get()));

await login("google");
await loginWithEmail(email, password);
await logout();

const token = await getToken();
```

`connect` also accepts `apiKey`, which installs an `X-API-Key` interceptor on the
shared client. That is for server-side use. Do not ship an API key to a browser.

The same module exports the rest of the account surface: passkey registration and
login, one-time passcodes, email verification and password reset, organisation
membership and invitations, connected social providers, and custom domains.

## What you can do

The API is organised into six areas. Every operation is exported as a function
named `<service><Operation>`, so the prefix tells you which area you are in.

**Media**: `imagesV1ImageService*`, `videosV1VideoService*`,
`videosV1AudioTrackService*`, `videosV1ChapterService*`,
`videosV1SubtitleService*`, `videosV1LanguageService*`,
`imagesV1ImageConversionService*`, `videosV1VideoConversionService*`. Upload and
deliver files, attach audio and captions to a video, and convert media into the
formats and sizes you serve.

**Content**: `postsV1PostService*`, `feedsV1FeedService*`,
`projectV1ProjectService*`. Group media into posts and feeds. A project is the
container everything else hangs off, which is why so many calls take a
`project_id`.

**Analytics**: `analyticsV1DashboardService*`, `analyticsV1EventsService*`,
`analyticsV1PostsService*`, `analyticsV1VideosService*`,
`analyticsV1FeedsService*`, `analyticsV1FunnelsService*`,
`analyticsV1HeatmapService*`, `analyticsV1RealtimeService*`. Track events and read
back engagement, playback, funnels and live activity.

**Billing**: `billingV1PaymentService*`, `billingV1SubscriptionService*`,
`billingV1PlanService*`, `billingV1InvoiceService*`, `billingV1UsageService*`,
`billingV1SalesService*`. Manage subscriptions and payment methods, and read
invoices and metered usage.

**Account management**: `authV1UserService*`, `authV1TokenService*`,
`authV1OtpService*`, `authV1PasskeyService*`, `authV1ProvidersService*`,
`authV1MembershipService*`, `authV1PolicyService*`, `authV1DomainService*`,
`authV1EmailService*`, `authV1BlogService*`. Sign-in flows including passkeys and
one-time codes, organisation membership and roles, access policies, custom
domains, and transactional email.

**Platform**: `apikeysV1ApiKeyService*`, `clientauthV1ClientCredentialService*`,
`platformauthV1PlatformAuthService*`. Manage the credentials above
programmatically.

A name ending in a digit, such as `postsV1PostServiceListPosts2` or
`postsV1PostServiceGetPost3`, is a second route to the same operation. The
plain name is the project-scoped route; the numbered ones are the feed-scoped and
public variants. Hover the export in your editor to see which URL it hits.

## Working with resources

Operations follow the same shape, so once you have used one you have used all of
them:

```ts
import {
  imagesV1ImageServiceListImages,
  imagesV1ImageServiceGetImage,
  imagesV1ImageServiceDeleteImage,
} from "@rixl/sdk";

const list = await imagesV1ImageServiceListImages({client, path: {project_id: projectId}});
const one = await imagesV1ImageServiceGetImage({client, path: {image_id: imageId}});
const gone = await imagesV1ImageServiceDeleteImage({
  client,
  path: {project_id: projectId, image_id: imageId},
});
```

Calls that send data take a `body`, typed to that operation:

```ts
import {feedsV1FeedServiceUpdateFeed} from "@rixl/sdk";

await feedsV1FeedServiceUpdateFeed({
  client,
  path: {project_id: projectId, feed_id: feedId},
  body: {name: "Highlights"},
});
```

Nearly every response field is optional in the types. That is deliberate: the API
omits fields it has nothing to say about, so reach for `?.` and `??` rather than
assuming a value is there. Integer fields wide enough to overflow a JavaScript
number, `total` among them, are typed `number | string`, because the API sends
them as strings once they get large.

## Uploading files

Uploads happen in two steps. You ask Rixl for a URL, then send the bytes straight
to storage. The bytes never pass through the API, so large files stay fast:

```ts
import {imagesV1ImageServiceCreateImageUpload} from "@rixl/sdk";

const {data: upload} = await imagesV1ImageServiceCreateImageUpload({
  client,
  path: {project_id: projectId},
  body: {name: "photo.jpg"},
});

await fetch(upload!.upload_url!, {
  method: "PUT",
  body: imageBytes,
  headers: {"Content-Type": "image/jpeg"},
});
```

Videos work the same way, except you get two URLs back, one for the video and one
for its poster image:

```ts
import {videosV1VideoServiceCreateVideoUpload} from "@rixl/sdk";

const {data: upload} = await videosV1VideoServiceCreateVideoUpload({
  client,
  path: {project_id: projectId},
  body: {name: "clip.mp4"},
});

await Promise.all([
  fetch(upload!.video_upload_url!, {method: "PUT", body: videoBytes, headers: {"Content-Type": "video/mp4"}}),
  fetch(upload!.poster_upload_url!, {method: "PUT", body: posterBytes, headers: {"Content-Type": "image/jpeg"}}),
]);
```

There is no "finish" call to make. Storage tells Rixl when the object lands and
the image or video becomes available on its own. The URLs expire, and `expires_at`
tells you when, so upload promptly rather than stashing them.

## Pagination

List calls take a limit and an offset, and tell you the total. Note the dots in
the query keys; they are literal:

```ts
const limit = 50;
let offset = 0;

for (;;) {
  const {data, error} = await imagesV1ImageServiceListImages({
    client,
    path: {project_id: projectId},
    query: {"pagination.limit": limit, "pagination.offset": offset},
  });

  if (error) throw error;

  for (const image of data?.images ?? []) {
    console.log(image.id);
  }

  offset += limit;
  if (offset >= Number(data?.total ?? 0)) break;
}
```

The SDK does not paginate for you. There is no async iterator and no automatic
page fetching. Write the loop.

## Handling errors

By default nothing throws. A non-2xx response comes back with `data` undefined and
`error` set to the parsed response body, alongside the raw `Response` so you can
read the status:

```ts
const {data, error, response} = await imagesV1ImageServiceGetImage({
  client,
  path: {image_id: imageId},
});

if (error) {
  console.error(`rixl returned ${response?.status}`, error);
  return;
}
```

If you would rather use `try`/`catch`, set `throwOnError`, per call or on the
client, and the same value is thrown instead:

```ts
const client = createClient({
  baseUrl: "https://api.rixl.com",
  headers: {"X-API-Key": process.env.RIXL_API_KEY!},
  throwOnError: true,
});
```

`responseStyle: "data"` returns the parsed body directly instead of the
`{data, error}` wrapper. Combine it with `throwOnError: true`, or a failed call
will quietly resolve to `undefined`.

What the codes mean:

| Status | What happened | What to do |
| --- | --- | --- |
| 400 | The request was malformed or failed validation | Fix the request; retrying will not help |
| 401 | The key or token is missing, expired or invalid | Check the credential |
| 403 | The credential is valid but not allowed to do this | Check the policies on it |
| 404 | No such resource, or it belongs to another organisation | Check the ID and the project |
| 429 | You are going too fast | Back off and retry |
| 5xx | Something broke on our side | Retry with backoff |

Connection failures and timeouts surface as whatever `fetch` threw, a `TypeError`
or an `AbortError`, with `response` undefined, so check `response` before reading
a status off it.

## Timeouts and interception

The SDK does not impose a timeout and does not retry. It calls `fetch`, so the
behaviour stays yours to control. Pass an `AbortSignal` per call:

```ts
await imagesV1ImageServiceListImages({
  client,
  path: {project_id: projectId},
  signal: AbortSignal.timeout(30_000),
});
```

Or hand the client your own `fetch` and do it there:

```ts
const client = createClient({
  baseUrl: "https://api.rixl.com",
  fetch: (request) => fetch(request, {signal: AbortSignal.timeout(30_000)}),
});
```

Interceptors run on every request, response and error, which is where tracing
headers or a retry go:

```ts
client.interceptors.request.use(async (request) => {
  request.headers.set("X-Trace-ID", traceId());
  return request;
});
```

## Versioning

This package follows [SemVer](https://semver.org/spec/v2.0.0.html). New API
operations arrive in minor releases; renamed or removed ones only in major ones.
If an upgrade breaks you unexpectedly, please open an issue. We would rather hear
about it.

## Support

Bugs and feature requests:
[github.com/rixlhq/rixl-js/issues](https://github.com/rixlhq/rixl-js/issues).
