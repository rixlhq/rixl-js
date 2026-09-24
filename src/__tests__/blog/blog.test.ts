import {beforeEach, describe, expect, it, vi} from "vite-plus/test";
import * as initialization from "../../auth/initialization";

const mockGetAuthV1BlogSubscription = vi.fn();
const mockPostAuthV1BlogSubscribe = vi.fn();
const mockPostAuthV1BlogUnsubscribe = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1BlogServiceGetBlogSubscription: (...args: unknown[]) => mockGetAuthV1BlogSubscription(...args),
  authV1BlogServiceSubscribeBlog: (...args: unknown[]) => mockPostAuthV1BlogSubscribe(...args),
  authV1BlogServiceUnsubscribeBlog: (...args: unknown[]) => mockPostAuthV1BlogUnsubscribe(...args),
}));

import {getBlogSubscriptionStatus, subscribeToBlog, unsubscribeFromBlog, type BlogSubscriptionStatus} from "@/blog";

describe("Blog subscription API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initialization.initDeferred.promise = Promise.resolve();
    mockGetAuthV1BlogSubscription.mockReset();
    mockPostAuthV1BlogSubscribe.mockReset();
    mockPostAuthV1BlogUnsubscribe.mockReset();
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

  it("subscribes the current user to blog updates", async () => {
    mockPostAuthV1BlogSubscribe.mockResolvedValue({data: {}});

    await subscribeToBlog();

    expect(mockPostAuthV1BlogSubscribe).toHaveBeenCalledWith({
      throwOnError: true,
    });
  });

  it("unsubscribes the current user from blog updates", async () => {
    mockPostAuthV1BlogUnsubscribe.mockResolvedValue({data: {}});

    await unsubscribeFromBlog();

    expect(mockPostAuthV1BlogUnsubscribe).toHaveBeenCalledWith({
      throwOnError: true,
    });
  });

  it("handles unauthorized errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "unauthorized", code: 401});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });

  it("handles server errors for subscribe failures", async () => {
    mockPostAuthV1BlogSubscribe.mockRejectedValue({error: "server_error", code: 500});

    await expect(subscribeToBlog()).rejects.toThrow();
  });

  it("handles forbidden errors for subscribe failures", async () => {
    mockPostAuthV1BlogSubscribe.mockRejectedValue({error: "forbidden", code: 403});

    await expect(subscribeToBlog()).rejects.toThrow();
  });

  it("handles rate-limit errors for subscribe failures", async () => {
    mockPostAuthV1BlogSubscribe.mockRejectedValue({error: "too_many_requests", code: 429});

    await expect(subscribeToBlog()).rejects.toThrow();
  });

  it("handles unauthorized errors for subscribe failures", async () => {
    mockPostAuthV1BlogSubscribe.mockRejectedValue({error: "unauthorized", code: 401});

    await expect(subscribeToBlog()).rejects.toThrow();
  });

  it("handles forbidden errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "forbidden", code: 403});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });

  it("handles rate-limit errors for subscription reads", async () => {
    mockGetAuthV1BlogSubscription.mockRejectedValue({error: "too_many_requests", code: 429});

    await expect(getBlogSubscriptionStatus()).rejects.toThrow();
  });

  it("handles unauthorized errors for unsubscribe failures", async () => {
    mockPostAuthV1BlogUnsubscribe.mockRejectedValue({error: "unauthorized", code: 401});

    await expect(unsubscribeFromBlog()).rejects.toThrow();
  });

  it("handles forbidden errors for unsubscribe failures", async () => {
    mockPostAuthV1BlogUnsubscribe.mockRejectedValue({error: "forbidden", code: 403});

    await expect(unsubscribeFromBlog()).rejects.toThrow();
  });

  it("handles rate-limit errors for unsubscribe failures", async () => {
    mockPostAuthV1BlogUnsubscribe.mockRejectedValue({error: "too_many_requests", code: 429});

    await expect(unsubscribeFromBlog()).rejects.toThrow();
  });

  it("handles server errors for unsubscribe failures", async () => {
    mockPostAuthV1BlogUnsubscribe.mockRejectedValue({error: "server_error", code: 500});

    await expect(unsubscribeFromBlog()).rejects.toThrow();
  });
});
