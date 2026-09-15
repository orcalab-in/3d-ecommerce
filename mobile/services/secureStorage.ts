import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';

/** Persists the first-party JWT in the device keychain/keystore. */
export const secureStorage = {
    async getToken(): Promise<string | null> {
        return SecureStore.getItemAsync(TOKEN_KEY);
    },
    async setToken(token: string): Promise<void> {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
    },
    async clearToken(): Promise<void> {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
    },
};
