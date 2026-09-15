import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';

interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: 'customer' | 'admin';
}

interface AuthValue {
    user: AdminUser | null;
    isLoading: boolean;
    signInWithGoogle: (idToken: string) => Promise<void>;
    signInWithToken: (token: string) => Promise<void>;
    signOut: () => void;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const hydrate = async () => {
        const me = await api.get<AdminUser>('/v1/users/me');
        if (me.role !== 'admin') {
            tokenStore.clear();
            throw new Error('This account does not have admin access.');
        }
        setUser(me);
    };

    useEffect(() => {
        (async () => {
            try {
                if (tokenStore.get()) await hydrate();
            } catch {
                tokenStore.clear();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const signInWithGoogle = async (idToken: string) => {
        const res = await api.post<{ access_token: string }>('/v1/auth/google', { access_token: idToken }, true);
        tokenStore.set(res.access_token);
        await hydrate();
    };

    const signInWithToken = async (token: string) => {
        tokenStore.set(token);
        await hydrate();
    };

    const signOut = () => {
        tokenStore.clear();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signInWithGoogle, signInWithToken, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
