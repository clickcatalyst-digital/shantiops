# Device & browser approval agent (USB / CD-DVD / phones + browser policy)

```
pip install -r requirements.txt        # + pywin32, wmi on Windows
python3 agent.py --selftest            # state-machine + version-compare checks, no server/Windows
python3 agent.py --winselftest         # real registry round-trip (Windows only, needs admin)
python3 agent.py --simulate            # exercises the real backend API, macOS-friendly
python3 agent.py                       # real Windows enforcement (run as SYSTEM)
python3 browser.py                     # browser domain-logic self-check
```

The agent has two subsystems: the **device state machine** (USB/CD/phone, registry enforcement)
and the **browser guard** (`browser.py`), a localhost HTTP server on `127.0.0.1:47113` that the
Chrome/Edge extension consults for the domain policy + approval grants. They share the poll loop
but are otherwise independent.

## Setup / enrollment

Prefer the installer + zero-typing enrollment (see the repo's [docs/SETUP.md](../docs/SETUP.md)):
the dashboard's **Register machine → Download enroll file** produces a `shanti-enroll.json`
(server URL + a single-use, 24h code). The installer, or the agent on first run, redeems it for
the long-lived machine token and stores it in `config.json`. Manual fallback: put a `token`
directly in `config.json`, or an `enroll_code` + `server_url`.

Simulator: create/edit `agent/sim_events.txt`, one line per currently-present device:
- USB: `vendor_id product_id [serial] [label...]` — e.g. `0781 5567 SN123 SanDisk Cruzer`
- CD/DVD: `cd volume_serial [label...]` — e.g. `cd 1A2B3C4D Ubuntu Install Disc`
- Phone: `phone vendor_id product_id [serial] [label...]` — e.g. `phone 05ac 12a8 SN9 iPhone`

Empty file (or missing) = nothing present.

## Phones (MTP/WPD) & CD/DVD enforcement

Phones connect as MTP/WPD, which `USBSTOR` doesn't touch. Both phones and CD/DVD are blocked via
the Removable Storage Access policy keys (Deny_Read/Deny_Write DWORDs) — phones use **two** WPD
class GUIDs (`{6AC27878-…}` and `{F33FDC04-…}`, covering MTP vs PTP presentation), CD/DVD uses
`{53f56308-…}`. `block()` denies every channel; `unblock(kind)` opens only the approved one, so
approving a phone never opens USB storage. Same real-hardware reboot caveat as CD applies (docs
say the deny may need a device restart; the agent nudges with `pnputil /restart-device`).

## CD/DVD enforcement

Uses the Removable Storage Access policy keys
(`HKLM\SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f56308-...}`
`Deny_Read`/`Deny_Write`), not the `cdrom` service — disabling that service kills drive
detection entirely, so a blocked disc could never be discovered and requested. `NoCDBurning`
is set once as a belt-and-braces Explorer-level block on burning.

**Caveat, not yet confirmed on real hardware:** Microsoft's own docs note the deny may not
take effect until the drive or the OS restarts. The agent nudges the drive with
`pnputil /restart-device` after every block/unblock as a best-effort mitigation, but whether
that's sufficient without a reboot can only be verified on a physical Windows machine with an
optical drive — CI runners don't have one. Flag this when testing on real hardware for the
first time.

## Reboot survival & installer (Windows)

**Installer (recommended):** CI builds `ShantiAgentSetup.exe` on every push to `agent/**` and
attaches it to a GitHub **Release** on a `v*` tag. The Inno Setup wizard (`installer.iss`):
- if a `shanti-enroll.json` sits next to the installer → copies it in and self-enrolls, no prompts;
- otherwise prompts for the **enrollment code** (server URL pre-filled);
- writes `C:\ProgramData\ShantiAgent\config.json`, registers the scheduled task, and writes the
  Chrome + Edge extension force-install keys (once `ExtensionId` is set in `installer.iss`).

It is **update-safe**: re-running over an already-enrolled machine preserves the existing token.
Silent install: `ShantiAgentSetup.exe /VERYSILENT /EnrollCode=<code>` (or `/ServerUrl=…` too).

**Manual (if running from source):**
```
schtasks /create /tn ShantiUsbAgent /tr "pythonw C:\shanti\agent\agent.py" /sc onstart /ru SYSTEM /rl HIGHEST
```

Running as SYSTEM gives the agent the registry-write rights it needs and stops a regular
user from killing the task.

## Building the installer locally / in CI

```
pyinstaller --onefile --name shanti-agent --hidden-import win32timezone agent.py
choco install innosetup -y
& "$env:ProgramFiles(x86)\Inno Setup 6\ISCC.exe" installer.iss
```

Produces `dist\shanti-agent.exe` and `Output\ShantiAgentSetup.exe`. The GitHub Actions
workflow does this on a `windows-latest` runner and additionally runs `--selftest` and
`--winselftest` against both the source and the built exe (catches PyInstaller bundling
gaps like missing hidden imports), then does a silent-install smoke test.

## Agent version & auto-update

Every server call sends `X-Agent-Version`. The dashboard's Machines card shows it, plus online
status (heartbeat < 30s) and last-seen. The server GET response carries `latest_version`
(`AGENT_LATEST_VERSION` env) and `update_url` (`AGENT_UPDATE_URL` env). When the agent sees a
version newer than its own `__version__` **and** an `update_url`, it downloads the installer,
runs it silently, and hard-exits so the running exe can be replaced; the installer's
`schtasks /run` restarts the new version. A failed download just logs and keeps running (no
retry loop; retried only on a different newer version). During the ~10s swap the registry/DNR
blocks persist, so enforcement stays on.

**To ship an update:** bump `__version__` in `agent.py` (+ `MyAppVersion` in `installer.iss`),
`git tag vX.Y.Z && git push --tags` (CI attaches the installer to the Release), then set
`AGENT_LATEST_VERSION` on the server to match. Machines self-update on their next poll.

Unsigned build: the first manual install shows a one-time SmartScreen "More info → Run anyway".
Auto-update runs from the SYSTEM task so it mostly sidesteps SmartScreen; some AV may flag an
unsigned download — add code signing when a certificate is available.

## Known boundary

A local administrator on the Windows machine can re-enable USBSTOR/the CD policy directly or
stop the scheduled task — this design assumes employees aren't local admins on their
machines, same assumption every non-kernel-driver device control product makes. Defeating a
local admin requires a kernel filter driver, out of scope for now.
