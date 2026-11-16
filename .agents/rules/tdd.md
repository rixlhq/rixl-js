# TDD

1. **Red** — Write a failing test that describes the expected behaviour.
2. **Green** — Write the least code that makes it pass.
3. **Refactor** — Clean up with the tests green.

- New logic starts with a failing test. A bug fix starts with a test that reproduces the bug.
- Tests describe behaviour ("getDomainStatus returns null when the org has no domain"), not implementation.
- Run `vp test` after every green and refactor step.
- After the unit cycle, add fast-check property tests where the input space is wide.
- Commit after each completed cycle (`.agents/rules/commits.md`). Never commit a failing test to `main`.
