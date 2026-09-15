import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth';

declare global {
    interface Window {
        google?: any;
    }
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function Login() {
    const { signInWithGoogle, signInWithToken } = useAuth();
    const btnRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [manualToken, setManualToken] = useState('');

    useEffect(() => {
        if (!CLIENT_ID || !window.google || !btnRef.current) return;
        window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: async (resp: { credential: string }) => {
                try {
                    await signInWithGoogle(resp.credential);
                } catch (e: any) {
                    setError(e?.message ?? 'Sign-in failed');
                }
            },
        });
        window.google.accounts.id.renderButton(btnRef.current, { theme: 'filled_black', size: 'large' });
    }, [signInWithGoogle]);

    const handleManual = async () => {
        setError(null);
        try {
            await signInWithToken(manualToken.trim());
        } catch (e: any) {
            setError(e?.message ?? 'Invalid token');
        }
    };

    return (
        <div className="login-wrap">
            <div className="card login-card">
                <h2>3D Print Admin</h2>
                <p className="muted">Sign in with an admin Google account.</p>
                {CLIENT_ID ? (
                    <div ref={btnRef} style={{ display: 'flex', justifyContent: 'center' }} />
                ) : (
                    <p className="muted">Set VITE_GOOGLE_CLIENT_ID to enable Google sign-in.</p>
                )}

                <details>
                    <summary className="muted">Sign in with an access token</summary>
                    <div className="field" style={{ marginTop: 12 }}>
                        <input
                            placeholder="Paste JWT access token"
                            value={manualToken}
                            onChange={(e) => setManualToken(e.target.value)}
                        />
                        <button className="secondary" onClick={handleManual} disabled={!manualToken.trim()}>
                            Use token
                        </button>
                    </div>
                </details>

                {error && <p className="error">{error}</p>}
            </div>
        </div>
    );
}
