/**
 * JWT Utils Coverage Tests
 * Tests: Edge cases in JWT parsing
 */

import {describe, it, expect} from "vite-plus/test";
import {decodeToken, decodeAndSetUser, isTokenExpired} from "@/utils/jwt.ts";

describe("JWT Utils - Coverage", () => {
  describe("decodeToken edge cases", () => {
    it("should handle invalid tokens", () => {
      const result = decodeToken("invalid.token.here");
      expect(result).toBeUndefined();
    });

    it("should handle tokens with missing parts", () => {
      const result = decodeToken("onlyonepart");
      expect(result).toBeUndefined();
    });

    it("should handle empty token", () => {
      const result = decodeToken("");
      expect(result).toBeUndefined();
    });

    it("should handle malformed JWT", () => {
      const result = decodeToken("not-a-jwt-at-all");
      expect(result).toBeUndefined();
    });
  });

  describe("decodeAndSetUser", () => {
    it("should return false for invalid token", () => {
      const result = decodeAndSetUser("invalid-token");
      expect(result).toBe(false);
    });

    it("should return false for empty token", () => {
      const result = decodeAndSetUser("");
      expect(result).toBe(false);
    });

    it("should handle malformed tokens gracefully", () => {
      const result = decodeAndSetUser("abc.def.ghi");
      expect(result).toBe(false);
    });
  });

  describe("isTokenExpired edge cases", () => {
    it("should return true for undefined expiration", () => {
      const result = isTokenExpired(undefined);
      expect(result).toBe(true);
    });

    it("should return true for expired timestamp", () => {
      const pastTimestamp = Date.now() - 1000;
      const result = isTokenExpired(pastTimestamp);
      expect(result).toBe(true);
    });

    it("should return false for future timestamp", () => {
      const futureTimestamp = Date.now() + 10000;
      const result = isTokenExpired(futureTimestamp);
      expect(result).toBe(false);
    });

    it("should return true for current timestamp", () => {
      const currentTimestamp = Date.now();
      const result = isTokenExpired(currentTimestamp);
      // Should be true as Date.now() >= expireAt
      expect(result).toBe(true);
    });

    it("should handle zero timestamp", () => {
      const result = isTokenExpired(0);
      expect(result).toBe(true);
    });
  });
});
