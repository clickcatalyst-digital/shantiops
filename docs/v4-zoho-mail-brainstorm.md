# v4 — Zoho Mail approval: brainstorm & discovery doc

No code in this milestone. This frames the decision for the next one: what questions to put to
the client's Zoho implementer, and which architecture we build once we have answers.

## Goal

External emails **with attachments** sent from company Zoho Mail accounts should be held for
manager approval before they leave the org — same approval engine (TOTP, time-boxed grant,
audit trail) as devices and browser domains.

## Questions for the client's Zoho implementer

Ask these before designing anything — the answers determine which architecture (below) is even
possible:

1. **Deployment**: Zoho Mail (cloud), Zoho Workplace, or on-prem/hybrid? Which Zoho org/domain?
2. **Admin API access**: Does the client have (or can they get) a Zoho Mail Admin API / Mail
   Admin Console with API access enabled? Is there an existing service account or OAuth app we
   can extend, or do we need a new one?
3. **Outgoing content policies**: Does Zoho Mail's admin panel expose an "Email Policy" or
   content-filtering feature that can **hold/quarantine outgoing mail** matching a rule (e.g.
   "has attachment" + "recipient outside domain") rather than just block/tag it? What's the
   quarantine/release mechanism — manual only in Zoho's own UI, or is there a webhook/API to
   release or reject a held message programmatically?
4. **Webhooks**: Does Zoho Mail support outbound webhooks on mail events (sent, quarantined,
   attachment-detected)? What's the payload — do we get sender, recipients, subject, attachment
   metadata (not necessarily content)?
5. **Latency tolerance**: Is a short hold acceptable (seconds to a couple minutes) before a
   compliant email actually leaves, given a manager needs to approve it? What do users expect to
   see (a "pending" state in their Sent folder? A bounce-and-resend?).
6. **Desktop/mobile clients**: Do employees send only via Zoho's own webmail, or also via IMAP/
   SMTP from Outlook/Apple Mail/phones? (This changes what "the agent can see" — a webmail-only
   flow can lean entirely on Zoho's server-side hooks; SMTP clients need a relay-level control.)
7. **Volume & scope**: Roughly how many external-with-attachment emails per day/week? Does
   "external" mean any non-company-domain recipient, or is there an allowlist of trusted partner
   domains that should skip approval (mirrors the browser policy engine's allow/block/approval
   model)?
8. **Existing DLP**: Is Zoho's own DLP/Attachment-restriction feature already partially
   configured? We don't want to fight an existing policy.

## Candidate architectures

### A — Zoho-side outgoing policy + webhook into our approval engine (preferred if available)
Zoho holds the message (its own quarantine feature per Q3) → fires a webhook to a new
`app/api/zoho/webhook` route → we create an `approval_policies`-style request (new `kind='mail'`,
target = recipient domain or a mail-request id) → manager approves with TOTP exactly like today
→ our backend calls Zoho's release/reject API to let the message send or bounce it.
**Best case**: near-zero client footprint, no desktop agent involvement, reuses the entire
existing engine. **Blocked on**: Q3/Q4 answers — needs Zoho to actually support programmatic
quarantine+release, not just block.

### B — Agent-side mail-client blocking (weak, fallback only)
The Windows agent detects/kills a desktop mail client process or blocks SMTP ports outbound,
same shape as the future app-control layer. **Problem**: webmail (browser) bypasses this
entirely, and even for desktop clients it's block-or-allow with no per-message granularity —
can't approve one email and not another. Only useful as a blunt "no email client at all"
policy, not real mail approval. Don't build this as the primary path.

### C — Mail-flow / relay interception (heavy)
Stand up an SMTP relay or MX-level intercept the client's Zoho routes through, hold matching
messages there, release on approval. **Problem**: real infrastructure to run and secure
(a mail relay is a juicy target), DNS/MX changes at the client's domain, and duplicates
whatever Zoho's own outgoing-policy feature likely already does server-side. Only worth it if
Q3 comes back "no, Zoho has no programmatic hold/release" — i.e. the fallback if A is impossible.

## Recommendation

Start the client conversation with Q2–Q4. If Zoho's admin API supports outgoing-mail
quarantine + release (Architecture A), that's a small, clean addition: one new `kind`, one
webhook route, one release-API call — genuinely "just configuration" the way the roadmap
promised for browser-adjacent domains. If Zoho can't do that, come back before building
Architecture C — a mail relay is a much bigger commitment and deserves its own scoped plan,
not a "fold it into this milestone" decision.
