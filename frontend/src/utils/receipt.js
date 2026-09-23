/** Thermal receipt date/time helpers (screen + print share monospace look). */
export function shortDate(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}
export function longDate(d) {
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}
export function shortTime(d) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
export function longTime(d) {
    return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}
export function parseSaleDate(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}
/** Local YYYY-MM-DD day key for grouping Transaction Records. */
export function saleDayKey(iso) {
    const d = parseSaleDate(iso) ?? new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
