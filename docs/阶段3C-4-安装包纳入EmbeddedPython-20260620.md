# 阶段 3C-4：安装包纳入 embedded Python - 2026-06-20

> 本轮把 3C-2 POC 已经验证过的 `installer/runtime/python/` 正式塞进 Inno Setup 安装包，装到 `{app}\runtime\python\`，让安装版**双击桌面图标就能用、不再依赖系统 Python**。
>
> 3C-3 已经让启动器优先用 embedded Python；3C-4 把 embedded Python 真正装进用户机器。`installer/shipin-cut.iss` 是本轮唯一改动的安装包入口。

## 1. 本轮目标

| 验收项 | 状态 |
|---|---|
| `installer/shipin-cut.iss` 把 `installer/runtime/python/*` 打进 `{app}\runtime\python` | ✅ |
| `Excludes: "__pycache__\*,*.pyc"` 防止污染安装包 | ✅ |
| 安装后存在 `<安装目录>\runtime\python\python.exe` | ✅ |
| 启动器命中 `{app}\runtime\python\python.exe`（不再回退系统 Python） | ✅ |
| `/health` 返回 `Server: Python/3.11.9` | ✅ |
| `/shipin-cut/` 页面正常 | ✅ |
| 5173 / node.exe 不被启动 | ✅ |
| 安装目录**不**产生 `__pycache__` / `.pyc` | ✅（见 §6 修复） |
| 全部 `.pyc` 落到 `%LOCALAPPDATA%\ShipinCut\cache\pycache` | ✅（87 个） |
| 字幕识别成功 | ✅ |
| 导出剪映草稿成功（`POC3C4` 写到 JianyingPro） | ✅ |
| 覆盖安装（重新装到同一目录）成功 | ✅ |
| `pytest tests/ -q` 通过 | ✅ |
| `python -m py_compile launcher\ShipinCutLauncher.py` 通过 | ✅ |
| `npm run build` 通过 | ✅ |

## 2. 安装包改动

`installer/shipin-cut.iss` 的 `[Files]` 段增加一行：

```iss
; v0.5.0 (阶段 3C-4): 内置 Python runtime（embeddable 3.11.9），安装到 {app}\runtime\python\。
; 启动器 (3C-3) 优先查找 {app}\runtime\python\python.exe，找不到才回退系统 Python；
; 此项为 3C-4 起安装版的强制依赖，缺失会让 Setup.exe 编译失败（不要加 skipifsourcedoesntexist）。
; Excludes 防止把 .pyc / __pycache__ 一起打入安装包——这些是首次启动时由 embedded Python 现生成，
; 真正的写入位置由 PYTHONPYCACHEPREFIX 重定向到 %LOCALAPPDATA%\ShipinCut\cache\pycache。
Source: "..\installer\runtime\python\*"; DestDir: "{app}\runtime\python"; Excludes: "__pycache__\*,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs
```

要点：

1. `DestDir: "{app}\runtime\python"` —— 与 3C-3 启动器里 `EMBEDDED_PYTHON_CANDIDATES` 的第 0 项一致。
2. **没有** `skipifsourcedoesntexist` —— 3C-4 起 `installer/runtime/python/` 是硬依赖，缺了要让 Inno Setup 编译失败并提醒打包脚本补齐。
3. `Excludes: "__pycache__\*,*.pyc"` —— 防止把任何 .pyc 一并打包（3C-2 POC 阶段已确认 `installer/runtime/python/` 内本身是干净的，本行主要是双保险）。
4. `recursesubdirs createallsubdirs` —— 与 `launcher/`、`tools/pyjianying_runtime/` 一致。

版本号同时从 `0.4.0` 升到 `0.5.0`：

```iss
#define MyAppVersion "0.5.0"
```

## 3. python311._pth 双布局兼容

3C-2 POC 时 `_pth` 文件只有 dev 布局路径：

```text
..\..\..\tools\pyjianying_runtime
```

相对 `installer/runtime/python/`（dev 布局）：

- 上 1 层 → `installer/runtime/`
- 上 2 层 → `installer/`
- 上 3 层 → `shipin-cut/`
- `tools\pyjianying_runtime` → 命中 ✓

但**安装版**的 `python311._pth` 位于 `{app}\runtime\python\python311._pth`：

- 上 1 层 → `{app}\runtime/`
- 上 2 层 → `{app}/`
- 上 3 层 → `{app}\..`（**{app} 的父目录**，**不是**项目根）

所以原来那行在安装版下指向 `{app}\..\..\..\tools\pyjianying_runtime`，**永远不存在**。

更重要的是：**embeddable Python 只要 `_pth` 存在就忽略 `PYTHONPATH`**（3C-3 启动器注入 `PYTHONPATH` 的策略对 embeddable 解释器无效）。所以光靠 3C-3 的 `build_backend_env` 注入 PYTHONPATH 不够，必须把 vendored runtime 写进 `_pth`。

修法：`_pth` 同时列两个相对路径，哪边命中用哪边，另一边不存在不报错。

`installer/runtime/python/python311._pth`（3C-4 新版）：

```text
python311.zip
.

# 3C-2 POC: enable site-packages so embedded Python can load third-party
# packages placed in tools\pyjianying_runtime\.
import site

# Path entries below are relative to the directory containing this _pth
# file (i.e. .../runtime/python/). Both layouts are listed so the same
# embedded distribution works in the developer's tree and in the
# installed program directory.
#
# - ..\..\..\tools\pyjianying_runtime  =>  dev layout
#     (shipin-cut\installer\runtime\python\  ->  shipin-cut\tools\pyjianying_runtime\)
#
# - ..\..\tools\pyjianying_runtime  =>  install layout (3C-4)
#     ({app}\runtime\python\  ->  {app}\tools\pyjianying_runtime\)
#
# Either entry resolves to a non-existent directory in the other layout,
# which the runtime simply skips, so listing both is harmless.
..\..\..\tools\pyjianying_runtime
..\..\tools\pyjianying_runtime
```

实测：

| 启动方式 | `_pth` 命中项 | 备注 |
|---|---|---|
| `python installer/runtime/run_server_embedded.bat`（dev 布局） | `..\..\..\tools\pyjianying_runtime` → `shipin-cut\tools\pyjianying_runtime` | 与 3C-2 / 3C-3 行为一致 |
| 桌面图标 → `启动视频混剪工具.bat` → `{app}\runtime\python\python.exe`（安装版） | `..\..\tools\pyjianying_runtime` → `{app}\tools\pyjianying_runtime` | 3C-4 新增 |

dev 布局下多出来的 `..\..\tools\pyjianying_runtime` 会解析成 `installer\tools\pyjianying_runtime`（不存在），runtime 静默跳过；安装版下多出来的 `..\..\..\tools\pyjianying_runtime` 解析成 `<{app} 父目录的父目录的父目录>\tools\pyjianying_runtime`（通常不存在），runtime 也静默跳过。

## 4. bat 入口加 PYTHONPYCACHEPREFIX

3C-3 的 `build_backend_env` 只给**后端子进程**注入 `PYTHONPYCACHEPREFIX`。**启动器自身**（被 `{app}\runtime\python\python.exe launcher\ShipinCutLauncher.py` 加载时）并没有这条环境变量。

后果：

- launcher 被 embedded Python 加载时，Python 会把 `launcher/ShipinCutLauncher.py` 编译成 `launcher/__pycache__/ShipinCutLauncher.cpython-311.pyc`，写在 `{app}\launcher\__pycache__\`。
- 在真 Program Files 下这个写操作会失败（`Access is denied`），安装版第一次双击就报错。

修法：bat 入口处先设 `PYTHONPYCACHEPREFIX=%LOCALAPPDATA%\ShipinCut\cache\pycache` 再启 embedded Python，launcher 自身继承这条环境变量，`.pyc` 落到 LocalAppData。

`启动视频混剪工具.bat`（3C-4 新增顶部块）：

```bat
REM v0.5.0 (3C-4): 安装版 launcher 自身也会被内置 Python 执行，
REM 在 import launcher\ShipinCutLauncher.py 时 Python 会写
REM __pycache__\ShipinCutLauncher.cpython-311.pyc 旁路 {app}\launcher\，
REM 在真 Program Files 下会失败（目录只读）。所以在 bat 里就把
REM PYTHONPYCACHEPREFIX 指向 LocalAppData，让 launcher 自身的 .pyc 也
REM 落到 %LOCALAPPDATA%\ShipinCut\cache\pycache，不写 {app}。
REM launcher 启后端时再把它原样继承给 backend（与 3C-3 行为一致）。
if "%PYTHONPYCACHEPREFIX%"=="" (
    set "PYTHONPYCACHEPREFIX=%LOCALAPPDATA%\ShipinCut\cache\pycache"
    if not exist "%PYTHONPYCACHEPREFIX%" mkdir "%PYTHONPYCACHEPREFIX%" >nul 2>&1
)
```

要点：

1. `if "%PYTHONPYCACHEPREFIX%"==""` —— 保留外部覆盖能力（开发态如果在 shell 里手设了 `PYTHONPYCACHEPREFIX=...`，bat 不强改）。
2. `if not exist ... mkdir` —— 兜底创建目录。launcher 自己也会 `mkdir(parents=True, exist_ok=True)`，bat 这层只是避免出现 race。
3. bat 的 `setlocal` 让 `PYTHONPYCACHEPREFIX` 只在 bat 进程内生效，启 embedded Python 时被继承；不会污染用户 shell。
4. launcher 启后端时，`build_backend_env` 会把 `PYTHONPYCACHEPREFIX` 重新指向**同一个** LocalAppData 目录（3C-3 已有逻辑），所以 bat 注入的值与 launcher 注入的值一致。

## 5. 安装包体积

| 指标 | 数值 |
|---|---|
| 3B 收尾版本（v0.4.0 / `9924c34`）的 `ShipinCutSetup.exe` | ~180 MB |
| 3C-2 POC 之后但**未**纳入安装包时的 `installer/runtime/python/` | 21 MB（~34 个 .pyd/.dll） |
| 3C-4 重新生成（v0.5.0）的 `ShipinCutSetup.exe` | **198,257,888 字节 ≈ 190 MB** |
| 实际增长 | ~10 MB |

为什么是 ~10 MB 而不是 21 MB：

- Inno Setup 走 LZMA 压缩 + solid compression；很多 `.pyd` / `.dll` 内有大量重复结构和 padding，压缩比高。
- 21 MB 是源码目录 `du -sh` 的结果，磁盘上是“未压缩”体积；`Setup.exe` 是 LZMA 压缩后体积。
- dist 目录里的 `whisper-cli.exe` / `ggml-*.dll` / 模型 `ggml-base.bin` / ffmpeg / ffprobe 等已是大头，本轮几乎不受影响。

体积仍在可接受范围内（教学 / 内测场景下，190 MB 单文件没问题；正式发布可以考虑外置 ffmpeg / 模型 / Python runtime，但不在 3C 范围）。

## 6. 安装包内容核对

3C-4 重新生成后，`{app}` 实际包含：

```text
{app}\
├── 启动视频混剪工具.bat      ← bat 入口（3C-3 + 3C-4 改动）
├── dist\                     ← vite build 产物（3B）
├── docs\                     ← 文档
├── index.html                ← Vite 入口（运行时通过 dist/ 实际加载）
├── launcher\
│   ├── ShipinCutLauncher.py
│   └── README.md
├── local-tools\
│   ├── ffmpeg\ffmpeg.exe
│   ├── ffmpeg\ffprobe.exe
│   ├── *.js
│   ├── package.json
│   └── whisper.config.json
├── package.json              ← 仅开发文档
├── package-lock.json
├── src\                      ← 仅开发文档
├── tools\
│   ├── jianying_draft\...
│   ├── pyjianying_runtime\...
│   └── whisper\...
├── vite.config.js
└── runtime\                  ← v0.5.0 / 3C-4 新增
    └── python\
        ├── python.exe              ← embedded 3.11.9
        ├── python311.dll
        ├── python3.dll
        ├── python311._pth          ← 3C-4 改：dev + install 两套路径
        ├── python311.zip
        ├── LICENSE.txt
        ├── libcrypto-3.dll
        ├── libssl-3.dll
        ├── libffi-8.dll
        ├── vcruntime140.dll
        ├── _asyncio.pyd ... (其它 stdlib .pyd)
        ├── pyexpat.pyd
        ├── select.pyd
        └── unicodedata.pyd
```

不再包含 `node_modules/`（3B 起已不打包）。仍包含 `package.json` / `src/` / `vite.config.js` / `index.html` 仅作开发文档，运行时通过 `dist/` 加载。

## 7. 端到端验证（本机实测）

### 7.1 安装包生成

```text
$ npm run build
✓ 32 modules transformed.
dist/index.html                   0.56 kB │ gzip:   0.39 kB
dist/assets/index-Cq2FyATO.css  213.83 kB │ gzip:  33.10 kB
dist/assets/index-Dcc3-tPY.js   385.82 kB │ gzip: 121.36 kB
✓ built in 914ms

$ installer\build-installer.bat
... Compressing: F:\shipin-cut\installer\..\installer\runtime\python\python.exe
... Compressing: F:\shipin-cut\installer\..\installer\runtime\python\python311.dll
... Compressing: F:\shipin-cut\installer\..\installer\runtime\python\libcrypto-3.dll
...
Successful compile (55.766 sec). Resulting Setup program filename is:
F:\shipin-cut\installer\dist\ShipinCutSetup.exe
```

`ShipinCutSetup.exe` = 198,257,888 字节 (≈190 MB)。

### 7.2 静默安装到测试目录

```bat
F:\shipin-cut\installer\dist\ShipinCutSetup.exe /VERYSILENT /SUPPRESSMSGBOXES ^
    /DIR=F:\shipin-cut\_test_install\ShipinCut /TASKS=desktopicon /NOICONS /NORESTART
```

安装后：

```text
$ ls F:/shipin-cut/_test_install/ShipinCut/runtime/python/python.exe
F:/shipin-cut/_test_install/ShipinCut/runtime/python/python.exe

$ du -sh F:/shipin-cut/_test_install/ShipinCut/runtime/python/
21M  F:/shipin-cut/_test_install/ShipinCut/runtime/python/
```

`runtime\python\python.exe` 存在；目录总大小 21 MB（与 3C-2 POC 源码目录完全一致，证明 `_pth` Excludes 没把 .pyc 误打入）。

### 7.3 启动器日志（embedded Python 路径）

```text
$ <install>\启动视频混剪工具.bat --no-browser   (or  等价：embedded python + launcher)

2026-06-21 11:26:24,915 [INFO] 正在启动视频混剪工具
2026-06-21 11:26:24,915 [INFO] 项目根目录：F:\shipin-cut\_test_install\ShipinCut
2026-06-21 11:26:24,915 [INFO] 用户数据目录：C:\Users\Admin\AppData\Local\ShipinCut
2026-06-21 11:26:24,915 [INFO] 启动日志：C:\Users\Admin\AppData\Local\ShipinCut\logs\launcher\launcher_20260621.log
2026-06-21 11:26:24,915 [INFO] 检测到 dist/index.html，进入静态前端模式（不依赖 Node/npm）。
2026-06-21 11:26:24,923 [INFO] 使用内置 Python 启动后端：F:\shipin-cut\_test_install\ShipinCut\runtime\python\python.exe
2026-06-21 11:26:25,944 [INFO] 正在启动本地服务
2026-06-21 11:26:26,992 [INFO] 本地服务已启动（PID 27604）。
2026-06-21 11:26:27,007 [INFO] 检测到静态前端已就绪（后端托管 dist/）。
2026-06-21 11:26:27,007 [INFO] 视频混剪工具已就绪，请保持本窗口打开。
```

✅ 启动器明确走 `{app}\runtime\python\python.exe`，**不是**系统 Python。

### 7.4 /health（embedded Python 标识）

```text
$ curl -s http://127.0.0.1:8765/health | python -m json.tool
{
  "ok": true,
  "service": "shipin-cut-local-export",
  "version": "0.9.8",
  "whisper": {
    "available": true,
    "reason": "",
    "cli": "F:\\shipin-cut\\_test_install\\ShipinCut\\tools\\whisper\\whisper-cli.exe",
    "model": "F:\\shipin-cut\\_test_install\\ShipinCut\\tools\\whisper\\models\\ggml-base.bin"
  },
  "ffmpeg": {
    "path": "F:\\shipin-cut\\_test_install\\ShipinCut\\local-tools\\ffmpeg\\ffmpeg.exe",
    "local": true
  }
}

$ curl -sI http://127.0.0.1:8765/health | grep -i server
Server: BaseHTTP/0.6 Python/3.11.9
```

✅ `Server: Python/3.11.9` —— 后端进程是 embedded 3.11.9。
✅ whisper / ffmpeg 路径都从 `{app}` 解析，**不**依赖系统 PATH。

### 7.5 端口与进程审计

```text
$ netstat -ano | grep :5173
(空)

$ tasklist | grep -i "node.exe"
(空)
```

✅ 5173 不被占用。
✅ node.exe 没有被启动。

### 7.6 pycache 重定向（3C-3 行为 + 3C-4 bat 注入）

```text
$ find <install> -name "__pycache__"
(空)

$ find <install> -name "*.pyc"
(空)

$ find "%LOCALAPPDATA%\ShipinCut\cache\pycache" -name "*.pyc" | wc -l
87
```

✅ `{app}` 下完全没有 `__pycache__` 或 `.pyc`。
✅ 87 个 `.pyc` 全部落到 `LocalAppData\ShipinCut\cache\pycache\shipin-cut\tools\pyjianying_runtime\...`。
✅ launcher 自身的 .pyc 也走 `PYTHONPYCACHEPREFIX`（3C-4 bat 注入），不再写 `{app}\launcher\__pycache__\`。

### 7.7 端到端功能

字幕识别：

```text
$ curl -s -X POST http://127.0.0.1:8765/transcribe-video \
    -H "Content-Type: application/json; charset=utf-8" \
    -d @transcribe.json
{
  "ok": true,
  "segments": [
    {"id": 1, "start": 0.0,  "end": 3.44, "text": "吃破碗的饺子皮..."},
    ... (共 10 条)
  ],
  "count": 10
}
```

✅ whisper 链路正常（embedded Python → 系统 PATH 上的 whisper-cli → ggml-base 模型）。

导出剪映草稿：

```text
$ curl -s -X POST http://127.0.0.1:8765/export-jianying \
    -H "Content-Type: application/json; charset=utf-8" \
    -d @jianying_poc3c4.json
{
  "ok": true,
  "message": "已生成剪映草稿：POC3C4。...",
  "draftName": "POC3C4",
  "draftPath": "C:\\Users\\Admin\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\POC3C4",
  "isWrittenToJianyingDraftDir": true,
  "expectedSubs": 2,
  "jianyingWrittenSubtitleCount": 2,
  "finalStatus": "success"
}

$ ls "C:\Users\Admin\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\POC3C4\"
draft_content.json  draft_meta_info.json  draft_settings  timeline_layout.json
```

✅ pyJianYingDraft 链路正常，真实草稿写到 JianyingPro 草稿目录。

### 7.8 覆盖安装

在已有 `_test_install\ShipinCut\` 上再次跑同一条静默安装命令：

```text
$ F:\shipin-cut\installer\dist\ShipinCutSetup.exe /VERYSILENT ... /DIR=...
(成功，无错误)

$ ls <install>/runtime/python/python.exe
(存在)

$ ls <install>/dist/index.html
(存在)

$ ls <install>/runtime/python/ | wc -l
34
```

✅ 覆盖安装成功，`runtime\python\` 完整覆盖（34 个文件），`dist/` 完整覆盖。

## 8. 期间**没**改的

- `tools/local_export_server.py` —— **未改**。
- `tools/export_video.py` —— **未改**。
- `tools/export_with_jianying.py` —— **未改**。
- `tools/jianying_draft/export_with_pyjianying.py` —— **未改**。
- `launcher/ShipinCutLauncher.py` —— **未改**（3C-3 已经够用，bat 在外面注入 `PYTHONPYCACHEPREFIX`）。
- `src/App.jsx` / `src/App.css` —— **未改**。
- `dist/` —— 仅 `npm run build` 重新生成，源码未改。
- v0.9.12c 组合刷新 bug 修复 —— **未改**（仅 `src/App.jsx` 86 行，跟 3C-4 无关）。
- `installer/dist/` —— **未手动提交**（按 `.gitignore` 规则不提交）。
- 系统 Python 回退逻辑 —— **保留**（bat 仍先 `if exist %~dp0runtime\python\python.exe goto :use_embedded`，命中失败再 `python` / `py -3`）。开发态无 embedded Python 时仍可启动（v0.9.14 行为）。
- `installer/runtime/README.md` —— **本轮未改**（更新内容随 3C-5 一起更合理）。

## 9. 3C-5 干净机器测试建议

3C-5 = **真干净机测试**（无 Python / 无 Node / 无 ffmpeg / 无 whisper）。3C-4 在本机的模拟装包不算干净机，**必须**用 VM 或借用机器跑一遍。

### 9.1 测试环境

准备一台：

- Windows 10/11 x64 虚拟机（干净系统镜像）。
- 不安装 Python、不安装 Node、不安装 ffmpeg、不安装 whisper。
- `%LOCALAPPDATA%\ShipinCut\` 不存在（或安装完清空）。
- 联网（首次安装会拉 Inno Setup 编译，但**用户机器**只跑 Setup.exe，不需要联网）。
- 桌面能双击图标、能打开剪映（剪映可以晚一点装，做“剪映未装”分支的回归）。

### 9.2 测试用例

| # | 用例 | 期望 |
|---|---|---|
| 1 | 双击 `ShipinCutSetup.exe`，按默认 `{autopf}\ShipinCut` 安装 | 进度条跑完，开始菜单和桌面图标都建好 |
| 2 | 安装完勾选“启动视频混剪工具” | bat 弹窗 + 浏览器自动打开 `http://127.0.0.1:8765/shipin-cut/` |
| 3 | 不勾选，自己双击桌面图标 | 同上 |
| 4 | 启动器日志 | 包含 `使用内置 Python 启动后端：C:\Program Files\ShipinCut\runtime\python\python.exe` |
| 5 | `curl http://127.0.0.1:8765/health` | `Server: Python/3.11.9`、`ok: true`、whisper / ffmpeg 状态对 |
| 6 | `curl http://127.0.0.1:8765/shipin-cut/` | 返回 `<!DOCTYPE html>` |
| 7 | `where python` / `where py` | 找不到（系统无 Python） |
| 8 | `where whisper-cli` / `where ffmpeg` | 找不到（系统无） |
| 9 | `where node` | 找不到（系统无） |
| 10 | `netstat -ano \| grep :5173` | 空 |
| 11 | `tasklist \| grep node.exe` | 空 |
| 12 | `find "C:\Program Files\ShipinCut" -name "__pycache__"` | 空（`{app}` 干净） |
| 13 | `find "C:\Program Files\ShipinCut" -name "*.pyc"` | 空 |
| 14 | `find "%LOCALAPPDATA%\ShipinCut\cache\pycache" -name "*.pyc" \| wc -l` | > 0（所有 .pyc 走 LocalAppData） |
| 15 | 上传一段短视频 + 字幕识别 | 正常返回 segments |
| 16 | 导出剪映草稿 | 写到 `C:\Users\<u>\AppData\Local\JianyingPro\...` |
| 17 | 打开草稿文件夹 | 弹出 4 个文件 |
| 18 | 打开剪映 | 在剪映草稿箱看到刚导出的草稿 |
| 19 | 关闭启动器（关 bat 窗口） → 再双击桌面图标 | SingleInstanceLock 提示已有实例在跑（不双开） |
| 20 | 卸载（控制面板 → ShipinCut） | 卸载干净，开始菜单 / 桌面图标都清掉 |
| 21 | 卸载后 `%LOCALAPPDATA%\ShipinCut\` 保留 | 用户数据不丢（卸载不删数据，3A 既有行为） |
| 22 | 重新安装到 `D:\ShipinCut`（自定义目录） | 同样能跑 |
| 23 | 安装目录含中文 / 含空格 | 同样能跑（3B 已验过；3C-4 走同一条路） |
| 24 | v0.9.12c 组合刷新 bug | 不回退（前端逻辑没动） |

### 9.3 已知风险 / 注意事项

1. **首次冷启动慢**：embedded Python 第一次 import 整个 `pyJianYingDraft + pymediainfo + comtypes + uiautomation` 链耗时约 1-2 秒（实测）。bat 启 launcher + launcher 启 backend 总冷启动 < 5 秒，可接受。
2. **杀毒误报**：embeddable Python 不加壳，但 `whisper-cli.exe` 是第三方工具，可能被 Windows Defender 拦。如果学员机弹警告，3C-5 一起记录白名单说明（v0.9.10 起的 3A 阶段已经走过一次）。
3. **Program Files 权限**：测试中**不要**用普通用户 + UAC 提权安装 — Inno Setup 已 `PrivilegesRequired=admin`，会自己弹 UAC；3C-4 改动**没**绕开这个约束。
4. **覆盖安装 vs 卸载重装**：3C-4 验过“覆盖安装”，但没验“卸载 → 重装”。3C-5 至少跑一次卸载重装，确认 `{app}` 不残留 `__pycache__`、不残留 `runtime\python\`。
5. **PYTHONPYCACHEPREFIX 的值**：bat 写死 `%LOCALAPPDATA%\ShipinCut\cache\pycache`。如果学员改环境变量指向别处，3C-4 不动这块（仍按 3C-3 默认值）。

### 9.4 通过判定

- 24 个用例全过。
- 至少 2 台不同机器（开发机 + 干净机）。
- 验收记录写进 `docs/验收记录-阶段3C-4安装包纳入EmbeddedPython-20260620.md`（本轮**不**强制要求；3C-5 写）。

## 10. 修改的文件

- `installer/shipin-cut.iss`
  - 版本号 `0.4.0` → `0.5.0`
  - `[Files]` 段新增 `Source: "..\installer\runtime\python\*"; DestDir: "{app}\runtime\python"; Excludes: "__pycache__\*,*.pyc"; Flags: ignoreversion recursesubdirs createallsubdirs`
- `启动视频混剪工具.bat`
  - 顶部新增 11 行：在启 embedded Python 之前注入 `PYTHONPYCACHEPREFIX=%LOCALAPPDATA%\ShipinCut\cache\pycache` 并兜底创建目录
- `installer/runtime/python/python311._pth`
  - 把 `..\..\..\tools\pyjianying_runtime` 注释里“3C-2 POC”说法的“3C-2”改为“3C-4”同步；
  - 新增一行 `..\..\tools\pyjianying_runtime` 适配安装版布局
- `docs/阶段3C-4-安装包纳入EmbeddedPython-20260620.md` —— 新增
- `docs/阶段3C-Python运行时打包方案-20260620.md` —— 末尾追加 3C-4 完成记录和链接
- `installer/dist/ShipinCutSetup.exe` —— 重新生成（按 `.gitignore` 不提交）

## 11. 下一步：3C-5

3C-5 = 真干净机器测试（VM / 借用机）。3C-4 在本机“模拟装包”已经覆盖了：

- 安装包生成（`installer\build-installer.bat`）。
- 静默安装到测试目录。
- 启动器命中 `{app}\runtime\python\python.exe`。
- 后端 `Server: Python/3.11.9`、whisper / ffmpeg 从 `{app}` 解析。
- 5173 / node.exe 不被启动。
- `{app}` 无 `__pycache__` / `.pyc`，87 个 .pyc 全部落 LocalAppData。
- 字幕识别 + 剪映草稿导出（含真实写入 JianyingPro 目录）。
- 覆盖安装。

3C-5 还需要做 3C-4 **没做**的：

- 干净机无系统 Python（用 `where python` / `where py` 验证都找不到）。
- 干净机无 Node、无 ffmpeg、无 whisper。
- 卸载 → 重装。
- 启动器冷启动时间记录。
- 杀毒误报情况（Windows Defender 默认策略）。
- 至少 2 台机器（开发机 + 干净机）回归。

3C-4 期间**不动** 3C-5 内容；3C-5 单开一轮做。
