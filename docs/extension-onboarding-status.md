# Onboarding a Windows machine — step by step

Now that the People tab has both downloads in one place, this is short.

## You, on your Mac (dashboard)

1. Approvals → People → find the person → **Register machine**.
2. Two buttons appear right there: **Enroll file** and **Installer**. Send both to the
   person (Drive, email, whatever) — no need to hunt on GitHub anymore.

That's it on your end. Nothing here needs Windows.

## Them, on the Windows PC

1. Download both files you sent — the installer and `shanti-enroll.json`.
2. Put them in the same folder. Nothing else needed in it.
3. Run the installer. Windows will show a "protected your PC" prompt once (expected,
   it's unsigned) — click More info → Run anyway.
4. Done. It self-enrolls with no typing.

## How you confirm it worked (back on your Mac)

- Check the dashboard — the machine shows online under Approvals → Devices within a
  few seconds.
- Test enforcement — set a website to Block under Approvals → Browser, have them visit
  it, confirm it's blocked, then approve the request and confirm it unlocks.

If both of those pass, the extension is genuinely enforced, not just installed.
