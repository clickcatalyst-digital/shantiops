# Browser policy subsystem for the agent. Runs a localhost HTTP server the browser extension
# talks to, and caches the domain policy list + active approval grants from the cloud. Kept
# fully separate from the device BLOCKED/PENDING/APPROVED state machine in agent.py.
#
# ponytail: binds 127.0.0.1 only. Any local process could read the (non-secret) policy list or
# file a manager-gated request here — acceptable because nothing is granted without manager TOTP,
# and the machine JWT never crosses this port. Native messaging is the upgrade path if that ceiling
# ever matters.
import json
import logging
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import requests

log = logging.getLogger("usb-agent")

AGENT_PORT = 47113


def normalize_domain(value):
    """Lowercase registrable host: strip scheme/port/path + leading www. Mirror of
    lib/browser.js normalizeDomain. Returns '' on junk (caller rejects)."""
    if not value:
        return ""
    v = str(value).strip().lower()
    if "//" not in v:
        v = "//" + v            # let urlparse treat a bare host as netloc
    host = urlparse(v).hostname or ""
    if host.startswith("www."):
        host = host[4:]
    # reject obvious junk: needs a dot, no spaces/wildcards
    if " " in host or "*" in host or "." not in host:
        return ""
    return host


def match_policy(host, policies):
    """Exact-or-dot-suffix match. policies = [{'target','action'}]. Most-specific (longest
    target) wins so a sub-rule can override a parent. Returns action or None."""
    host = host or ""
    best = None
    for p in policies:
        t = p["target"]
        if host == t or host.endswith("." + t):
            if best is None or len(t) > len(best["target"]):
                best = p
    return best["action"] if best else None


class BrowserGuard:
    def __init__(self, server_url, token, agent_version):
        self.server_url = server_url.rstrip("/")
        self.token = token
        self.agent_version = agent_version
        self._lock = threading.Lock()
        self._policies = []            # [{'target','action'}]
        self._grants = {}              # domain -> expires_at_ms (approved, unexpired)
        self._httpd = None

    def _headers(self):
        return {"Authorization": f"Bearer {self.token}", "X-Agent-Version": self.agent_version}

    # ---- decision the extension asks for ----
    def decide(self, domain):
        host = normalize_domain(domain)
        if not host:
            return {"action": "allow", "approved": True}   # unparseable → don't block navigation
        with self._lock:
            action = match_policy(host, self._policies)
            if action == "block":
                return {"action": "block", "approved": False}
            if action == "approval":
                grant = self._grants.get(host)
                approved = grant is not None and grant > time.time() * 1000
                return {"action": "approval", "approved": approved}
            return {"action": "allow", "approved": True}    # allow or no policy

    def file_request(self, domain):
        host = normalize_domain(domain)
        if not host:
            return {"error": "bad domain"}
        try:
            r = requests.post(f"{self.server_url}/api/agent/browser", json={"domain": host},
                              headers=self._headers(), timeout=10)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            log.warning("browser request POST failed: %s", e)
            return {"error": "unreachable"}

    # ---- periodic sync, called from the agent's main loop ----
    def refresh(self):
        try:
            r = requests.get(f"{self.server_url}/api/agent/policies", headers=self._headers(), timeout=10)
            r.raise_for_status()
            policies = r.json().get("policies", [])
        except requests.RequestException:
            return  # keep last-known policy — fail-safe, don't fail open
        grants = {}
        try:
            r = requests.get(f"{self.server_url}/api/agent/browser", headers=self._headers(), timeout=10)
            r.raise_for_status()
            for req in r.json().get("requests", []):
                if req.get("status") == "approved" and req.get("expires_at"):
                    grants[req["domain"]] = req["expires_at"]
        except requests.RequestException:
            pass
        with self._lock:
            self._policies = policies
            self._grants = grants

    def snapshot(self):
        """What the extension needs to build its blocklist: block domains + approval domains
        without a live grant. Approval-with-grant and allow are omitted (not blocked)."""
        with self._lock:
            now = time.time() * 1000
            blocked = []
            for p in self._policies:
                if p["action"] == "block":
                    blocked.append(p["target"])
                elif p["action"] == "approval":
                    g = self._grants.get(p["target"])
                    if not (g and g > now):
                        blocked.append(p["target"])
            return blocked

    # ---- HTTP server (daemon thread) ----
    def start(self):
        guard = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass  # quiet; the agent logger handles anything worth recording

            def _json(self, code, payload):
                body = json.dumps(payload).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")  # extension origin varies
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path == "/check":
                    domain = (parse_qs(parsed.query).get("domain") or [""])[0]
                    return self._json(200, guard.decide(domain))
                if parsed.path == "/blocklist":
                    return self._json(200, {"blocked": guard.snapshot()})
                return self._json(404, {"error": "not found"})

            def do_POST(self):
                parsed = urlparse(self.path)
                if parsed.path == "/request":
                    length = min(int(self.headers.get("Content-Length") or 0), 4096)
                    try:
                        body = json.loads(self.rfile.read(length) or b"{}")
                    except ValueError:
                        return self._json(400, {"error": "bad json"})
                    return self._json(200, guard.file_request(body.get("domain", "")))
                return self._json(404, {"error": "not found"})

        self._httpd = ThreadingHTTPServer(("127.0.0.1", AGENT_PORT), Handler)
        t = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        t.start()
        log.info("browser guard listening on 127.0.0.1:%d", AGENT_PORT)


def _selftest():
    assert normalize_domain("https://www.Gmail.com/mail?x=1") == "gmail.com"
    assert normalize_domain("DROPBOX.com:443") == "dropbox.com"
    assert normalize_domain("not a domain") == ""
    assert normalize_domain("*") == ""
    pols = [{"target": "dropbox.com", "action": "block"}, {"target": "gmail.com", "action": "approval"}]
    assert match_policy("api.dropbox.com", pols) == "block"      # subdomain
    assert match_policy("gmail.com", pols) == "approval"
    assert match_policy("github.com", pols) is None
    # most-specific wins
    pols2 = [{"target": "google.com", "action": "allow"}, {"target": "drive.google.com", "action": "block"}]
    assert match_policy("drive.google.com", pols2) == "block"
    assert match_policy("mail.google.com", pols2) == "allow"
    print("browser selftest OK")


if __name__ == "__main__":
    _selftest()
