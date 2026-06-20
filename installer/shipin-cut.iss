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
; v0.9.13 (阶段 3B): 前端运行时由 dist/ 提供，不再打包 node_modules；保留
; package.json / src/ 仅作开发文档用途，安装版运行时不读取它们。
Source: "..\dist\*"; DestDir: "{app}\dist"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\launcher\*"; DestDir: "{app}\launcher"; Excludes: "__pycache__\*,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\tools\*.py"; DestDir: "{app}\tools"; Flags: ignoreversion
Source: "..\tools\jianying_draft\*.py"; DestDir: "{app}\tools\jianying_draft"; Flags: ignoreversion
Source: "..\tools\jianying_draft\*.json"; DestDir: "{app}\tools\jianying_draft"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\tools\jianying_draft\templates\MIXCUT_EMPTY_TEMPLATE_REAL\*"; DestDir: "{app}\tools\jianying_draft\templates\MIXCUT_EMPTY_TEMPLATE_REAL"; Excludes: ".backup\*,.locked"; Flags: ignoreversion recursesubdirs createallsubdirs
; v0.9.11: pyJianYingDraft 运行时（pyJianYingDraft + pymediainfo + uiautomation + comtypes）。
; 装包前从 tmp/pyjianying_probe/.venv/Lib/site-packages 拷出到 tools/pyjianying_runtime/，
; 后端通过 PYTHONPATH 把该目录挂到 sys.path，不再依赖 tmp/.venv 这条路。
Source: "..\tools\pyjianying_runtime\*"; DestDir: "{app}\tools\pyjianying_runtime"; Excludes: "__pycache__\*,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs
; v0.9.10: 字幕识别依赖（whisper.cpp 二进制 + 模型）。这两个目录已在 .gitignore 中
; （tools/* 与 local-tools/whisper.config.json 未提交），但本机本地存在时会被打进安装包，
; 缺失则安装后 /transcribe-video 会返回 "未找到 whisper-cli"。
Source: "..\tools\whisper\*.exe"; DestDir: "{app}\tools\whisper"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\tools\whisper\*.dll"; DestDir: "{app}\tools\whisper"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\tools\whisper\models\*.bin"; DestDir: "{app}\tools\whisper\models"; Flags: ignoreversion skipifsourcedoesntexist
; v0.9.10: ffmpeg/ffprobe（用户机器通常不带，依赖系统 PATH 易失败；从 D:\ffmpeg\bin 打进
; local-tools\ffmpeg\，让 _find_local_tool 在安装目录内直接命中）。该路径在本机构建机上才存在，
; skipifsourcedoesntexist 允许在缺少该第三方工具的开发机上跳过，仅靠系统 PATH 上的 ffmpeg 兜底。
Source: "D:\ffmpeg\bin\ffmpeg.exe"; DestDir: "{app}\local-tools\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "D:\ffmpeg\bin\ffprobe.exe"; DestDir: "{app}\local-tools\ffmpeg"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\local-tools\*.js"; DestDir: "{app}\local-tools"; Flags: ignoreversion
Source: "..\local-tools\package.json"; DestDir: "{app}\local-tools"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\local-tools\whisper.config.json"; DestDir: "{app}\local-tools"; Flags: ignoreversion skipifsourcedoesntexist

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
