import { secureStorage } from './secureStorage';
import { sessionEvents } from './sessionEvents';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// ─── Error type ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

type RequestOptions = { skipAuth?: boolean };

// ─── Request ID (mirrors the X-Request-Id the API logs) ──────────────────────

function generateRequestId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestInit = {}, skipAuth = false): Promise<T> {
    const requestId = generateRequestId();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        ...(options.headers as Record<string, string>),
    };

    if (!skipAuth) {
        const token = await secureStorage.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

    // 401 → token expired/invalid: clear it and broadcast so the UI can react.
    if (res.status === 401) {
        await secureStorage.clearToken();
        sessionEvents.emit();
        throw new ApiError(401, 'Session expired. Please sign in again.');
    }

    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            if (Array.isArray(body?.detail)) {
                // FastAPI validation errors — each item has loc, msg, type
                detail = body.detail
                    .map((e: any) => `${(e.loc ?? []).slice(1).join('.')}: ${e.msg}`)
                    .join('; ');
            } else {
                detail = body?.detail ?? detail;
            }
        } catch {}
        throw new ApiError(res.status, detail);
    }

    if (res.status === 204) return undefined as T;
    return res.json();
}

// ─── Verb helpers ─────────────────────────────────────────────────────────────

export const api = {
    get: <T>(path: string, options?: RequestOptions): Promise<T> =>
        request<T>(path, { method: 'GET' }, options?.skipAuth),
    post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
        request<T>(
            path,
            { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined },
            options?.skipAuth,
        ),
    patch: <T>(path: string, body?: unknown): Promise<T> =>
        request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
};

// ─── Month helpers (JS 0-based ↔ API 1-based) ────────────────────────────────

export const toApiMonth = (m: number) => m + 1;
export const fromApiMonth = (m: number) => m - 1;
