# Commits

A commit records claims: the message and the code. Only commit what has been checked.

## Order

1. Finish one logical change.
2. Run the checks for what you touched: `vp check` and `vp test`; `vp run ci` before you push.
3. Run the `code-simplifier` skill on the changed code, then rerun the checks.
4. Commit.

## Hooks

Lefthook runs them (`lefthook.yml`, installed by `prepare`):

- **pre-commit:** `vp check --fix` on staged JS/TS and `vp fmt --write` on staged JSON, Markdown and YAML (fixes are re-staged).
- **pre-push:** `vp test --run`, `vp pack` and `vp run examples:check`.

Every command reads stdin from `/dev/null`, so a hidden prompt fails the hook instead of stalling it. The full gate (`vp run ci`) runs in `.github/workflows/release.yml` on every PR and on `main` before publishing.

Never skip a hook (`--no-verify`, `-n`, `LEFTHOOK=0`, `core.hooksPath`). If a hook fails, fix the cause. For Claude Code this is enforced: `.agents/hooks/no-skip-git-hooks.mjs` blocks those commands.

## Messages

- Conventional commits (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `style`), with a short scope (`auth`, `domain`, `passkey`, `social`, `config`, `ci`). Release Please builds the version and changelog from them.
- A breaking change to the public API says so (`feat(auth)!:` or a `BREAKING CHANGE:` footer).
- One logical change per commit. Body says why, not what. State only claims you checked.
- Never edit `CHANGELOG.md` or `.release-please-manifest.json`; Release Please owns them. Never commit `dist/` or `coverage/`.
- `main` has no branch protection and pushes to it publish. Everything goes through a pull request, and never merge one while CI is red.
