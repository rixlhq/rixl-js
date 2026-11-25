import {beforeEach, describe, expect, it, vi} from "vite-plus/test";
import * as initialization from "../../auth/initialization";

const mockGetAuthV1BlogSubscription = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1BlogServiceGetBlogSubscription: (...args: unknown[]) => mockGetAuthV1BlogSubscription(...args),
}));

import {getBlogSubscriptionStatus, type BlogSubscriptionStatus} from "@/blog";

describe("Blog subscription API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockGetAuthV1BlogSubscription.mockReset();
  });

  it("fetches current blog subscription status", async () => {
    const response: BlogSubscriptionStatus = {
      subscribed: true,
      subscribed_at: "2026-04-23T12:00:00Z",
    };
    mockGetAuthV1BlogSubscription.mockResolvedValue({data: response});

    const result = await getBlogSubscriptionStatus();

    expect(mockGetAuthV1BlogSubscription).toHaveBeenCalledWith({
      throwOnError: true,
    });
    expect(result).toEqual(response);
  });

  it("handles unauthorized errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "unauthorized", code: 401});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });

  it("handles forbidden errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "forbidden", code: 403});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });

  it("handles rate-limit errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "too_many_requests", code: 429});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });
});
