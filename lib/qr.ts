/**
 * Student pass payload. Rotates every 60 seconds. The signature is a fake
 * hash for prototype purposes — production swaps in a server-issued HMAC
 * over (studentId, timeWindow) without changing the payload shape.
 */
export const QR_WINDOW_MS = 60_000;

export interface PassPayload {
  v: 1;
  sid: string; // student id
  tw: number; // time window = floor(epochMs / QR_WINDOW_MS)
  sig: string;
}

export function currentWindow(now = Date.now()): number {
  return Math.floor(now / QR_WINDOW_MS);
}

export function msLeftInWindow(now = Date.now()): number {
  return QR_WINDOW_MS - (now % QR_WINDOW_MS);
}

function fakeSig(input: string): string {
  // djb2 — stand-in for the future HMAC.
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function encodePassPayload(studentId: string, tw = currentWindow()): string {
  const payload: PassPayload = {
    v: 1,
    sid: studentId,
    tw,
    sig: fakeSig(`${studentId}:${tw}`),
  };
  return JSON.stringify(payload);
}

export function decodePassPayload(raw: string): PassPayload | null {
  try {
    const p = JSON.parse(raw);
    if (p && p.v === 1 && typeof p.sid === "string" && typeof p.tw === "number") {
      return p as PassPayload;
    }
    return null;
  } catch {
    return null;
  }
}
