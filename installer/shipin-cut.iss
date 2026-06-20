#define MyAppName "视频混剪工具"
#define MyAppVersion "0.4.0"
#define MyAppPublisher "ShipinCut"
#define MyAppLauncher "启动视频混剪工具.bat"

[Setup]
AppId={{8E6A5A7D-7D58-48DD-A9C4-56A499369C1F}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\ShipinCut
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=ShipinCutSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
UsePreviousAppDir=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={sys}\cmd.exe

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加快捷方式："; Flags: checkedonce

[Files]
Source: "..\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\index.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\vite.config.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\启动视频混剪工具.bat"; DestDir: "{app}"; Flags: ignoreversion

Source: "..\src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\launcher\*"; DestDir: "{app}\launcher"; Excludes: "__pycache__\*,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\tools\*.py"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\tools\jianying_draft\*.py"; DestDir: "{app}\tools\jianying_draft"; Flags: ignoreversion
Source: "..\tools\jianying_draft\*.json"; DestDir: "{app}\tools\jianying_draft"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\tools\jianying_draft\templates\MIXCUT_EMPTY_TEMPLATE_REAL\*"; DestDir: "{app}\tools\jianying_draft\templates\MIXCUT_EMPTY_TEMPLATE_REAL"; Excludes: ".backup\*,.locked"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\local-tools\*.js"; DestDir: "{app}\local-tools"; Flags: ignoreversion
Source: "..\local-tools\package.json"; DestDir: "{app}\local-tools"; Flags: ignoreversion skipifsourcedoesntexist

Source: "..\docs\本地启动器说明-20260618.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\安装版实施清单-20260618.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\安装版与商业化方案-20260618.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\docs\安装包雏形说明-20260619.md"; DestDir: "{app}\docs"; Flags: ignoreversion
Source: "..\LOCAL_VIDEO_TOOLS.md"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\导出说明.txt"; DestDir: "{app}\docs"; Flags: ignoreversion skipifsourcedoesntexist

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppLauncher}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppLauncher}"; Description: "安装完成后启动视频混剪工具"; WorkingDir: "{app}"; Flags: shellexec postinstall skipifsilent nowait
