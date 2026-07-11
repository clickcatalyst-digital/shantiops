// Polls the local Shanti agent for the current blocklist and mirrors it into declarativeNetRequest
// dynamic rules. Blocked/approval-without-grant domains redirect (main_frame) to blocked.html.
// ponytail: MV3 can't block synchronously on navigation, so DNR is the enforcement — rules persist
// across browser/agent restarts, so agent-down keeps the last policy enforced (fail-safe, not open).
const AGENT = 'http://127.0.0.1:47113';
const POLL_SECONDS = 5;

async function currentBlocklist() {
  const res = await fetch(`${AGENT}/blocklist`, { cache: 'no-store' });
  if (!res.ok) throw new Error('agent blocklist ' + res.status);
  const { blocked } = await res.json();
  return Array.isArray(blocked) ? blocked : [];
}

function ruleFor(domain, id) {
  return {
    id,
    priority: 1,
    // ||domain^ matches the domain and every subdomain natively — no public-suffix logic needed.
    condition: { urlFilter: `||${domain}^`, resourceTypes: ['main_frame'] },
    action: { type: 'redirect', redirect: { extensionPath: `/blocked.html?d=${encodeURIComponent(domain)}` } },
  };
}

async function syncRules() {
  let blocked;
  try {
    blocked = await currentBlocklist();
  } catch {
    return; // agent unreachable → leave existing rules in place (fail-safe)
  }
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const newRules = blocked.map((d, i) => ruleFor(d, i + 1));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existing.map(r => r.id),
    addRules: newRules,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('sync', { periodInMinutes: POLL_SECONDS / 60 });
  syncRules();
});
chrome.runtime.onStartup.addListener(syncRules);
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'sync') syncRules(); });

// The block page asks for an immediate re-sync the moment it sees an approval, so the just-granted
// domain's block rule is dropped before it navigates back — the periodic alarm floors at ~1min.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'syncNow') {
    syncRules().then(() => sendResponse({ ok: true }));
    return true; // keep the message channel open for the async response
  }
});
