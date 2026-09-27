/** `12345, "USD"` → `$123.45`. */
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amountMinor / 100,
  );
}

const MAX_AMOUNT_MINOR = 100_000_000_00;

/** Parses a typed amount like `12.50` into minor units, or null if it isn't a positive amount. */
export function parseAmountMinor(input: string): number | null {
  const value = input.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const minor = Math.round(Number(value) * 100);
  return minor > 0 && minor <= MAX_AMOUNT_MINOR ? minor : null;
}
