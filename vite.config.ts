import {fileURLToPath} from "node:url";
import {defineConfig} from "vite-plus";

// SDK codegen is opt-in via RIXL_GENERATE=true (the `generate` script and the
// Generate SDK workflow). Routine commands — vp check/fmt/test/pack and the
// pre-commit hook — must never regenerate src/generated or hit the network.
//
// When RIXL_GENERATE=true, the loader hook bridges `@hey-api/openapi-ts` to
// TypeScript 6 compiler APIs (`typescript-compat`), as TypeScript 7 replaced
// the classic JS Compiler API with native Go tooling.
// Node 24+ emits [DEP0205] with module.register(), so we prefer module.registerHooks().
const codegenPlugins =
  process.env.RIXL_GENERATE === "true"
    ? await (async () => {
        try {
          const {register, registerHooks} = await import("node:module");
          if (typeof registerHooks === "function") {
            registerHooks({
              resolve(specifier, context, nextResolve) {
                if (specifier === "typescript") {
                  return nextResolve("typescript-compat", context);
                }
                return nextResolve(specifier, context);
              },
            });
          } else if (typeof register === "function") {
            const {pathToFileURL} = await import("node:url");
            register(new URL("./scripts/ts-compat-hook.mjs", import.meta.url), pathToFileURL("./"));
          }
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
    entry: {index: "src/index.ts"},
    exports: true,
    dts: {
      generator: "tsgo",
    },
    format: "esm",
    minify: false,
    platform: "browser",
    sourcemap: true,
    target: "es2022",
  },
  lint: {
    // Generated code is the OpenAPI spec's shape; these rules apply to the hand-written SDK.
    ignorePatterns: ["**/generated/**", "**/*.gen.ts", "__tests__", "*.test.ts", "*.test.tsx", "vitest.setup.ts"],
    rules: {
      "typescript/no-explicit-any": "error",
      // Caps from the anti-slop guide (layer 5), the same as the other Rixl TypeScript repos.
      "eslint/complexity": ["error", {max: 10}],
      "eslint/max-lines-per-function": ["error", {max: 50, skipComments: true}],
      "eslint/max-lines": ["error", {max: 250, skipBlankLines: true, skipComments: true}],
      "eslint/max-params": ["error", 3],
      "eslint/max-depth": ["error", 3],
      "eslint/max-statements": ["error", 25],
      "eslint/max-classes-per-file": ["error", 1],
    },
    options: {
      typeAware: true,
      typeCheck: true,
      // A warning nobody fixes is noise: `vp check` (hook and release job) fails on any.
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
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
    environment: "happy-dom",
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
      // Measured 86.97 / 71.94 / 74.67 / 86.5 (statements / branches / functions / lines) when set,
      // rounded down with at least half a point spare. A ratchet: raise it as tests land; never lower it.
      thresholds: {
        lines: 86,
        functions: 74,
        branches: 71,
        statements: 86,
      },
    },
  },
  plugins: codegenPlugins,
});
