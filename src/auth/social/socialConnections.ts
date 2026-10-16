import {
  authV1ProvidersServiceListProviders,
  authV1ProvidersServiceConnectProvider,
  authV1ProvidersServiceDisconnectProvider,
} from "../../generated/sdk.gen";
import type {AuthV1ConnectProviderRequest, AuthV1ExternalAccountProvider} from "../../generated/types.gen";
import {getToken, login} from "../authStore";
import {AuthProvider} from "../providers/types";
import {credentialFields, type CodeExchangeFields, type ProviderCredential} from "../providers/credential";
import {setSocialConnectAttempt} from "./socialState";
import {apiCall} from "../api/utils";
import {persistTokens} from "../api/tokens";
import {HTTP_STATUS} from "../constants";
import {validateInput} from "../validation/base";
import {ConnectProviderSchema} from "../validation/auth";

export type ProviderType = "google" | "apple" | "microsoft" | "facebook" | "telegram";

export interface ConnectedProvider {
  provider: ProviderType;
  username?: string;
  first_name?: string;
  last_name?: string;
  email_address?: string;
  image_url?: string;
}

const PROVIDER_TO_PROTO: Record<ProviderType, AuthV1ExternalAccountProvider> = {
  google: "EXTERNAL_ACCOUNT_PROVIDER_GOOGLE",
  apple: "EXTERNAL_ACCOUNT_PROVIDER_APPLE",
  microsoft: "EXTERNAL_ACCOUNT_PROVIDER_MICROSOFT",
  facebook: "EXTERNAL_ACCOUNT_PROVIDER_FACEBOOK",
  telegram: "EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM",
};

const PROVIDER_FROM_PROTO: Partial<Record<AuthV1ExternalAccountProvider, ProviderType>> = {
  EXTERNAL_ACCOUNT_PROVIDER_GOOGLE: "google",
  EXTERNAL_ACCOUNT_PROVIDER_APPLE: "apple",
  EXTERNAL_ACCOUNT_PROVIDER_MICROSOFT: "microsoft",
  EXTERNAL_ACCOUNT_PROVIDER_FACEBOOK: "facebook",
  EXTERNAL_ACCOUNT_PROVIDER_TELEGRAM: "telegram",
};

// Both Telegram login flavors connect the same external account.
export const normalizeProviderType = (provider: string): ProviderType =>
  provider === AuthProvider.TELEGRAM_MINI_APP ? "telegram" : (provider as ProviderType);

export const toProtoProvider = (provider: ProviderType): AuthV1ExternalAccountProvider => {
  const proto = PROVIDER_TO_PROTO[provider];
  if (!proto) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  return proto;
};

export const listSocials = async (): Promise<ConnectedProvider[]> => {
  return apiCall(
    async () => {
      const {data} = await authV1ProvidersServiceListProviders({
        throwOnError: true,
      });
      return (data.providers ?? []).flatMap((p) => {
        const provider = p.provider ? PROVIDER_FROM_PROTO[p.provider] : undefined;
        if (!provider) return [];
        return [
          {
            provider,
            username: p.username,
            first_name: p.first_name,
            last_name: p.last_name,
            email_address: p.email_address,
            image_url: p.image_url,
          },
        ];
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to list providers!"),
    }
  );
};

export const connectSocialInternal = async (provider: string, credential: ProviderCredential): Promise<void> => {
  return apiCall(
    async () => {
      const {token, ...codeExchange} = credentialFields(credential);
      const requestBody = validateInput(ConnectProviderSchema, {provider, token});
      const sessionToken = await getToken();
      const headers: Record<string, string> = sessionToken ? {Authorization: `Bearer ${sessionToken}`} : {};
      // code_verifier and redirect_uri are not in the generated type until the SDK is regenerated.
      const body: AuthV1ConnectProviderRequest & CodeExchangeFields = {
        provider: toProtoProvider(normalizeProviderType(requestBody.provider)),
        token: requestBody.token,
        ...codeExchange,
      };
      const {data} = await authV1ProvidersServiceConnectProvider({
        body,
        headers,
        throwOnError: true,
      });
      persistTokens(data);
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to connect provider!"),
    }
  );
};

export const disconnectSocial = async (provider: ProviderType): Promise<void> => {
  return apiCall(
    async () => {
      await authV1ProvidersServiceDisconnectProvider({
        path: {provider: toProtoProvider(provider)},
        throwOnError: true,
      });
    },
    {
      [HTTP_STATUS.UNAUTHORIZED]: () => new Error("User is not authorized to disconnect provider!"),
      [HTTP_STATUS.NOT_FOUND]: () => new Error("Provider not found!"),
      [HTTP_STATUS.BAD_REQUEST]: () => new Error("Cannot disconnect the last social provider!"),
    }
  );
};

export const connectSocial = (provider: ProviderType): void => {
  setSocialConnectAttempt(provider);
  login(provider);
};
