# Enforcement backends. WindowsBackend does the real registry/WMI work; SimulatorBackend
# fakes insert/remove events from a text file so the whole approve/reject/revoke flow can
# be exercised on macOS without touching Windows.
import logging
import re
import subprocess
from pathlib import Path

log = logging.getLogger("usb-agent")

USBSTOR_KEY = r"SYSTEM\CurrentControlSet\Services\USBSTOR"
VID_PID_RE = re.compile(r"VID_([0-9A-Fa-f]{4})&PID_([0-9A-Fa-f]{4})(?:\\(.+))?")

# Removable Storage Access policy — {53f56308-...} is the CD/DVD device class GUID.
CD_POLICY_KEY = r"SOFTWARE\Policies\Microsoft\Windows\RemovableStorageDevices\{53f56308-b6bf-11d0-94f2-00a0c91efb8b}"
EXPLORER_POLICY_KEY = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"


class WindowsBackend:
    """Registry-level block. USB storage: USBSTOR Start=4/3. CD/DVD: Removable Storage Access
    policy Deny_Read/Deny_Write DWORDs (NOT the cdrom service — disabling that kills detection
    too, so a blocked disc could never be discovered and requested).
    Requires SYSTEM/admin — see agent/README.md for the scheduled-task install.
    Windows-only imports live inside methods so macOS dev only ever needs `requests`."""

    def __init__(self):
        import winreg  # noqa: F401  (import here, not at module load, so macOS can import this file)
        self._winreg = winreg

    def _set_start(self, value):
        winreg = self._winreg
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, USBSTOR_KEY, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, "Start", 0, winreg.REG_DWORD, value)

    def _set_cd_deny(self, deny):
        winreg = self._winreg
        key = winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, CD_POLICY_KEY, 0, winreg.KEY_SET_VALUE)
        with key:
            winreg.SetValueEx(key, "Deny_Read", 0, winreg.REG_DWORD, 1 if deny else 0)
            winreg.SetValueEx(key, "Deny_Write", 0, winreg.REG_DWORD, 1 if deny else 0)
        if deny:
            # Belt-and-braces: Explorer's burn UI, left on permanently once first blocked.
            expl = winreg.CreateKeyEx(winreg.HKEY_LOCAL_MACHINE, EXPLORER_POLICY_KEY, 0, winreg.KEY_SET_VALUE)
            with expl:
                winreg.SetValueEx(expl, "NoCDBurning", 0, winreg.REG_DWORD, 1)
        # ponytail: MS docs note this deny may not take effect until the drive/device restarts —
        # best-effort nudge below; whether that's sufficient without a reboot can only be
        # confirmed on real hardware (CI runners have no optical drive).
        for pnp_id in self._cd_pnp_ids():
            subprocess.run(["pnputil", "/restart-device", pnp_id], capture_output=True)

    def _cd_pnp_ids(self):
        import wmi
        return [d.PNPDeviceID for d in wmi.WMI().Win32_CDROMDrive() if d.PNPDeviceID]

    def is_blocked(self, kind="usb"):
        # Never trust cached state — read the registry back every time.
        winreg = self._winreg
        if kind == "cd":
            try:
                with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, CD_POLICY_KEY, 0, winreg.KEY_READ) as key:
                    value, _ = winreg.QueryValueEx(key, "Deny_Read")
                return value == 1
            except FileNotFoundError:
                return False  # key never created yet = never blocked
        with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, USBSTOR_KEY, 0, winreg.KEY_READ) as key:
            value, _ = winreg.QueryValueEx(key, "Start")
        return value == 4

    def block(self):
        # Fail-safe blocks every channel regardless of which one is in play.
        self._set_start(4)
        self._set_cd_deny(True)
        log.info("USBSTOR + CD policy blocked")

    def unblock(self, kind="usb"):
        if kind == "cd":
            self._set_cd_deny(False)
            log.info("CD policy unblocked (Deny_Read/Write=0)")
            return
        self._set_start(3)
        # ponytail: re-scan so an already-inserted stick mounts without a physical replug
        subprocess.run(["pnputil", "/scan-devices"], capture_output=True)
        log.info("USBSTOR unblocked (Start=3)")

    def list_devices(self):
        """Enumerate USB PnP entries via WMI, plus any disc with media loaded. The parent USB
        node (and the CD drive itself) still enumerates even while blocked, so this works
        whether currently blocked or not."""
        import wmi
        c = wmi.WMI()
        devices = []
        for entry in c.Win32_PnPEntity(PNPClass="USB"):
            m = VID_PID_RE.search(entry.PNPDeviceID or "")
            if not m:
                continue
            vendor_id, product_id, serial = m.group(1).lower(), m.group(2).lower(), (m.group(3) or "")
            devices.append({"kind": "usb", "vendor_id": vendor_id, "product_id": product_id,
                             "serial": serial, "label": entry.Name or ""})
        for drive in c.Win32_CDROMDrive():
            if not drive.MediaLoaded:
                continue
            devices.append({"kind": "cd", "vendor_id": "0000", "product_id": "0000",
                             "serial": drive.VolumeSerialNumber or "", "label": drive.VolumeName or ""})
        return devices


class SimulatorBackend:
    """Fakes device presence from a text file so the full flow is testable on macOS.
    Each non-empty line in sim_events.txt = one currently-present device:
      `vendor_id product_id [serial] [label...]`        e.g. `0781 5567 SN123 SanDisk Cruzer`
      `cd volume_serial [label...]`                      e.g. `cd 1A2B3C4D Ubuntu Install Disc`"""

    def __init__(self, events_path=None):
        # Default resolves next to this file, not the caller's CWD, so it works whether the
        # agent is launched from the repo root or from inside agent/.
        self.events_path = events_path or (Path(__file__).parent / "sim_events.txt")
        self._blocked = {"usb": True, "cd": True}

    def block(self):
        self._blocked = {"usb": True, "cd": True}
        log.info("[simulate] BLOCKED")

    def unblock(self, kind="usb"):
        self._blocked[kind] = False
        log.info("[simulate] UNBLOCKED (%s)", kind)

    def is_blocked(self, kind="usb"):
        return self._blocked[kind]

    def list_devices(self):
        try:
            with open(self.events_path) as f:
                lines = [l.strip() for l in f if l.strip()]
        except FileNotFoundError:
            return []
        devices = []
        for line in lines:
            parts = line.split(maxsplit=3 if not line.startswith("cd ") else 2)
            if parts[0] == "cd":
                if len(parts) < 2:
                    continue
                serial = parts[1]
                label = parts[2] if len(parts) > 2 else ""
                devices.append({"kind": "cd", "vendor_id": "0000", "product_id": "0000", "serial": serial, "label": label})
                continue
            if len(parts) < 2:
                continue
            vendor_id, product_id = parts[0], parts[1]
            serial = parts[2] if len(parts) > 2 else ""
            label = parts[3] if len(parts) > 3 else ""
            devices.append({"kind": "usb", "vendor_id": vendor_id, "product_id": product_id, "serial": serial, "label": label})
        return devices
