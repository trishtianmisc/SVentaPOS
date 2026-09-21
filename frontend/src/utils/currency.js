export function formatPHP(n) {
    const v = typeof n === 'string' ? Number(n) : n;
    return `₱${v.toFixed(2)}`;
}
