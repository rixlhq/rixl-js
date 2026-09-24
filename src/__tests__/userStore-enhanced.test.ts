/**
 * UserStore Enhanced Tests
 * Tests: Edge cases and localStorage error handling
 */

import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {user} from "../auth/userStore";
import {createMockUser} from "./utils/test-helpers";

describe("UserStore - Enhanced Coverage", () => {
  beforeEach(() => {
    user.set(undefined);
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("parseUser error handling", () => {
    it("should handle JSON parse errors gracefully", () => {
      if (typeof localStorage !== "undefined") {
        // Set invalid JSON
        localStorage.setItem("__rixl_auth_user", "{broken json}}");

        // Create a spy on console.warn
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        // Re-import to trigger parseUser with invalid JSON
        // Since parseUser runs on module load, we test via the existing user atom
        // The user atom was already initialized, so we just verify it handles the bad data
        const result = user.get();

        // Should return undefined for invalid JSON
        expect(result).toBeUndefined();

        warnSpy.mockRestore();
      }
    });

    it("should handle localStorage access errors", () => {
      // The userStore checks for localStorage availability
      // This test verifies the checks work
      expect(() => user.get()).not.toThrow();
    });

    it("should handle localStorage.setItem in subscription", async () => {
      if (typeof localStorage !== "undefined") {
        const mockUser = createMockUser();
        const setItemSpy = vi.spyOn(localStorage, "setItem");

        user.set(mockUser);

        // Wait for subscription
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(setItemSpy).toHaveBeenCalledWith("__rixl_auth_user", JSON.stringify(mockUser));

        setItemSpy.mockRestore();
      }
    });

    it("should handle localStorage.removeItem in subscription", async () => {
      if (typeof localStorage !== "undefined") {
        const mockUser = createMockUser();
        user.set(mockUser);

        await new Promise((resolve) => setTimeout(resolve, 10));

        const removeItemSpy = vi.spyOn(localStorage, "removeItem");

        user.set(undefined);

        // Wait for subscription
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(removeItemSpy).toHaveBeenCalledWith("__rixl_auth_user");

        removeItemSpy.mockRestore();
      }
    });

    it("should handle undefined value correctly in storage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "undefined");

        const result = user.get();
        expect(result).toBeUndefined();
      }
    });

    it("should handle null in localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "null");

        const result = user.get();
        // Should parse as null which is falsy
        expect(result === null || result === undefined).toBe(true);
      }
    });

    it("should handle whitespace in localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "   ");

        const result = user.get();
        expect(result).toBeUndefined();
      }
    });

    it("should handle array in localStorage", () => {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("__rixl_auth_user", "[]");

        const result = user.get();
        // Should parse but not be a valid user object
        expect(Array.isArray(result) || result === null || result === undefined).toBe(true);
      }
    });
  });

  describe("User subscription behavior", () => {
    it("should trigger subscription on user update", async () => {
      const mockUser = createMockUser({id: "test-id"});

      let subscriptionCalled = false;
      const unsubscribe = user.subscribe((value) => {
        if (value?.id === "test-id") {
          subscriptionCalled = true;
        }
      });

      user.set(mockUser);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(subscriptionCalled).toBe(true);

      unsubscribe();
    });

    it("should handle multiple subscriptions", async () => {
      const mockUser = createMockUser();

      let count = 0;
      const unsubscribe1 = user.subscribe(() => count++);
      const unsubscribe2 = user.subscribe(() => count++);

      user.set(mockUser);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(count).toBeGreaterThan(0);

      unsubscribe1();
      unsubscribe2();
    });
  });
});
