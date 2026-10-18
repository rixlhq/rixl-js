import {authV1TokenServiceLogout} from "../../generated/sdk.gen";
import type {AuthV1LogoutRequest} from "../../generated/types.gen";
import {accessToken, refreshToken, removeTokens} from "../authStore";

export const logout = async (): Promise<void> => {
  try {
    // The backend blacklists `token` as an access token and deletes `refresh_token`
    // from the session store. refresh_token is not in the generated type until the
    // SDK is regenerated.
    const body: AuthV1LogoutRequest & {refresh_token?: string} = {
      token: accessToken.get(),
      refresh_token: refreshToken.get(),
    };
    await authV1TokenServiceLogout({body, throwOnError: true});
  } catch {
    // Revocation failed — still clear local state
  } finally {
    removeTokens();
  }
};
