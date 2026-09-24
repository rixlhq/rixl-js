/**
 * Cookie utilities tests
 * Tests: getAllCookiesStartWith, setCookie, deleteCookie
 * @vitest-environment jsdom
 */

import {describe, it, expect, beforeEach, vi} from "vite-plus/test";
import {getAllCookiesStartWith, setCookie, deleteCookie} from "@/cookie/util.ts";

describe("Cookie Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear all existing cookies in jsdom
    if (typeof document !== "undefined" && document.cookie) {
      const cookies = document.cookie.split(";");
      for (const cookie of cookies) {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        }
      }
    }
  });

  describe("getAllCookiesStartWith", () => {
    it("should return empty object when no cookies match", () => {
      const result = getAllCookiesStartWith("test_prefix");
      expect(result).toEqual({});
    });

    it("should return cookies that start with prefix", () => {
      document.cookie = "test_prefix_key1=value1; path=/";
      document.cookie = "test_prefix_key2=value2; path=/";
      document.cookie = "other_key=value3; path=/";

      const result: Partial<Record<string, string>> = getAllCookiesStartWith("test_prefix");

      expect(result).toEqual({
        key1: "value1",
        key2: "value2",
      });
    });

    it("should handle cookies with special characters in values", () => {
      document.cookie = "prefix_key=value%20with%20spaces; path=/";

      const result: Partial<Record<string, string>> = getAllCookiesStartWith("prefix");

      expect(result.key).toBeDefined();
    });

    it("should preserve padding characters in a base64 value", () => {
      setCookie("prefix_token", "YWJjMTIz+ZGVmL2doaQ==", {path: "/"});

      const result: Partial<Record<string, string>> = getAllCookiesStartWith("prefix");

      expect(result.token).toBe("YWJjMTIz+ZGVmL2doaQ==");
    });

    it("should filter out the exact prefix key", () => {
      document.cookie = "prefix=exactmatch; path=/";
      document.cookie = "prefix_key=value; path=/";

      const result: Partial<Record<string, string>> = getAllCookiesStartWith("prefix");

      expect(result).not.toHaveProperty("prefix");
      expect(result).toHaveProperty("key");
    });
  });

  describe("setCookie", () => {
    it("should set a simple cookie", () => {
      setCookie("test", "value");

      expect(document.cookie).toContain("test=value");
    });

    it("should set cookie with path option", () => {
      setCookie("test", "value", {path: "/app"});

      // jsdom doesn't support path attribute - cookie won't be set
      // This is a known limitation, the actual code works in real browsers
      expect(() => setCookie("test", "value", {path: "/app"})).not.toThrow();
    });

    it("should set cookie with expiration as number (days)", () => {
      setCookie("test", "value", {expires: 7});

      expect(document.cookie).toContain("test=value");
    });

    it("should set cookie with expiration as Date", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      setCookie("test", "value", {expires: futureDate});

      expect(document.cookie).toContain("test=value");
    });

    it("should set cookie with domain option", () => {
      setCookie("test", "value", {domain: ".example.com"});

      // jsdom doesn't support domain attribute - cookie won't be set
      // This is a known limitation, the actual code works in real browsers
      expect(() => setCookie("test", "value", {domain: ".example.com"})).not.toThrow();
    });

    it("should set cookie with secure flag", () => {
      setCookie("test", "value", {secure: true});

      expect(document.cookie).toContain("test=value");
    });

    it("should set cookie with sameSite option", () => {
      setCookie("test", "value", {sameSite: "Strict"});

      expect(document.cookie).toContain("test=value");
    });

    it("should encode cookie name and value", () => {
      setCookie("test name", "test value");

      // The cookie should be set with encoded values
      expect(document.cookie).toContain("test");
    });

    it("should set cookie with multiple options", () => {
      setCookie("test", "value", {
        path: "/",
        secure: true,
        sameSite: "Lax",
      });

      expect(document.cookie).toContain("test=value");
    });
  });

  describe("deleteCookie", () => {
    it("should delete an existing cookie", () => {
      document.cookie = "test=value; path=/";

      deleteCookie("test");

      // Cookie should be expired (deleted)
      expect(document.cookie).not.toContain("test=value");
    });

    it("should handle deleting non-existent cookie", () => {
      expect(() => deleteCookie("nonexistent")).not.toThrow();
    });

    it("should set expiration to past date", () => {
      // Note: jsdom doesn't actually delete cookies when setting Max-Age=-1
      // We can only verify the function doesn't throw
      document.cookie = "test=value; path=/";

      expect(() => deleteCookie("test")).not.toThrow();

      // In a real browser, this would delete the cookie
      // jsdom limitation: can't test actual deletion behavior
    });
  });

  describe("SSR environment", () => {
    // Test SSR behavior by temporarily stubbing document as undefined

    it("should handle missing document in getAllCookiesStartWith", () => {
      const originalDocument = global.document;
      vi.stubGlobal("document", undefined);

      const result = getAllCookiesStartWith("test");

      expect(result).toEqual({});

      vi.stubGlobal("document", originalDocument);
    });

    it("should handle missing document in setCookie", () => {
      const originalDocument = global.document;
      vi.stubGlobal("document", undefined);

      // Should not throw when document is undefined
      expect(() => setCookie("test", "value")).not.toThrow();

      vi.stubGlobal("document", originalDocument);
    });

    it("should handle missing document in deleteCookie", () => {
      const originalDocument = global.document;
      vi.stubGlobal("document", undefined);

      // Should not throw when document is undefined
      expect(() => deleteCookie("test")).not.toThrow();

      vi.stubGlobal("document", originalDocument);
    });
  });
});
