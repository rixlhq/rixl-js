import {decodeJwt} from "jose";
import {ApiError} from "../api/types";
import {HTTP_STATUS, STATE_STORAGE_KEY_PREFIX} from "../constants";
import {urlParams} from "../url";
import {AuthProvider} from "./types";

/**
 * A provider login that fails bounces straight back to the login page, and the
 * page can only say "it failed" — the one thing worth knowing, whether the
 * gateway rejected the credential or the SDK sent the wrong thing, is invisible.
 *
 * This prints both sides of the /auth/v1/token exchange and names the side to
 * look at. It runs only on failure, so it costs nothing on a working login. The
 * raw credential is never logged; only the claims needed to tell the cases apart.
 */

interface CredentialClaims {
  iss?: string;
  aud?: string;
  exp?: string;
  expired?: boolean;
  nonce?: string;
  email?: string;
  note?: string;
}

const claimsOf = (token: string): CredentialClaims => {
  try {
    const {iss, aud, exp, nonce, email} = decodeJwt(token) as Record<string, unknown>;
    return {
      iss: String(iss ?? ""),
      // Must equal the client ID the gateway is configured with. A mismatch here
      // is the usual reason a perfectly valid Google token comes back as 401.
      aud: String(aud ?? ""),
      exp: exp ? new Date(Number(exp) * 1000).toISOString() : undefined,
      expired: typeof exp === "number" && Date.now() >= exp * 1000,
      // The SDK sends the OAuth `state` as the nonce, so this should match the
      // `state` param the provider echoed back.
      nonce: String(nonce ?? ""),
      email: String(email ?? ""),
    };
  } catch {
    return {note: "not a JWT — expected for Telegram, unexpected for Google/Apple/Microsoft"};
  }
};

const verdictFor = (error: ApiError): string => {
  const body = typeof error.data === "object" && error.data !== null ? (error.data as {error?: string}) : undefined;

  if (body?.error === "invalid token type") {
    return "CLIENT: the gateway does not accept this token_type. Expected one of Bearer, google, apple, microsoft, telegram, tgWebAppData.";
  }
  if (error.status === HTTP_STATUS.UNAUTHORIZED) {
    return "BACKEND or CONFIG: the gateway could not verify the credential. Compare `aud` above with the client ID the gateway is configured with, and check `expired`.";
  }
  if (error.status === HTTP_STATUS.CONFLICT) {
    return "EXPECTED: this email already belongs to an account created with a different provider.";
  }
  if (error.status === HTTP_STATUS.BAD_REQUEST) {
    return "BACKEND: the gateway rejected the request body. Read `response.body` for its reason.";
  }
  return "UNKNOWN: see `response` below.";
};

const describe = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return {
      response: {status: "none — the request never completed", detail: String(error)},
      verdict: "NETWORK or CORS: the browser never got a response. Check the gateway is reachable and its CORS headers allow this origin.",
    };
  }
  return {
    response: {status: error.status, body: error.data, message: error.message},
    verdict: verdictFor(error),
  };
};

const OAUTH_PROVIDERS = [AuthProvider.GOOGLE, AuthProvider.APPLE, AuthProvider.MICROSOFT];

const storedStates = (): Record<string, string> =>
  Object.fromEntries(OAUTH_PROVIDERS.map((p) => [p, sessionStorage.getItem(STATE_STORAGE_KEY_PREFIX + p) ?? "(none)"]));

/**
 * Reports a provider response that arrived but could not be used, which ends the
 * login without a request ever being sent — the case that otherwise looks like
 * "it just went back to the login page".
 *
 * `detectProvider()` requires the `state` in the URL to equal the one stored when
 * the login started, so the two states below are the thing to compare.
 */
export const logUnusableProviderResponse = (): void => {
  const state = urlParams.get("state") ?? "(none)";

  console.error("[@rixl/sdk] a provider response is in the URL but no login was attempted", {
    urlState: state,
    storedStates: storedStates(),
    credentialParams: ["id_token", "code", "access_token"].filter((key) => urlParams.has(key)),
    verdict:
      state === "(none)"
        ? "CLIENT: the provider returned no `state`, so the response cannot be matched to a login attempt."
        : "CLIENT: `urlState` does not match the stored state for its provider. sessionStorage was cleared, the login " +
          "started in a different tab, or the response was replayed after the state had already been retired.",
  });
};

/**
 * Reports a failed provider token exchange. `provider` doubles as the `token_type`
 * sent on the wire, so it is printed as-is.
 */
export const logProviderExchangeFailure = (provider: AuthProvider, credential: string, error: unknown): void => {
  console.error("[@rixl/sdk] provider login failed at POST /auth/v1/token", {
    request: {token_type: provider, credential: claimsOf(credential)},
    ...describe(error),
  });
};
