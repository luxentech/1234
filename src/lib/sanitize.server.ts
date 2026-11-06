/**
 * Input sanitization utility to prevent Stored XSS, HTML/JavaScript injection,
 * and malicious payloads in data saved to the database.
 */

const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi,
  /javascript\s*:\s*[^\s"'>]+/gi,
  /data:\s*text\/html[^\s"'>]*/gi,
  /vbscript\s*:\s*[^\s"'>]+/gi,
];

export function sanitizeString(val: string): string {
  if (typeof val !== "string") return val;
  let clean = val;
  for (const pattern of DANGEROUS_PATTERNS) {
    clean = clean.replace(pattern, "");
  }
  return clean;
}

/**
 * Recursively sanitizes strings within an arbitrary object or array.
 */
export function sanitizePayload<T>(input: T): T {
  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item)) as unknown as T;
  }
  if (input !== null && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = sanitizePayload(v);
    }
    return out as unknown as T;
  }
  return input;
}
