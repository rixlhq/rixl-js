/** @type {import("@stryker-mutator/api/core").PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  plugins: ["@stryker-mutator/vitest-runner"],
  vitest: {configFile: "test/stryker.vitest.config.ts"},
  coverageAnalysis: "perTest",
  incremental: true,
  incrementalFile: ".stryker-cache/incremental.json",
  // Only the hand-written SDK: src/generated is the OpenAPI generator's code,
  // mutating it tests the generator rather than our tests. Barrels and type-only
  // files produce no runnable mutants.
  mutate: ["src/**/*.{ts,tsx}", "!src/generated/**", "!src/**/__tests__/**", "!src/**/*.d.ts", "!src/**/types.ts", "!src/**/index.ts"],
  // .claude is a symlink to .agents, which Stryker can't copy into its sandbox on macOS; tests need neither.
  ignorePatterns: [".claude", ".agents", "examples", "coverage", "reports", "openspec", "dist", ".vitest", ".stryker-cache"],
  // Stryker rewrites tsconfig files through the TypeScript JS API, which TypeScript 7 no longer ships.
  // Our tsconfig only references files inside the sandbox, so the rewrite is skipped by pointing at no file.
  tsconfigFile: "",
  reporters: ["html", "json", "clear-text", "progress"],
  htmlReporter: {fileName: "reports/mutation/index.html"},
  jsonReporter: {fileName: "reports/mutation/mutation.json"},
  thresholds: {high: 90, low: 80, break: null},
  tempDirName: ".stryker-tmp",
  concurrency: 4,
};
