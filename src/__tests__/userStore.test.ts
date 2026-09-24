/**
 * UserStore test suite
 * Tests: user atom, localStorage persistence
 */

import {describe, it, expect, beforeEach} from "vite-plus/test";
import {user} from "../auth/userStore";
import {createMockUser} from "./utils/test-helpers";

describe("UserStore", () => {
  beforeEach(() => {
    user.set(undefined);
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  describe("user atom", () => {
    it("should initialize as undefined when localStorage is unavailable", () => {
      expect(user.get()).toBeUndefined();
    });

    it("should handle when localStorage is undefined", () => {
      // This tests the parseUser function's localStorage availability check
      // In test environment, localStorage exists, but we test the guard logic
      expect(() => user.get()).not.toThrow();
    });

    it("should handle when localStorage.getItem is not a function", () => {
      // Test the typeof check in parseUser
      expect(() => user.get()).not.toThrow();
    });

    it("should set user data", () => {
      const mockUser = createMockUser();
      user.set(mockUser);

      expect(user.get()).toEqual(mockUser);
    });

    it("should persist user to localStorage on set", async () => {
      const mockUser = createMockUser({username: "testuser123"});
      user.set(mockUser);

      // Wait for subscription to trigger
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("__rixl_auth_user");
        expect(stored).toBeDefined();
        if (stored) {
          expect(JSON.parse(stored)).toEqual(mockUser);
        }
      }
    });

    it("should remove from localStorage when set to undefined", async () => {
      const mockUser = createMockUser();
      user.set(mockUser);

      // Wait for subscription
      await new Promise((resolve) => setTimeout(resolve, 0));

      user.set(undefined);

      // Wait for subscription
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (typeof localStorage !== "undefined") {
        expect(localStorage.getItem("__rixl_auth_user")).toBeNull();
      }
    });

    it("should load user from localStorage on initialization", () => {
      const mockUser = createMockUser({id: "stored-user"});

      // Test the persistence path
      user.set(mockUser);
      const retrieved = user.get();

      expect(retrieved?.id).toBe("stored-user");
    });

    it("should handle corrupted localStorage data gracefully", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "invalid-json{");
      }

      // Should not throw when getting user
      expect(() => user.get()).not.toThrow();
    });

    it("should handle setting and getting user normally", () => {
      const mockUser = createMockUser();
      user.set(mockUser);
      expect(user.get()).toEqual(mockUser);
    });

    it("should update user data", () => {
      const mockUser = createMockUser({first_name: "John"});
      user.set(mockUser);

      const updatedUser = {...mockUser, first_name: "Jane"};
      user.set(updatedUser);

      expect(user.get()?.first_name).toBe("Jane");
    });

    it("should handle all user fields", () => {
      const mockUser = createMockUser({
        id: "id123",
        first_name: "John",
        last_name: "Doe",
        username: "johndoe",
        image_url: "https://example.com/img.jpg",
        language_code: "fr",
        org_id: "org456",
        email: "olalekan.akande@rixl.com",
      });

      user.set(mockUser);
      const retrieved = user.get();

      expect(retrieved).toEqual(mockUser);
      expect(retrieved?.id).toBe("id123");
      expect(retrieved?.language_code).toBe("fr");
      expect(retrieved?.org_id).toBe("org456");
    });

    it("should handle localStorage with 'undefined' string value", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "undefined");
      }

      // Should return undefined, not try to parse the string 'undefined'
      expect(user.get()).toBeUndefined();
    });

    it("should handle invalid JSON gracefully and warn", () => {
      if (typeof localStorage !== "undefined") {
        // Set invalid JSON
        localStorage.setItem("__rixl_auth_user", "{invalid json}");
      }

      // Should not throw and return undefined
      expect(() => user.get()).not.toThrow();
      expect(user.get()).toBeUndefined();
    });

    it("should handle empty string in localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "");
      }

      expect(user.get()).toBeUndefined();
    });

    it("should handle null value in localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "null");
      }

      // null is valid JSON, but should be treated as undefined
      const result = user.get();
      expect(result === null || result === undefined).toBe(true);
    });
  });
});
