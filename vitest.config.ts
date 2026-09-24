import {fileURLToPath} from "node:url";
import {defineConfig} from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/auth", import.meta.url)),
    },
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
      thresholds: {
        lines: 74,
        functions: 59,
        branches: 64,
        statements: 74,
      },
    },
  },
});
