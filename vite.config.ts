import {fileURLToPath} from "node:url";
import {defineConfig} from "vite-plus";

// SDK codegen is opt-in via RIXL_GENERATE=true (the `generate` script and the
// Generate SDK workflow). Routine commands — vp check/fmt/test/pack and the
// pre-commit hook — must never regenerate src/generated or hit the network.
//
// The plugin is imported lazily because `@hey-api/openapi-ts` executes
// classic TypeScript compiler API calls at module load time (e.g.
// `ts.NewLineKind.LineFeed`), which are not available in the native
// `typescript@7` runtime this project uses. Loading it eagerly would crash
// every `vp` invocation with: "Cannot read properties of undefined (reading 'LineFeed')".
const codegenPlugins =
  process.env.RIXL_GENERATE === "true"
    ? await (async () => {
        const {heyApiPlugin} = await import("@hey-api/vite-plugin");
        return [
          heyApiPlugin({
            config: {
              input: "https://raw.githubusercontent.com/rixlhq/openapi/refs/heads/main/openapi.yaml",
              output: "src/generated",
            },
          }),
        ];
      })()
    : [];

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/auth", import.meta.url)),
    },
  },
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: {index: "src/index.ts"},
    exports: true,
    dts: true,
    format: "esm",
    minify: false,
    platform: "browser",
    sourcemap: true,
    target: "es2022",
  },
  lint: {
    ignorePatterns: ["**/generated/**", "**/*.gen.ts"],
  },
  fmt: {
    ignorePatterns: ["**/generated/**", "**/*.gen.ts", "dist/**", "CHANGELOG.md", ".release-please-manifest.json"],
    printWidth: 140,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: false,
    trailingComma: "es5",
    arrowParens: "always",
    bracketSpacing: false,
    bracketSameLine: false,
    endOfLine: "lf",
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    isolate: true,
    include: ["src/**/*.{test,spec}.{js,ts}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html", "lcov"],
      reportOnFailure: true,
      cleanOnRerun: true,
      include: ["src/**/*.{js,ts}"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/generated/**",
        "**/*.gen.ts",
        "**/*.config.{js,ts}",
        "**/types.ts",
        "**/*.d.ts",
        "**/index.ts",
        "**/__tests__/**",
        "**/example/**",
      ],
      // Interim floors set just below current coverage to unblock CI; the
      // target is 80% across the board — raise these as tests are added.
      thresholds: {
        lines: 74,
        functions: 59,
        branches: 64,
        statements: 74,
      },
    },
  },
  staged: {
    "*.{js,ts}": "vp check --fix",
    "*.{json,md,yaml,yml}": "vp fmt --write",
  },
  plugins: codegenPlugins,
});
