/**
 * Login. Uses expo-auth-session Google provider to obtain an ID token, then
 * exchanges it at POST /v1/auth/google via AuthContext.signInWithGoogle.
 *
 * Configure the client ids via EXPO_PUBLIC_GOOGLE_* env vars (see .env.example).
 */
import { Button, Text, colors, spacing } from '@neo-design-library/mobile';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { useAuthContext } from '@/context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
    const { signInWithGoogle } = useAuthContext();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
        clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    });

    useEffect(() => {
        (async () => {
            if (response?.type === 'success') {
                const idToken = response.params?.id_token;
                if (idToken) {
                    setBusy(true);
                    try {
                        await signInWithGoogle(idToken);
                    } catch (e: any) {
                        setError(e?.message ?? 'Sign-in failed');
                    } finally {
                        setBusy(false);
                    }
                }
            } else if (response?.type === 'error') {
                setError('Google sign-in was cancelled or failed.');
            }
        })();
    }, [response]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.content}>
                <Text variant="h2" style={styles.title}>
                    3D Print Shop
                </Text>
                <Text variant="body" style={styles.subtitle}>
                    Sign in to order custom 3D prints.
                </Text>
                {busy ? (
                    <ActivityIndicator color={colors.violet400} size="large" />
                ) : (
                    <Button variant="primary" disabled={!request} onPress={() => promptAsync()}>
                        Continue with Google
                    </Button>
                )}
                {error && (
                    <Text variant="caption" style={styles.error}>
                        {error}
                    </Text>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bgBase },
    content: { flex: 1, justifyContent: 'center', padding: spacing[4], gap: spacing[4] },
    title: { textAlign: 'center' },
    subtitle: { textAlign: 'center', color: colors.textTertiary },
    error: { textAlign: 'center', color: '#F87171' },
});
