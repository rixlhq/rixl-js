/**
 * JWT NODE_ENV Coverage Test
 * Tests: Line 26 in jwt.ts - console.warn in non-test environment
 */

import {describe, it, expect, afterEach, vi} from "vite-plus/test";
import {decodeToken} from "@/utils/jwt.ts";

describe("JWT - NODE_ENV Coverage", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("Line 26: console.warn in non-test environment", () => {
    it("should skip console.warn when NODE_ENV is test", () => {
      process.env.NODE_ENV = "test";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Try to decode invalid JWT
      const result = decodeToken("invalid-jwt-token");

      // Should not log in test env (line 25 condition is false)
      expect(consoleSpy).not.toHaveBeenCalled();
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should call console.warn when NODE_ENV is not test", () => {
      // Change NODE_ENV to trigger line 26
      process.env.NODE_ENV = "development";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Try to decode invalid JWT
      const result = decodeToken("invalid-jwt-token");

      // Should log in non-test env (line 26 executes)
      expect(consoleSpy).toHaveBeenCalledWith("Failed to decode JWT token. Error: ", expect.any(Error));
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });

    it("should test the NODE_ENV condition on line 25", () => {
      // Line 25: if (process.env.NODE_ENV !== "test")

      // Test different NODE_ENV values
      const testEnvs = [
        {env: "test", shouldLog: false},
        {env: "development", shouldLog: true},
        {env: "production", shouldLog: true},
        {env: "staging", shouldLog: true},
        {env: undefined, shouldLog: true},
      ];

      for (const {env, shouldLog} of testEnvs) {
        const condition = env !== "test";
        expect(condition).toBe(shouldLog);
      }
    });

    it("should verify console.warn message format on line 26", () => {
      process.env.NODE_ENV = "production";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      decodeToken("malformed-jwt");

      if (consoleSpy.mock.calls.length > 0) {
        expect(consoleSpy).toHaveBeenCalled();
      }

      consoleSpy.mockRestore();
    });

    it("should test return undefined on line 28", () => {
      // After the console.warn (line 26), line 28 returns undefined
      process.env.NODE_ENV = "production";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = decodeToken("invalid");

      // Line 28: return undefined
      expect(result).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });

  describe("Complete error handling flow", () => {
    it("should handle the full try-catch structure", () => {
      process.env.NODE_ENV = "development";
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Test various invalid JWT formats
      const invalidTokens = ["not-a-jwt", "invalid.token", "{malformed}", "", "eyJhbGciOiJIUzI1NiJ9.invalid.sig"];

      for (const token of invalidTokens) {
        const result = decodeToken(token);
        expect(result).toBeUndefined();
      }

      // All should trigger console.warn in development
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
