export function naira(kobo: number): string {
  const n = Math.floor(kobo / 100);
  const k = Math.abs(kobo % 100);
  const sign = kobo < 0 ? "-" : "";
  const kStr = k.toString().padStart(2, "0");
  return `${sign}\u20a6${n.toLocaleString("en-NG")}.${kStr}`;
}

/**
 * Parses a user-entered naira amount without floating-point arithmetic.
 * Accepts whole naira or up to two decimal places (e.g. "1250", "1250.5", "1250.50").
 * Returns null for malformed, negative, zero-free-form, or unsafe values.
 */
export function parseNairaToKobo(value: string): number | null {
  const input = value.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) {
    return null;
  }

  const [wholePart, fractionPart = ""] = input.split(".");
  const whole = Number(wholePart);
  const fraction = Number((fractionPart + "00").slice(0, 2));
  const kobo = whole * 100 + fraction;

  return Number.isSafeInteger(kobo) ? kobo : null;
}

export function toKobo(naira: string | number): number {
  const parsed = parseNairaToKobo(String(naira));
  if (parsed === null) {
    throw new RangeError("Invalid naira amount");
  }
  return parsed;
}

export function addKobo(a: number, b: number): number {
  const result = a + b;
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(result)) {
    throw new RangeError("Kobo addition exceeds the safe integer range");
  }
  return result;
}

export function subKobo(a: number, b: number): number {
  const result = a - b;
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(result)) {
    throw new RangeError("Kobo subtraction exceeds the safe integer range");
  }
  return result;
}

export function mulKobo(priceKobo: number, qty: number): number {
  const result = priceKobo * qty;
  if (!Number.isSafeInteger(priceKobo) || !Number.isSafeInteger(qty) || !Number.isSafeInteger(result)) {
    throw new RangeError("Kobo multiplication exceeds the safe integer range");
  }
  return result;
}
