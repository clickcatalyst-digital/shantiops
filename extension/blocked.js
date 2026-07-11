// Block page. Shows the blocked domain; for approval-required domains, lets the employee file a
// request and waits for the manager's approval, then returns them to the site.
const AGENT = 'http://127.0.0.1:47113';
const domain = new URLSearchParams(location.search).get('d') || '';

document.getElementById('domain').textContent = domain;
const btn = document.getElementById('request');
const statusEl = document.getElementById('status');
const lead = document.getElementById('lead');

async function decide() {
  const res = await fetch(`${AGENT}/check?domain=${encodeURIComponent(domain)}`, { cache: 'no-store' });
  return res.json();
}

// Ask the background worker to drop the (now-approved) block rule before we navigate back, so the
// browser doesn't just redirect us straight to this page again while the periodic sync catches up.
async function goToSite() {
  try { await chrome.runtime.sendMessage({ type: 'syncNow' }); } catch { /* navigate anyway */ }
  location.href = `https://${domain}`;
}

async function init() {
  let d;
  try {
    d = await decide();
  } catch {
    statusEl.textContent = 'Agent unavailable — contact your admin.';
    return;
  }
  if (d.approved) return goToSite();          // already granted (e.g. approved in another tab)
  if (d.action === 'approval') {
    lead.textContent = 'This website needs manager approval before you can open it.';
    btn.hidden = false;
    btn.addEventListener('click', requestAccess);
  }
  // action === 'block' → no request path; the message + no button is the whole page.
}

async function requestAccess() {
  btn.disabled = true;
  statusEl.textContent = 'Requesting approval…';
  try {
    await fetch(`${AGENT}/request`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
  } catch {
    statusEl.textContent = 'Could not reach the agent.';
    btn.disabled = false;
    return;
  }
  statusEl.textContent = 'Waiting for your manager to approve…';
  poll();
}

function poll() {
  const t = setInterval(async () => {
    let d;
    try { d = await decide(); } catch { return; }
    if (d.approved) { clearInterval(t); goToSite(); }
  }, 3000);
}

init();
