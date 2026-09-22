export function formatPHP(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return `₱${v.toFixed(2)}`;
}
