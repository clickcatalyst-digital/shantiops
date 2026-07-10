// lib/usb.js — USB approval domain logic: derived status, TOTP verification, boundary
// validation, audit trail. Routes call these; nothing here touches HTTP.
import { authenticator } from 'otplib';
import { queryOne, execute } from './db';

export const APPROVAL_MINUTES_DEFAULT = 15;
const PENDING_MAX_MS = 60 * 60 * 1000;   // a pending request nobody acted on dies after 1h
const TOTP_MAX_FAILS = 5;
const TOTP_LOCK_MS = 15 * 60 * 1000;

// SQLite CURRENT_TIMESTAMP is UTC 'YYYY-MM-DD HH:MM:SS' — make it Date-parseable.
function sqliteUtcMs(s) {
  return Date.parse(String(s).replace(' ', 'T') + 'Z');
}

// Expiry is computed lazily at read time — no cron. Terminal: rejected | revoked | expired.
export function effectiveStatus(row) {
  if (!row) return null;
  if (row.status === 'approved' && row.expires_at && row.expires_at < Date.now()) return 'expired';
  if (row.status === 'pending' && Date.now() - sqliteUtcMs(row.requested_at) > PENDING_MAX_MS) return 'expired';
  return row.status;
}

export function isLive(row) {
  const s = effectiveStatus(row);
  return s === 'pending' || s === 'approved';
}

// Verify a manager's TOTP code with lockout + replay protection. Returns
// { ok: true } | { ok: false, status, error }. Persists fail/lock/last-code state.
export async function verifyTotp(userId, code) {
  const u = await queryOne(
    'SELECT id, totp_secret, totp_fails, totp_lock_until, totp_last_code FROM users WHERE id = ?',
    [userId]
  );
  if (!u?.totp_secret) return { ok: false, status: 400, error: 'Set up TOTP in Settings first' };
  if (u.totp_lock_until && u.totp_lock_until > Date.now()) {
    return { ok: false, status: 429, error: 'Too many failed codes — locked for 15 minutes' };
  }
  const codeStr = String(code || '').trim();
  authenticator.options = { window: 1 };
  const valid = /^\d{6}$/.test(codeStr)
    && codeStr !== u.totp_last_code            // replay: a code grants exactly one action
    && authenticator.check(codeStr, u.totp_secret);
  if (!valid) {
    const fails = (u.totp_fails || 0) + 1;
    const lock = fails >= TOTP_MAX_FAILS ? Date.now() + TOTP_LOCK_MS : null;
    await execute('UPDATE users SET totp_fails = ?, totp_lock_until = ? WHERE id = ?', [fails, lock, userId]);
    return { ok: false, status: 403, error: 'Invalid code' };
  }
  await execute('UPDATE users SET totp_fails = 0, totp_lock_until = NULL, totp_last_code = ? WHERE id = ?',
    [codeStr, userId]);
  return { ok: true };
}

// Trust-boundary validation for agent-reported device identity. Throws on bad input → 400.
// kind='cd': discs have no VID/PID, so the server — not the agent — assigns the fixed
// 0000:0000 identity; serial is the disc's volume serial number instead.
export function normalizeDevice(body) {
  const kind = body?.kind === 'cd' ? 'cd' : 'usb';
  const serial = String(body?.serial || '').slice(0, 128).replace(/[^\x20-\x7e]/g, '');
  const label = String(body?.label || '').slice(0, 128).replace(/[^\x20-\x7e]/g, '') || null;

  if (kind === 'cd') {
    return { kind, vendor_id: '0000', product_id: '0000', serial, label };
  }
  const vendor_id = String(body?.vendor_id || '').toLowerCase();
  const product_id = String(body?.product_id || '').toLowerCase();
  if (!/^[0-9a-f]{4}$/.test(vendor_id) || !/^[0-9a-f]{4}$/.test(product_id)) {
    throw new Error('vendor_id and product_id must be 4 hex chars');
  }
  return { kind, vendor_id, product_id, serial, label };
}

export async function audit(action, { request_id = null, machine_id = null, actor, detail = null }) {
  await execute(
    'INSERT INTO usb_audit (request_id, machine_id, actor, action, detail) VALUES (?, ?, ?, ?, ?)',
    [request_id, machine_id, actor, action, detail]
  );
}
