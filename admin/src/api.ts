const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = '3dprint_admin_token';

export const tokenStore = {
    get: () => localStorage.getItem(TOKEN_KEY),
    set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
    clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

async function request<T>(path: string, options: RequestInit = {}, skipAuth = false): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
    };
    if (!skipAuth) {
        const token = tokenStore.get();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    if (res.status === 401) {
        tokenStore.clear();
        throw new ApiError(401, 'Session expired. Please sign in again.');
    }
    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (Array.isArray(body?.detail)) {
                detail = body.detail.map((e: any) => `${(e.loc ?? []).slice(1).join('.')}: ${e.msg}`).join('; ');
            } else {
                detail = body?.detail ?? detail;
            }
        } catch {
            /* ignore */
        }
        throw new ApiError(res.status, detail);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
}

export const api = {
    get: <T>(path: string) => request<T>(path, { method: 'GET' }),
    post: <T>(path: string, body?: unknown, skipAuth = false) =>
        request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }, skipAuth),
    patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
