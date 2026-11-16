#!/usr/bin/env node
// Claude Code PreToolUse hook (.agents/settings.json): blocks Bash commands that
// skip the git hooks in lefthook.yml. Exit 2 blocks the call and shows stderr to
// the agent (https://code.claude.com/docs/en/hooks).
import {readFileSync} from "node:fs";

// Options of `git commit` that take a value, so the next word is the value, not a flag.
const COMMIT_VALUE_OPTIONS = new Set([
  "-m",
  "--message",
  "-F",
  "--file",
  "-C",
  "-c",
  "--author",
  "--date",
  "--fixup",
  "--squash",
  "-t",
  "--template",
]);
// Options of `git` itself that take a value: `git -C <dir> commit`, `git -c <key=value> commit`.
const GIT_VALUE_OPTIONS = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path", "--config-env"]);
// `git config` flags that only read.
const CONFIG_READS = /^(--get|--get-all|--get-regexp|--get-urlmatch|--list|-l|--show-origin|--show-scope|--name-only)$/;

/** Splits a shell command into words, keeping quoted strings whole. Good enough to find flags. */
function words(command) {
  return [...command.matchAll(/"(?:[^"\\]|\\.)*"|'[^']*'|[^\s"']+/g)].map(([word]) => word);
}

/** Git's own options before the subcommand, and the subcommand with its arguments. */
function splitGitArgs(args) {
  const globals = [];
  let i = 0;
  while (i < args.length && args[i].startsWith("-")) {
    globals.push(args[i]);
    if (GIT_VALUE_OPTIONS.has(args[i])) globals.push(args[++i] ?? "");
    i++;
  }
  return {globals, subcommand: args[i], rest: args.slice(i + 1)};
}

/** True when `git commit` arguments include a short `-n` (no-verify), skipping option values. */
function commitSkipsHooks(args) {
  for (let i = 0; i < args.length; i++) {
    if (COMMIT_VALUE_OPTIONS.has(args[i])) i++;
    else if (/^-[a-zA-Z]+$/.test(args[i]) && args[i].includes("n")) return true;
  }
  return false;
}

/** Why one git invocation skips hooks, or null. */
function gitReason(args) {
  const {globals, subcommand, rest} = splitGitArgs(args);
  if (globals.some((option) => /core\.hooksPath/i.test(option))) return "it changes where git looks for hooks";
  if (rest.includes("--no-verify")) return "--no-verify skips the hooks";
  if (subcommand === "commit" && commitSkipsHooks(rest)) return "`git commit -n` is --no-verify";
  const setsHooksPath =
    subcommand === "config" && rest.some((arg) => /core\.hooksPath/i.test(arg)) && !rest.some((arg) => CONFIG_READS.test(arg));
  return setsHooksPath ? "it changes where git looks for hooks" : null;
}

/** Why `command` skips git hooks, or null. */
function skipReason(command) {
  if (/\bLEFTHOOK=(0|false)\b/i.test(command) || /\bHUSKY=0\b/.test(command)) return "it turns the git hooks off";
  for (const segment of command.split(/&&|\|\||;|\|/)) {
    const list = words(segment);
    const git = list.indexOf("git");
    const reason = git === -1 ? null : gitReason(list.slice(git + 1));
    if (reason) return reason;
  }
  return null;
}

const input = JSON.parse(readFileSync(0, "utf8"));
const reason = skipReason(input.tool_input?.command ?? "");
if (reason) {
  process.stderr.write(
    `Blocked: ${reason}. The hooks in lefthook.yml must run (.agents/rules/commits.md). Fix what the hook reports instead.\n`
  );
  process.exit(2);
}
