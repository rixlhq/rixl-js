<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Git Hooks Policy

**Do NOT use Vite+ git hooks (`vp hooks`) or the `staged` block in `vite.config.ts`.**

This project intentionally uses **Lefthook** (`lefthook.yml`) for git hooks management:

- Pre-commit: runs `vp check --fix {staged_files}` and `vp fmt --write {staged_files}` via Lefthook.
- Pre-push: runs `vp test --run && vp pack && vp run examples:check` via Lefthook.
- Every Lefthook command reads stdin from `/dev/null`.
- Vite+ built-in hooks are disabled (`vp hooks disable`). Do not re-enable Vite+ hooks or add `staged` configuration to `vite.config.ts`.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

# @rixl/sdk — Agent Guide

## Project overview

`@rixl/sdk` is the TypeScript SDK for the Rixl API, published to npm (MIT). It holds a typed client generated from the OpenAPI spec, plus the hand-written authentication layer (login providers, passkeys, PKCE, sessions and token refresh) and reactive stores. Dashboard, internal-dashboard and blog-posts depend on it, and so do customer apps.

## How releases happen

1. A merge in the API gateway updates `rixlhq/openapi`, which dispatches to this repo.
2. `generate.yml` regenerates `src/generated/` and opens a PR labelled `autorelease: pending`; `automerge.yml` merges it.
3. `release.yml` runs `vp run ci` on every PR and push to `main`. On `main` it then tags with Release Please and runs `npm publish` (trusted publishing).

`main` has no branch protection, so the `vp run ci` step in `release.yml` is the only check before a package reaches npm. Keep everything you need checked inside that script.

## Commands

```bash
vp install                # Install dependencies
vp check                  # Format, lint (complexity caps), type check
vp test                   # Unit tests
vp run test:coverage      # Tests with coverage; fails under the floor in vite.config.ts
vp run generate           # Regenerate src/generated from rixlhq/openapi (network)
vp run examples:check     # Typecheck examples/ against the public API
vp pack                   # Build dist/
vp run budget             # Size budget (.size-limit.json), after vp pack
vp run publint            # Checks the package.json exports map, after vp pack
vp run lint:suppressions  # Fails on a lint suppression without a reason
vp run knip               # Unused files, exports and dependencies
vp run ci                 # The gate the release job runs
```

Use `vp` for everything; don't call `bun`, `npm` or `npx` directly.

## Repository layout

- `src/index.ts` — the public API; everything consumers import
- `src/generated/` — generated client and types; never edit by hand
- `src/auth/` — hand-written auth: providers, passkeys, PKCE, cookies, stores, domain functions
- `src/platform/` — platform API key auth store
- `src/connect.ts`, `src/client-registry.ts` — the `connect()` entry point and client registration
- `src/__tests__/` — unit tests, mirroring `src/auth/`
- `examples/` — usage examples, typechecked in CI
- `openspec/` — specs and changes

## Rule files

Read these before writing code, tests or a commit:

- `.agents/rules/anti-slop.md`
- `.agents/rules/code-style.md`
- `.agents/rules/tdd.md`
- `.agents/rules/testing.md`
- `.agents/rules/commits.md`

Larger behaviour changes start as an OpenSpec change (`/opsx:propose`). Before a claim becomes a conclusion, label it measured, verified against source, inferred or assumed; use the `agent-review` skill when being wrong is expensive.

## Agent entry points

`AGENTS.md` and `.agents/` are the guidance surface. `CLAUDE.md` and `.claude` are symlinks to them, so Claude Code loads the same rules, skills and hooks (`.agents/settings.json`). Skills: `agent-review`, `code-simplifier` and `openspec-{propose,apply,archive,explore,sync-specs,update-change}`.
