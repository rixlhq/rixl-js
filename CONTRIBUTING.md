# Contributing to @rixl/sdk

## Toolchain

This repository uses [Vite+](https://viteplus.dev/guide/) as the unified
toolchain and package manager wrapper, with Bun underneath. The CLI is `vp`.

```bash
vp install      # install dependencies
vp run pack     # build the library
vp check        # format, lint and type check
vp test         # run the test suite
```

`vp env doctor` prints diagnostics when setup, runtime or package-manager
behaviour looks wrong; include its output when reporting a tooling problem.

## Layout

- `src/generated/`: generated from the OpenAPI spec. Do not hand-edit; changes
  here are overwritten on the next generation.
  - `sdk.gen.ts`: one exported function per operation.
  - `types.gen.ts`: request and response types.
  - `client/`, `core/`: the fetch client the operations call into.
- `src/auth/`: hand-written browser sign-in layer (stores, providers, passkeys,
  membership, organisation and user helpers).
- `src/connect.ts`: `connect()`, which wires the shared generated client
  together with the auth layer.
- `src/index.ts`: the public surface. Anything not re-exported here is private.
- `examples/`: standalone scripts; type-checked by `vp run examples:check`.

## Regenerating the SDK

```bash
vp run generate
```

This runs the build with `RIXL_GENERATE=true`, which enables the
`@hey-api/vite-plugin` generation step configured in `vite.config.ts`. It reads
the spec from `rixlhq/openapi` on GitHub and rewrites everything under
`src/generated/`. The plugin is imported lazily and only under that env var,
because `@hey-api/openapi-ts` crashes on load under the TypeScript 7 runtime this
project uses, so routine `vp check`/`test`/`pack` never regenerate or hit the
network.

After regenerating:

1. Run `vp check` and `vp test`.
2. Diff `src/generated/sdk.gen.ts` for renamed or removed exports, since operation
   names are derived from the spec, so a spec change can rename a public export
   and that is a breaking change for consumers.
3. Re-export anything new that belongs in the public surface from `src/index.ts`.
4. Update `examples/` if operation names moved.

### Known generation quirks

- The generated `src/generated/client.gen.ts` sets `baseUrl` to
  `https://raw.githubusercontent.com`, taken from the spec's document URL rather
  than a server entry. Callers must pass `baseUrl` explicitly, which is why the
  README says so everywhere. Fixing this means adding a `servers` entry upstream.
- The spec declares no security schemes, so no `security` metadata reaches the
  generated operations and the client's `auth` option has no effect. Credentials
  have to be set as headers or via an interceptor.
- Operations that share a gRPC method across several HTTP routes generate
  numbered duplicates (`postsV1PostServiceListPosts2`, `…3`, `…4`). The numbering
  is positional and can shift when routes are added upstream, so check it after
  every regeneration.
- `examples/` is stale. Every script imports the old flat operation names
  (`getImages`, `getFeedsByFeedId`, `postVideosUploadInit`, …), none of which are
  exported any more, so `vp run examples:check` cannot pass. They need rewriting
  against the current `<service><Operation>` exports before the README points at
  them again.
- Some multipart fields (for example bulk audio-track `files`) are typed
  `Array<string>` in the spec although the endpoint accepts `File[]`. Examples
  suppress this with `@ts-expect-error`; when the suppression starts failing
  typecheck, the spec has been fixed and the comment should go.

## Releases

Releases are managed by release-please (`release-please-config.json`). Use
conventional commits: `feat:` for a minor bump, `fix:` for a patch, `feat!:` or a
`BREAKING CHANGE:` footer for a major. `vp run ci:release` checks, packs and
publishes.
