; Inno Setup script for the Shanti USB/CD approval agent.
; Built by CI (.github/workflows/agent-windows.yml) against dist\shanti-agent.exe (PyInstaller
; onefile build) — this script is not meant to be compiled by hand against a source checkout
; without running that build first.
#define MyAppName "Shanti Agent"
#define MyAppVersion "1.1.0"
#define MyAppExeName "shanti-agent.exe"

[Setup]
AppId={{7C2E9B1A-4F3D-4A6E-9C2B-1D8E6F0A5B3C}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher=Shanti Boilers
DefaultDirName={autopf}\ShantiAgent
DefaultGroupName=Shanti Agent
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=ShantiAgentSetup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "dist\shanti-agent.exe"; DestDir: "{app}"; Flags: ignoreversion

[Code]
var
  ConfigPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  ConfigPage := CreateInputQueryPage(wpSelectDir,
    'Agent Configuration', 'Connect this machine to your Shanti Ops server',
    'Enter the server URL and the agent token issued from the dashboard ' +
    '(Approvals -> Devices -> Machines -> Register machine).');
  ConfigPage.Add('Server URL:', False);
  ConfigPage.Add('Agent token:', False);
  // CLI overrides (/ServerUrl=... /Token=...) let CI silent-install without typing into the wizard.
  ConfigPage.Values[0] := ExpandConstant('{param:ServerUrl|http://localhost:3000}');
  ConfigPage.Values[1] := ExpandConstant('{param:Token|}');
end;

function GetServerUrl: string;
begin
  Result := ConfigPage.Values[0];
end;

function GetToken: string;
begin
  Result := ConfigPage.Values[1];
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = ConfigPage.ID then begin
    if (Pos('"', GetServerUrl) > 0) or (Pos('\', GetServerUrl) > 0) or
       (Pos('"', GetToken) > 0) or (Pos('\', GetToken) > 0) then begin
      MsgBox('Server URL and token must not contain " or \', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigDir, ConfigPath, JsonContent: string;
begin
  if CurStep = ssPostInstall then begin
    ConfigDir := ExpandConstant('{commonappdata}\ShantiAgent');
    ForceDirectories(ConfigDir);
    ConfigPath := ConfigDir + '\config.json';
    JsonContent :=
      '{' + #13#10 +
      '  "server_url": "' + GetServerUrl + '",' + #13#10 +
      '  "token": "' + GetToken + '",' + #13#10 +
      '  "poll_seconds": 5' + #13#10 +
      '}';
    SaveStringToFile(ConfigPath, JsonContent, False);
  end;
end;

[Run]
Filename: "{sys}\schtasks.exe"; Parameters: "/create /tn ShantiUsbAgent /tr ""{app}\{#MyAppExeName}"" /sc onstart /ru SYSTEM /rl HIGHEST /f"; Flags: runhidden
Filename: "{sys}\schtasks.exe"; Parameters: "/run /tn ShantiUsbAgent"; Flags: runhidden

[UninstallRun]
Filename: "{sys}\schtasks.exe"; Parameters: "/end /tn ShantiUsbAgent"; Flags: runhidden
Filename: "{sys}\schtasks.exe"; Parameters: "/delete /tn ShantiUsbAgent /f"; Flags: runhidden
