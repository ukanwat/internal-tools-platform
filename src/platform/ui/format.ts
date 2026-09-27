export function formatTimestamp(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}
