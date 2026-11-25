import {authV1BlogServiceGetBlogSubscription} from "../../generated/sdk.gen";
import {apiCall} from "../api/utils";
import {HTTP_STATUS} from "../constants";

export interface BlogSubscriptionStatus {
  subscribed: boolean;
  subscribed_at?: string;
}

const BLOG_SUBSCRIPTION_ERRORS = {
  [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to manage blog subscription"),
  [HTTP_STATUS.FORBIDDEN]: () => new Error("Account is inactive"),
  [HTTP_STATUS.TOO_MANY_REQUESTS]: () => new Error("Too many requests - please try again later"),
};

export const getBlogSubscriptionStatus = async (): Promise<BlogSubscriptionStatus> => {
  return apiCall(async () => {
    const {data} = await authV1BlogServiceGetBlogSubscription({
      throwOnError: true,
    });
    return {
      subscribed: data.subscribed ?? false,
      subscribed_at: data.subscribed_at,
    };
  }, BLOG_SUBSCRIPTION_ERRORS);
};
