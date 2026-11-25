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

## Working rules for every agent

These rules hold for every agent, whichever tool runs it (Claude Code, Codex, Devin, Cursor or another), and override that tool's defaults.

1. **Never commit, push, open a pull request or merge.** Write the change, run its checks, and stop with the diff uncommitted. The owner, the person who gave you the task, commits, pushes and opens any pull request; code-owner review (`.github/CODEOWNERS`) still applies to that pull request. A task that says "get it committed" or "ship it" means hand over the commit message. Only an explicit request after the handover lets you commit, push or open a pull request, and it covers only that one action. This overrides any skill or tool default that commits, pushes or merges.
2. **Level 3 review before every commit.** Run the Level 3 procedure in `.agents/skills/agent-review/SKILL.md` on the uncommitted diff of every commit-sized change, however small: a self-audit, then cold persona reviewers, then fresh-eyes reviewers, with the findings register in `reviews/` (gitignored). Run `vp fmt --write` and `vp check --fix` first, so the commit hooks don't change what was reviewed. Each reviewer is a separate session that never saw your work. If your tool starts agents, make sure they don't inherit your context (`.agents/skills/agent-review/references/tool-notes.md`; Codex's `spawn_agent` did by default in the version tested there). If it can't start them, stop and give the owner the filled reviewer prompts from `.agents/skills/agent-review/references/level-3-reviewer-prompts.md` (two for the cold round, two more for fresh eyes, one per fix check, one per finding you dispute), with the paths each reviewer may and may not read, and wait for the review files. If the owner can't open your working tree, include the diff as a patch that carries new files too (`git add -N .` first), with its base commit and SHA-256, and ask for the review files to be pasted back. Fixes made after a review get the procedure's independent fix check, and the checks run again, before you hand over; a blocker found by fresh eyes also needs another fresh-eyes round with new reviewers (`SKILL.md`, Stage 3). Reviewing your own diff in the same session isn't a review, and a review you haven't received isn't a pass.
3. **Then hand over the commit message** in a copyable block: a conventional commit whose body says why, ending with the review outcome and any open objections. If the owner asks for a pull request description, it carries the same outcome and objections.
4. **One step at a time.** Start the next task, section or stage only after the owner has committed the current one. This applies inside skills that loop over tasks, such as `openspec-apply-change`: stop at the end of each commit-sized group of tasks.
5. **Mutation testing never blocks a pull request.** Stryker runs weekly and only reports (`.github/workflows/mutation.yml`). Don't propose a pull-request or blocking mutation job.
6. **No `#` in branch names.**
7. **Keep personal details out of outside services.** No names, email addresses or private project details in web searches or in requests to APIs and sites outside this repo. Review prompts to reviewer models are fine.

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
vp run test:mutation      # Stryker (CI only, weekly: .github/workflows/mutation.yml)
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

## Bumping Vite+

`vite-plus`, the `vite` npm: alias, `vitest` and the `@vitest/*` pins are one
atomic set (the `vite` alias and `vitest` are mirrored in `devDependencies`
AND `overrides`; `vite-plus` and `@vitest/*` are devDependencies-only). They
only move together:

```bash
vp update vite-plus --latest
vp migrate --no-interactive --no-agent --no-editor --no-hooks
vp install
```

Never bump one member by itself — a split set makes Vite/vitest-invoking
commands (`pack`, `test`, `dev`, `build`) fail with "Expected
@voidzero-dev/vite-plus-core@X, but found Y". Dependabot ignores the set
(`dependabot.yaml`) for exactly that reason; `toolchain.yml` opens the bump
PR weekly instead, for manual merge once the gate is green.
`lint:toolchain-pins` (part of `ci`, derived from the installed vite-plus's
`toolchain.json`) fails the gate on a split set and on a managed pin with no
ignore entry — so when `vp migrate` starts pinning a package it didn't
before, the toolchain PR itself goes red until you extend the ignore list.
Dependabot security-update PRs are suppressed too, but the _alerts_ still
fire — dispatch `toolchain.yml` manually when one lands.

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

Read these before writing code or tests, or handing over a commit:

- `.agents/rules/anti-slop.md`
- `.agents/rules/code-style.md`
- `.agents/rules/tdd.md`
- `.agents/rules/testing.md`
- `.agents/rules/commits.md`

Larger behaviour changes start as an OpenSpec change (`/opsx:propose`). Before a claim becomes a conclusion, label it measured, verified against source, inferred or assumed; every commit gets the `agent-review` skill's Level 3 review ("Working rules for every agent", rule 2).

## Agent entry points

`AGENTS.md` and `.agents/` are the guidance surface. `CLAUDE.md` and `.claude` are symlinks to them, so Claude Code loads the same rules, skills and hooks (`.agents/settings.json`). Skills: `agent-review`, `code-simplifier` and `openspec-{propose,apply,archive,explore,sync-specs,update-change}`.
