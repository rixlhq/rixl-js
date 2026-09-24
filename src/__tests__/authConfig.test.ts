// @vitest-environment jsdom
import {describe, it, expect, vi, beforeEach} from "vite-plus/test";
import {redirectToLogin, setLoginRedirectUrl} from "../auth/authConfig";

describe("authConfig", () => {
  beforeEach(() => {
    // Reset state
    setLoginRedirectUrl(undefined);
  });

  describe("redirectToLogin", () => {
    it("should do nothing if no redirect url set", () => {
      // Mock window location setter
      const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
        href: "current-url",
      } as any);

      redirectToLogin();
      expect(window.location.href).toBe("current-url");

      locationSpy.mockRestore();
    });

    it("should redirect to set url if window exists", () => {
      setLoginRedirectUrl("https://login.example.com");

      // We need to mock window.location assignment.
      // In jsdom, location object is special.
      // Often better to use Object.defineProperty

      const originalLocation = window.location;

      // Mocking window.location is tricky in jsdom.
      // However, we can check if it *tried* to assign.
      // But typically jsdom allows reading, maybe not assigning cross-origin?
      // Let's try simple assignment check if jsdom allows it.

      // Actually, safest way is spy on assignment? No, JS properties don't support assignment spies easily.

      // Workaround: Mock "window" property? No, global window.

      // Let's try this approach:
      delete (window as any).location;
      // @ts-ignore
      window.location = {href: "start"};

      redirectToLogin();
      expect(window.location.href).toBe("https://login.example.com");

      // Restore
      window.location = originalLocation as any;
    });
  });
});
