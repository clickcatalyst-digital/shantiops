// lib/browser.js — browser policy domain logic. Mirror of agent/browser.py normalize/match so
// the same rules apply server-side (canonical storage) and agent-side (incoming host).
// ponytail: duplicated in Python by necessity (two runtimes); each side has its own self-check.

// Lowercase registrable host: strip scheme/port/path + leading www. Throws on junk → 400.
export function normalizeDomain(input) {
  let v = String(input || '').trim().toLowerCase();
  if (!v) throw new Error('domain required');
  if (!v.includes('://')) v = 'http://' + v;   // URL needs a real scheme (protocol-relative throws)
  let host;
  try {
    host = new URL(v).hostname;                 // handles IDN/punycode
  } catch {
    throw new Error('invalid domain');
  }
  if (host.startsWith('www.')) host = host.slice(4);
  if (!host || host.includes('*') || !host.includes('.')) throw new Error('invalid domain');
  return host;
}

// Exact-or-dot-suffix; most-specific (longest target) wins. policies = [{target, action}].
export function matchPolicy(host, policies) {
  let best = null;
  for (const p of policies) {
    if (host === p.target || host.endsWith('.' + p.target)) {
      if (!best || p.target.length > best.target.length) best = p;
    }
  }
  return best ? best.action : null;
}

export const POLICY_ACTIONS = ['allow', 'block', 'approval'];
