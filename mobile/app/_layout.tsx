/**
 * Root layout. Provider order (outermost → innermost):
 *   GestureHandlerRootView → SafeAreaProvider → QueryClientProvider → AuthProvider → AuthGate
 *
 * AuthGate redirects between the (auth) and (tabs) route groups based on auth
 * state, and only mounts data-fetching screens once a user is confirmed (so the
 * API isn't hit on the login screen).
 *
 * Add back PostHogProvider / OTA update watcher / splash perf marks as needed —
 * see conventions/frontend.md.
 */
import { AuthProvider, useAuthContext } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { colors } from '@neo-design-library/mobile';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AuthGate() {
    const { user, isLoading } = useAuthContext();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;
        const inAuth = segments[0] === '(auth)';
        if (user && inAuth) {
            router.replace('/(tabs)');
        } else if (!user && !inAuth) {
            router.replace('/(auth)/login');
        }
    }, [user, isLoading, segments]);

    if (isLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgBase }}>
                <ActivityIndicator color={colors.violet400} size="large" />
            </View>
        );
    }

    return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <AuthGate />
                    </AuthProvider>
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
