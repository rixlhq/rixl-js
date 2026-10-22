import {fileURLToPath} from "node:url";
import {defineConfig} from "vite-plus";

// SDK codegen is opt-in via RIXL_GENERATE=true (the `generate` script and the
// Generate SDK workflow). Routine commands — vp check/fmt/test/pack and the
// pre-commit hook — must never regenerate src/generated or hit the network.
//
// When RIXL_GENERATE=true, the loader hook (scripts/ts-compat-hook.mjs) bridges
// `@hey-api/openapi-ts` to TypeScript 6 compiler APIs (`typescript-compat`), as
// TypeScript 7 replaced the classic JS Compiler API with native Go tooling.
const codegenPlugins =
  process.env.RIXL_GENERATE === "true"
    ? await (async () => {
        try {
          const {register} = await import("node:module");
          const {pathToFileURL} = await import("node:url");
          register(new URL("./scripts/ts-compat-hook.mjs", import.meta.url), pathToFileURL("./"));
        } catch {
          // Ignore if hook registration is unsupported in this environment
        }
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
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    entry: {
      index: "src/index.ts",
      auth: "src/auth/index.ts",
    },
    exports: true,
    dts: true,
    format: "esm",
    minify: false,
    platform: "browser",
    sourcemap: true,
    target: "es2022",
  },
  lint: {
    ignorePatterns: ["**/generated/**", "**/*.gen.ts", "__tests__", "*.test.ts", "*.test.tsx"],
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
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    isolate: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
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
  plugins: codegenPlugins,
});
