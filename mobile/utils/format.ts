// Set the locale/currency for your product.
const CURRENCY = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
    return CURRENCY.format(amount);
}

/** Render a print/queue duration in minutes as a human string (e.g. "2h 30m"). */
export function formatMinutes(minutes: number): string {
    if (!minutes || minutes <= 0) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

/**
 * Converts a Date to a YYYY-MM-DD string using the LOCAL timezone.
 * Never use toISOString().split('T')[0] — that converts to UTC first,
 * which shifts the date by one day for users in UTC- timezones.
 */
export function toLocalDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
