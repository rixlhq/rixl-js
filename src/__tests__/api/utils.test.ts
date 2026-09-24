/**
 * API Utils Module Tests
 * Tests: apiCall helper function
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {apiCall} from "@/api/utils.ts";

// Mock initialization
vi.mock("../../auth/initialization", () => ({
  initDeferred: {
    promise: Promise.resolve(),
  },
}));

// Mock API client
vi.mock("../../auth/api/error-handlers", () => ({
  handleApiError: vi.fn((error: any, statusHandlers: Record<number, () => Error>) => {
    if (error && typeof error === "object" && "status" in error) {
      const handler = statusHandlers[error.status];
      if (handler) throw handler();
      throw error;
    }
    throw error;
  }),
}));

describe("API Utils Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("apiCall", () => {
    it("should execute function successfully", async () => {
      const mockFn = vi.fn().mockResolvedValue({success: true});

      const result = await apiCall(mockFn);

      expect(mockFn).toHaveBeenCalled();
      expect(result).toEqual({success: true});
    });

    it("should wait for initialization before executing", async () => {
      const mockFn = vi.fn().mockResolvedValue("data");

      const result = await apiCall(mockFn);

      expect(result).toBe("data");
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle successful API calls with different return types", async () => {
      const stringFn = vi.fn().mockResolvedValue("string result");
      const numberFn = vi.fn().mockResolvedValue(42);
      const objectFn = vi.fn().mockResolvedValue({id: 1, name: "test"});
      const arrayFn = vi.fn().mockResolvedValue([1, 2, 3]);

      expect(await apiCall(stringFn)).toBe("string result");
      expect(await apiCall(numberFn)).toBe(42);
      expect(await apiCall(objectFn)).toEqual({id: 1, name: "test"});
      expect(await apiCall(arrayFn)).toEqual([1, 2, 3]);
    });

    it("should handle errors with status code mapping", async () => {
      const mockError = {status: 404, message: "Not Found"};
      const mockFn = vi.fn().mockRejectedValue(mockError);
      const errorMap = {
        404: () => new Error("Resource not found!"),
      };

      await expect(apiCall(mockFn, errorMap)).rejects.toThrow("Resource not found!");
    });

    it("should handle errors without error map", async () => {
      const mockError = new Error("Network error");
      const mockFn = vi.fn().mockRejectedValue(mockError);

      await expect(apiCall(mockFn)).rejects.toThrow("Network error");
    });

    it("should handle multiple error status codes", async () => {
      const errorMap = {
        400: () => new Error("Bad request!"),
        401: () => new Error("Unauthorized!"),
        403: () => new Error("Forbidden!"),
        404: () => new Error("Not found!"),
        500: () => new Error("Server error!"),
      };

      const testError = async (status: number, expectedMessage: string) => {
        const mockError = {status, message: "Error"};
        const mockFn = vi.fn().mockRejectedValue(mockError);
        await expect(apiCall(mockFn, errorMap)).rejects.toThrow(expectedMessage);
      };

      await testError(400, "Bad request!");
      await testError(401, "Unauthorized!");
      await testError(403, "Forbidden!");
      await testError(404, "Not found!");
      await testError(500, "Server error!");
    });

    it("should pass through errors without matching status code", async () => {
      const mockError = {status: 418, message: "I'm a teapot"};
      const mockFn = vi.fn().mockRejectedValue(mockError);
      const errorMap = {
        404: () => new Error("Not found!"),
      };

      await expect(apiCall(mockFn, errorMap)).rejects.toEqual(mockError);
    });

    it("should handle async function with complex logic", async () => {
      const complexFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          data: "complex result",
          timestamp: Date.now(),
        };
      });

      const result = await apiCall(complexFn);

      expect(result).toHaveProperty("data", "complex result");
      expect(result).toHaveProperty("timestamp");
      expect(typeof result.timestamp).toBe("number");
    });

    it("should work with empty error map", async () => {
      const mockFn = vi.fn().mockResolvedValue("success");

      const result = await apiCall(mockFn, {});

      expect(result).toBe("success");
    });

    it("should handle null return value", async () => {
      const mockFn = vi.fn().mockResolvedValue(null);

      const result = await apiCall(mockFn);

      expect(result).toBeNull();
    });

    it("should handle undefined return value", async () => {
      const mockFn = vi.fn().mockResolvedValue(undefined);

      const result = await apiCall(mockFn);

      expect(result).toBeUndefined();
    });

    it("should handle boolean return values", async () => {
      const trueFn = vi.fn().mockResolvedValue(true);
      const falseFn = vi.fn().mockResolvedValue(false);

      expect(await apiCall(trueFn)).toBe(true);
      expect(await apiCall(falseFn)).toBe(false);
    });

    it("should execute function only once", async () => {
      const mockFn = vi.fn().mockResolvedValue("result");

      await apiCall(mockFn);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should handle errors in async functions properly", async () => {
      const mockFn = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        throw new Error("Async error");
      });

      await expect(apiCall(mockFn)).rejects.toThrow("Async error");
    });

    it("should handle void return type", async () => {
      const mockFn = vi.fn(async () => {
        // Function that returns void
      });

      const result = await apiCall(mockFn);

      expect(result).toBeUndefined();
      expect(mockFn).toHaveBeenCalled();
    });
  });
});
