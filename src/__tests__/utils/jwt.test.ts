/**
 * JWT utilities test suite
 * Tests: decodeToken, decodeAndSetUser, isTokenExpired
 */

import {describe, it, expect, beforeEach} from "vite-plus/test";
import {decodeToken, decodeAndSetUser, isTokenExpired} from "@/utils/jwt";
import {user} from "@/userStore";
import {createMockJWT, createMockUser} from "./test-helpers";

describe("JWT Utils", () => {
  describe("decodeToken", () => {
    it("should decode valid JWT token", () => {
      const token = createMockJWT({id: "custom-id", username: "custom-user"});
      const result = decodeToken(token);

      expect(result).toMatchObject({
        id: "custom-id",
        username: "custom-user",
      });
    });

    it("should return undefined for invalid token", () => {
      const result = decodeToken("invalid.token.here");
      expect(result).toBeUndefined();
    });

    it("should return undefined for malformed token", () => {
      const result = decodeToken("not-a-jwt");
      expect(result).toBeUndefined();
    });

    it("should handle empty token", () => {
      const result = decodeToken("");
      expect(result).toBeUndefined();
    });

    it("should extract all user fields correctly", () => {
      const mockData = createMockUser({
        first_name: "John",
        last_name: "Doe",
        language_code: "fr",
      });
      const token = createMockJWT(mockData);
      const result = decodeToken(token);

      expect(result).toEqual(mockData);
    });
  });

  describe("decodeAndSetUser", () => {
    beforeEach(() => {
      user.set(undefined);
    });

    it("should decode token and set user in store", () => {
      const token = createMockJWT();
      const result = decodeAndSetUser(token);

      expect(result).toBe(true);
      expect(user.get()).toBeDefined();
      expect(user.get()?.username).toBe("testuser");
    });

    it("should return false for invalid token", () => {
      const result = decodeAndSetUser("invalid-token");

      expect(result).toBe(false);
      expect(user.get()).toBeUndefined();
    });

    it("should update user store with correct data", () => {
      const mockData = {username: "newuser", id: "new123"};
      const token = createMockJWT(mockData);

      decodeAndSetUser(token);

      const storedUser = user.get();
      expect(storedUser?.username).toBe("newuser");
      expect(storedUser?.id).toBe("new123");
    });
  });

  describe("isTokenExpired", () => {
    it("should return true for expired timestamp", () => {
      const pastTime = Date.now() - 1000;
      expect(isTokenExpired(pastTime)).toBe(true);
    });

    it("should return false for future timestamp", () => {
      const futureTime = Date.now() + 10000;
      expect(isTokenExpired(futureTime)).toBe(false);
    });

    it("should return true for undefined timestamp", () => {
      expect(isTokenExpired(undefined)).toBe(true);
    });

    it("should return true for exactly current timestamp", () => {
      const now = Date.now();
      expect(isTokenExpired(now)).toBe(true);
    });

    it("should handle edge case: 1ms before expiry", () => {
      const almostExpired = Date.now() + 1;
      expect(isTokenExpired(almostExpired)).toBe(false);
    });
  });
});
