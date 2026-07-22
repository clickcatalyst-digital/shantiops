# Onboarding a Windows machine — step by step

The employee now gets their own download buttons by logging in — you don't relay any
files yourself anymore.

## Them, first — before any of this

1. On the app's login page, they click **Request access**, fill in name/username/
   password, and pick Department Head (+ department) or Project Manager.
2. They can't log in yet — this just puts them in your queue.

## You, on the dashboard

1. Approvals → People → **Pending Registrations** → find them → **Approve**.
2. Same tab, scroll to **Onboarding Roster** → find them → **Register machine**.

That's it on your end for now — you're not sending them anything.

## Them, on the Windows PC

1. They log into the app themselves, from that PC's browser, with the account they
   just registered.
2. Since their machine isn't enrolled yet, they're blocked from the rest of the app
   and instead see a **Set up your machine** screen with two buttons: **Enroll file**
   and **Installer**.
3. They download both, put them in the same folder, and run the installer. Windows
   shows a "protected your PC" prompt once (expected, it's unsigned) — More info →
   Run anyway.
4. It self-enrolls with no typing. The gate unlocks itself within seconds — no need
   to reload — and they're into the real app.

## How you confirm it worked

- Check the dashboard — the machine shows online under Approvals → Devices within a
  few seconds.
- Test enforcement — set a website to Block under Approvals → Browser, have them visit
  it, confirm it's blocked, then approve the request and confirm it unlocks.

If both of those pass, the extension is genuinely enforced, not just installed.

## Scope note

This gate only applies to Department Heads (the `operator` role) — PMs, executives,
and admins are never blocked, since they're the ones who have to approve and register
machines in the first place.
