import baseConfig from "../vite.config.ts";

// Stryker reruns the tests once per mutant, so coverage stays off.
export default {
  ...baseConfig,
  test: {...baseConfig.test, coverage: {enabled: false}},
};
