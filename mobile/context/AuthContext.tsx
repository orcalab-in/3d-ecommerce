/**
 * Auth context.
 *
 *   • Restore the JWT from secure storage on startup, then hydrate the user
 *     from GET /v1/users/me (isLoading until done).
 *   • signInWithGoogle(idToken): POST /v1/auth/google -> { access_token } ->
 *     store token -> hydrate user.
 *   • Surface `sessionExpired` when the API layer emits a 401.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/services/api';
import { secureStorage } from '@/services/secureStorage';
import { sessionEvents } from '@/services/sessionEvents';

export interface AuthUser {
    id: string;
    name?: string;
    email?: string;
    pictureUrl?: string;
    phone?: string;
    role: 'customer' | 'admin';
}

interface MeResponse {
    id: string;
    name: string;
    email: string;
    picture_url?: string | null;
    phone?: string | null;
    role: 'customer' | 'admin';
}

interface AuthContextValue {
    user: AuthUser | null;
    isLoading: boolean;
    sessionExpired: boolean;
    signInWithGoogle: (googleIdToken: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshUser: () => Promise<void>;
    clearSessionExpired: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapUser(r: MeResponse): AuthUser {
    return {
        id: r.id,
        name: r.name,
        email: r.email,
        pictureUrl: r.picture_url ?? undefined,
        phone: r.phone ?? undefined,
        role: r.role,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);

    const hydrate = async () => {
        const me = await api.get<MeResponse>('/v1/users/me');
        setUser(mapUser(me));
    };

    // Restore session on startup.
    useEffect(() => {
        (async () => {
            try {
                const token = await secureStorage.getToken();
                if (token) await hydrate();
            } catch {
                await secureStorage.clearToken();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    // React to 401s broadcast by the API layer.
    useEffect(() => {
        return sessionEvents.on(() => {
            setUser(null);
            setSessionExpired(true);
        });
    }, []);

    const signInWithGoogle = async (googleIdToken: string) => {
        const res = await api.post<{ access_token: string }>(
            '/v1/auth/google',
            { access_token: googleIdToken },
            { skipAuth: true },
        );
        await secureStorage.setToken(res.access_token);
        await hydrate();
        setSessionExpired(false);
    };

    const signOut = async () => {
        await secureStorage.clearToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                sessionExpired,
                signInWithGoogle,
                signOut,
                refreshUser: hydrate,
                clearSessionExpired: () => setSessionExpired(false),
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuthContext(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
    return ctx;
}
