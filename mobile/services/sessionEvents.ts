type Listener = () => void;

/** Tiny event bus so the API layer can tell the UI that the session expired. */
class SessionEvents {
    private listeners = new Set<Listener>();

    on(fn: Listener): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    emit(): void {
        this.listeners.forEach((fn) => fn());
    }
}

export const sessionEvents = new SessionEvents();
