// Export provider types
export {AuthProvider} from "./types";

// Export provider configurations and URL atoms
export {googleConfig, googleAuthUrl, updateGoogleAuthUrl, type GoogleProviderConfig} from "./google";

export {microsoftConfig, microsoftAuthUrl, updateMicrosoftAuthUrl, type MicrosoftProviderConfig} from "./microsoft";

export {appleConfig, appleAuthUrl, updateAppleAuthUrl, type AppleProviderConfig} from "./apple";

export {telegramConfig, telegramAuthUrl, updateTelegramAuthUrl, telegramCodeExchange, type TelegramProviderConfig} from "./telegram";

// Export utility functions
export {detectProvider, getProviderToken} from "./utils";
export {completeOAuthCallback, hasProviderResponse} from "./callback";
export {logProviderExchangeFailure, logUnusableProviderResponse} from "./diagnostics";
