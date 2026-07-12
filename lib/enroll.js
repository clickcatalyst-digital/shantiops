// Enrollment codes: short, single-use, short-lived. Redeemed by the agent for its long-lived
// machine token, so a non-technical installer never handles a 200-char JWT.
import { randomInt } from 'crypto';
import { queryOne, execute } from './db';

// Crockford-ish base32 minus look-alikes (0/O, 1/I) — safe to read aloud / retype.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LEN = 8;
export const ENROLL_TTL_MS = 24 * 60 * 60 * 1000;

export function generateEnrollCode() {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

// Issue (or reissue if expired) an enroll code for a machine; returns the code.
export async function issueEnrollCode(machineId) {
  const code = generateEnrollCode();
  await execute('UPDATE machines SET enroll_code = ?, enroll_expires = ? WHERE id = ?',
    [code, Date.now() + ENROLL_TTL_MS, machineId]);
  return code;
}

// Ensure a machine has a live code — reuse an unexpired one, else mint a fresh one.
export async function ensureEnrollCode(machineId) {
  const m = await queryOne('SELECT enroll_code, enroll_expires FROM machines WHERE id = ?', [machineId]);
  if (m?.enroll_code && m.enroll_expires > Date.now()) return m.enroll_code;
  return issueEnrollCode(machineId);
}

// In-memory fixed-window rate limiter, shared shape for any unauthenticated endpoint.
// ponytail: per-instance Map, not shared across Render replicas — fine for a single-instance
// deploy; move to a shared store if it ever scales horizontally.
function makeRateLimiter(max, windowMs) {
  const hits = new Map();
  return function rateLimited(key) {
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || rec.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }
    rec.count += 1;
    return rec.count > max;
  };
}

export const enrollRateLimited = makeRateLimiter(10, 60 * 1000);
export const registerRateLimited = makeRateLimiter(10, 60 * 1000);
