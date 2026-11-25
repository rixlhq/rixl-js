// Fails if the Vite+-managed toolchain set is split, or if a managed
// package.json pin is missing from .github/dependabot.yaml's ignore list.
// The managed set is derived from the installed vite-plus: its toolchain.json
// "dependency" nodes plus its own manifest pins — the versions `vp migrate`
// aligns. A pin bumped alone (by dependabot, `vp update`, or a hand edit)
// splits the set and makes `vp` refuse every command.
// Usage: node scripts/check-toolchain-pins.mjs
import {readFileSync} from "node:fs";

let pkg, vpPkg, toolchain, dependabotYaml;
try {
  pkg = JSON.parse(readFileSync("package.json", "utf8"));
  vpPkg = JSON.parse(readFileSync("node_modules/vite-plus/package.json", "utf8"));
  toolchain = JSON.parse(readFileSync("node_modules/vite-plus/dist/toolchain.json", "utf8"));
  dependabotYaml = readFileSync(".github/dependabot.yaml", "utf8");
} catch (err) {
  console.error(`lint:toolchain-pins: cannot read inputs (${err.message}) — is node_modules installed?`);
  process.exit(1);
}
if (toolchain.schemaVersion !== 1 || !Array.isArray(toolchain.nodes)) {
  console.error("lint:toolchain-pins: unrecognised toolchain.json shape — update this script for the new schema");
  process.exit(1);
}

let failures = 0;
const fail = (msg) => {
  console.error(`lint:toolchain-pins: ${msg}`);
  failures++;
};

// name -> spec the installed vite-plus manages. Its deps use exact pins
// ("=1.94.0"); the vite entry is the npm: alias spec itself.
const managed = new Map();
for (const node of toolchain.nodes) {
  if (node.delivery.includes("dependency")) managed.set(node.name, String(node.version));
}
for (const [name, spec] of Object.entries(vpPkg.dependencies ?? {})) {
  managed.set(name, String(spec).replace(/^=/, ""));
}
// Assumption (holds on every vite-plus release seen so far): @vitest/*
// sibling packages are pinned to the bundled vitest version — migrate rolled
// @vitest/coverage-v8/ui back from 5.1.1 to vitest's 5.1.0.
const vitestVersion = managed.get("vitest");
// Every toolchain node — bundled or compiled included: migrate can promote
// them to manifest pins in a future release, and that pin is then managed.
const toolchainNames = new Set(toolchain.nodes.map((n) => n.name));
const managedScopes = new Set([...managed.keys()].map((n) => n.match(/^@[^/]+\//)?.[0]).filter(Boolean));

const isManaged = (name) => managed.has(name) || toolchainNames.has(name) || [...managedScopes].some((s) => name.startsWith(s));
const expectedFor = (name) => managed.get(name) ?? (name.startsWith("@vitest/") ? vitestVersion : undefined);

const manifest = {...pkg.dependencies, ...pkg.devDependencies};
// A managed name present only in overrides would split the lockfile too —
// overrides values may be nested objects (e.g. "@hey-api/openapi-ts"), so
// only string specs join the checks.
const allPins = {...manifest, ...pkg.overrides};
for (const [name, spec] of Object.entries(allPins)) {
  const expected = expectedFor(name);
  if (typeof spec === "string" && expected !== undefined && spec !== expected) {
    fail(
      `${name} is pinned at "${spec}" but vite-plus@${managed.get("vite-plus")} manages "${expected}" — run \`vp migrate\`, don't bump it alone`
    );
  }
}
for (const name of ["vite", "vitest"]) {
  if (pkg.overrides?.[name] !== manifest[name]) {
    fail(`overrides.${name} (${JSON.stringify(pkg.overrides?.[name])}) does not match the ${name} pin (${JSON.stringify(manifest[name])})`);
  }
}

// A managed name that lands in package.json without an ignore entry lets the
// next grouped dependabot bump split the set again — this is what fails a
// toolchain PR when `vp migrate` starts pinning a package it didn't before.
const patterns = [...dependabotYaml.matchAll(/dependency-name:\s*"([^"]+)"/g)].map((m) => m[1]);
const ignored = (name) => patterns.some((p) => (p.endsWith("/*") ? name.startsWith(p.slice(0, -1)) : name === p));
for (const name of Object.keys(allPins)) {
  if (isManaged(name) && !ignored(name)) {
    fail(`${name} is toolchain-managed but missing from .github/dependabot.yaml's ignore list`);
  }
}

if (failures > 0) process.exit(1);
console.log(
  `lint:toolchain-pins: ${Object.keys(manifest).length} manifest deps checked against vite-plus@${managed.get("vite-plus")}, all aligned`
);
