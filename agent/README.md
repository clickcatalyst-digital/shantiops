# Device approval agent (USB storage + CD/DVD)

```
pip install -r requirements.txt        # + pywin32, wmi on Windows
python3 agent.py --selftest            # state-machine check, no server/Windows needed
python3 agent.py --winselftest         # real registry round-trip (Windows only, needs admin)
python3 agent.py --simulate            # exercises the real backend API, macOS-friendly
python3 agent.py                       # real Windows enforcement (run as SYSTEM)
```

## Setup

1. In the dashboard: admin → Approvals → Devices → Machines → register a machine for the
   employee. Copy the token shown (shown once) into `config.json`'s `token` field, and set
   `server_url`. (Or use the installer below, which prompts for both.)
2. Simulator: create/edit `agent/sim_events.txt`, one line per currently-present device:
   - USB: `vendor_id product_id [serial] [label...]` — e.g. `0781 5567 SN123 SanDisk Cruzer`
   - CD/DVD: `cd volume_serial [label...]` — e.g. `cd 1A2B3C4D Ubuntu Install Disc`

   Empty file (or missing) = nothing present.

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

**Installer (recommended):** CI builds `ShantiAgentSetup.exe` on every push to `agent/**` (see
`.github/workflows/agent-windows.yml`) — download it from the workflow's artifacts. It's an
Inno Setup wizard (`installer.iss`) that prompts for the server URL and agent token, writes
`C:\ProgramData\ShantiAgent\config.json`, and registers the scheduled task below. Silent
install: `ShantiAgentSetup.exe /VERYSILENT /ServerUrl=http://your-server /Token=<token>`.

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

## Agent version

Every server call sends `X-Agent-Version`. The dashboard's Machines card shows it, plus
online status (heartbeat < 30s) and last-seen. If the server has `AGENT_LATEST_VERSION` set
and it differs from the agent's own `__version__`, the agent logs an "update available"
warning — no auto-update yet, just visibility.

## Known boundary

A local administrator on the Windows machine can re-enable USBSTOR/the CD policy directly or
stop the scheduled task — this design assumes employees aren't local admins on their
machines, same assumption every non-kernel-driver device control product makes. Defeating a
local admin requires a kernel filter driver, out of scope for now.
