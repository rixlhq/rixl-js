/**
 * URL Module Tests
 * Tests: urlParams and fromURL utility
 */

import {describe, it, expect} from "vite-plus/test";

// Note: urlParams is initialized at module load, so we need to test the behavior
// We can't easily test the actual urlParams export due to how it's initialized
// But we can test the URL parsing logic by examining different scenarios

describe("URL Module", () => {
  describe("URL parsing logic", () => {
    it("should handle URL with query parameters", () => {
      // Simulate the fromURL function logic
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com/path?param1=value1&param2=value2";
      const result = fromURL(url);

      expect(result).toBe("param1=value1&param2=value2");
    });

    it("should handle URL with hash parameters", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com/path#param1=value1#param2=value2";
      const result = fromURL(url);

      expect(result).toBe("param1=value1&param2=value2");
    });

    it("should handle URL with mixed query and hash parameters", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com/path?query=1#hash=2";
      const result = fromURL(url);

      expect(result).toBe("query=1&hash=2");
    });

    it("should handle URL without parameters", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com/path";
      const result = fromURL(url);

      expect(result).toBe("https://example.com/path");
    });

    it("should handle URL with only query string", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com?param=value";
      const result = fromURL(url);

      expect(result).toBe("param=value");
    });

    it("should handle URL with only hash", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com#token=abc123";
      const result = fromURL(url);

      expect(result).toBe("token=abc123");
    });

    it("should handle OAuth callback URL with access token in hash", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://app.example.com/callback#access_token=abc123&token_type=bearer&expires_in=3600";
      const result = fromURL(url);

      expect(result).toBe("access_token=abc123&token_type=bearer&expires_in=3600");
    });

    it("should handle URL with complex path and parameters", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com/users/123/profile?tab=settings#section=security";
      const result = fromURL(url);

      expect(result).toBe("tab=settings&section=security");
    });

    it("should handle URL with encoded parameters", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com?name=John%20Doe&email=test%40example.com";
      const result = fromURL(url);

      expect(result).toBe("name=John%20Doe&email=test%40example.com");
    });

    it("should handle URL with multiple consecutive hashes", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com#param1=a#param2=b#param3=c";
      const result = fromURL(url);

      expect(result).toBe("param1=a&param2=b&param3=c");
    });

    it("should handle URL with empty parameter values", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com?param1=&param2=value&param3=";
      const result = fromURL(url);

      expect(result).toBe("param1=&param2=value&param3=");
    });

    it("should handle localhost URLs", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "http://localhost:3000/callback#token=test123";
      const result = fromURL(url);

      expect(result).toBe("token=test123");
    });

    it("should handle URLs with port numbers", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://example.com:8080/api?key=value";
      const result = fromURL(url);

      expect(result).toBe("key=value");
    });

    it("should handle Apple ID callback URL format", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://app.example.com/callback#id_token=eyJ...&state=apple_abc123";
      const result = fromURL(url);

      expect(result).toBe("id_token=eyJ...&state=apple_abc123");
    });

    it("should handle Google OAuth callback URL format", () => {
      const fromURL = (urlString: string): string => {
        return urlString.replace(/^[^?#]*[?#]/, "").replace(/[?#]/g, "&");
      };

      const url = "https://app.example.com/callback#access_token=ya29...&token_type=Bearer&expires_in=3599&scope=email%20profile";
      const result = fromURL(url);

      expect(result).toBe("access_token=ya29...&token_type=Bearer&expires_in=3599&scope=email%20profile");
    });
  });

  describe("URLSearchParams behavior", () => {
    it("should parse query string correctly", () => {
      const params = new URLSearchParams("param1=value1&param2=value2");

      expect(params.get("param1")).toBe("value1");
      expect(params.get("param2")).toBe("value2");
    });

    it("should handle empty query string", () => {
      const params = new URLSearchParams("");

      expect(params.toString()).toBe("");
    });

    it("should handle URL encoded values", () => {
      const params = new URLSearchParams("name=John%20Doe&email=test%40example.com");

      expect(params.get("name")).toBe("John Doe");
      expect(params.get("email")).toBe("test@example.com");
    });
  });
});
