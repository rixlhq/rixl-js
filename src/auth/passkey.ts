import {
  authV1PasskeyServiceDeletePasskey,
  authV1PasskeyServiceListPasskeys,
  authV1PasskeyServiceRenamePasskey,
  authV1PasskeyServicePasskeyLoginBegin,
  authV1PasskeyServicePasskeyLoginFinish,
  authV1PasskeyServicePasskeyRegisterBegin,
  authV1PasskeyServicePasskeyRegisterFinish,
  authV1PasskeyServiceVerifyPasskeyForLogin,
} from "../generated/sdk.gen";
import {apiCall} from "./api/utils";
import {persistTokens} from "./api/tokens";
import {HTTP_STATUS} from "./constants";
import {decodeCreationOptions, decodeRequestOptions, serializeLoginCredential, serializeRegistrationCredential} from "./passkey-codec";

export {decodeRequestOptions} from "./passkey-codec";

export interface PasskeyBeginLogin {
  session_id: string;
  options: PublicKeyCredentialRequestOptions;
}

/**
 * Thrown by {@link beginPasskeyLogin} when the server responds successfully
 * but with no credential options — typically because the account has no
 * passkeys enrolled. The OpenAPI schema does not formally model this state
 * (both `session_id` and `options` are optional on `PasskeyBeginResponse`),
 * so callers should distinguish it via `instanceof` rather than error text.
 */
export class PasskeyUnavailableError extends Error {
  constructor(message = "No passkeys available for this account") {
    super(message);
    this.name = "PasskeyUnavailableError";
  }
}

export interface PasskeyBeginRegistration {
  session_id: string;
  options: PublicKeyCredentialCreationOptions;
}

export interface PasskeyRegistrationResult {
  passkey_id: string;
  name: string;
}

export interface Passkey {
  id: string;
  name: string;
  credential_id: string;
  aaguid: string;
  backup_state: boolean;
  created_at: string;
  last_used_at: string;
  transports: string[];
}

export const finishPasskeyLogin = async (session_id: string, credential: PublicKeyCredential): Promise<void> => {
  return apiCall(
    async () => {
      const serialized = serializeLoginCredential(credential);

      const {data} = await authV1PasskeyServicePasskeyLoginFinish({
        body: {session_id, credential: serialized},
        throwOnError: true,
      });

      if (!persistTokens(data)) {
        throw new Error("Passkey authentication failed: incomplete token response");
      }
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid passkey credential"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Passkey authentication failed"),
    }
  );
};

export const beginPasskeyLogin = async (): Promise<PasskeyBeginLogin> => {
  return apiCall(async () => {
    const {data} = await authV1PasskeyServicePasskeyLoginBegin({
      body: {},
      throwOnError: true,
    });

    const sessionId = data.session_id;
    if (!sessionId || !data.options) {
      throw new PasskeyUnavailableError();
    }

    const options = decodeRequestOptions(data.options);
    return {session_id: sessionId, options};
  }, {});
};

export const beginPasskeyRegistration = async (): Promise<PasskeyBeginRegistration> => {
  return apiCall(
    async () => {
      const {data} = await authV1PasskeyServicePasskeyRegisterBegin({
        body: {},
        throwOnError: true,
      });

      const sessionId = data.session_id;
      if (!sessionId || !data.options) {
        throw new Error("Invalid response from server");
      }

      const options = decodeCreationOptions(data.options);
      return {session_id: sessionId, options};
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const finishPasskeyRegistration = async (
  session_id: string,
  name: string,
  credential: PublicKeyCredential
): Promise<PasskeyRegistrationResult> => {
  return apiCall(
    async () => {
      const serialized = serializeRegistrationCredential(credential);

      const {data} = await authV1PasskeyServicePasskeyRegisterFinish({
        body: {session_id, name, credential: serialized},
        throwOnError: true,
      });

      return {
        passkey_id: data.passkey_id ?? "",
        name: data.name ?? "",
      };
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid passkey credential"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const renamePasskey = async (id: string, name: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1PasskeyServiceRenamePasskey({
        path: {id},
        body: {name},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Passkey not found"),
    }
  );
};

export const deletePasskey = async (id: string): Promise<void> => {
  return apiCall(
    async () => {
      await authV1PasskeyServiceDeletePasskey({
        path: {id},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Passkey not found"),
    }
  );
};

export const listPasskeys = async (): Promise<Passkey[]> => {
  return apiCall(
    async () => {
      const {data} = await authV1PasskeyServiceListPasskeys({
        throwOnError: true,
      });

      return (data.passkeys ?? []).map((p) => ({
        id: p.id ?? "",
        name: p.name ?? "",
        credential_id: p.credential_id ?? "",
        aaguid: p.aaguid ?? "",
        backup_state: p.backup_state ?? false,
        created_at: p.created_at ?? "",
        last_used_at: p.last_used_at ?? "",
        transports: p.transports ?? [],
      }));
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Token is missing or invalid; user is not authenticated."),
    }
  );
};

export const verifyPasskeyForLogin = async (session_id: string, credential: PublicKeyCredential): Promise<void> => {
  return apiCall(
    async () => {
      const serialized = serializeLoginCredential(credential);

      const {data} = await authV1PasskeyServiceVerifyPasskeyForLogin({
        body: {session_id, credential: serialized},
        throwOnError: true,
      });

      if (!persistTokens(data)) {
        throw new Error("Passkey verification failed: incomplete token response");
      }
    },
    {
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Invalid passkey credential"),
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("Passkey verification failed"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Session not found"),
    }
  );
};
