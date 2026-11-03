const DEVICE_ID_STORAGE_KEY = "eby-gold-device-id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DeviceIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceIdentityError";
  }
}

function generateDeviceId(): string {
  if (
    typeof globalThis.crypto === "undefined" ||
    typeof globalThis.crypto.getRandomValues !== "function"
  ) {
    throw new DeviceIdentityError(
      "Secure device identification is unavailable in this browser."
    );
  }

  if (typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  // Set UUID version 4 and RFC 4122 variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/**
 * Returns the persistent identifier for this browser installation.
 *
 * The identifier is stored in localStorage and reused on subsequent calls.
 * It is not an authentication credential or proof of device authorization.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    throw new DeviceIdentityError(
      "Device identification is only available in a browser."
    );
  }

  let storage: Storage;

  try {
    storage = window.localStorage;
  } catch {
    throw new DeviceIdentityError(
      "Browser storage is unavailable. Enable local storage to use this POS."
    );
  }

  try {
    const existingId = storage.getItem(DEVICE_ID_STORAGE_KEY);

    if (existingId && UUID_PATTERN.test(existingId)) {
      return existingId;
    }

    const newDeviceId = generateDeviceId();

    storage.setItem(DEVICE_ID_STORAGE_KEY, newDeviceId);

    return newDeviceId;
  } catch (error) {
    if (error instanceof DeviceIdentityError) {
      throw error;
    }

    throw new DeviceIdentityError(
      "Unable to save this POS device identity. Check your browser storage settings and try again."
    );
  }
}
