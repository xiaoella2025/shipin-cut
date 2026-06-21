# 阶段 3C-2：embeddable Python POC - 2026-06-20

> 本轮是 **POC**，不替换正式启动器、不修改正式安装包主流程、不修改 `启动视频混剪工具.bat`、不修改桌面图标。

## 1. POC 目标

证明：项目可以内置 Python 解释器，**不再依赖系统 Python**。

具体验收项（与 3C 方案文档 6 节一致）：

1. 把 Python 3.11.x embeddable runtime 放进项目。
2. 用内置 Python 启动 `tools/local_export_server.py`。
3. `/health` 正常返回。
4. 页面能通过 8765 正常打开。
5. 字幕识别能跑。
6. 导出剪映草稿能跑。
7. `{app}` / 安装目录仍不写运行时数据。
8. 运行时数据仍写 `%LOCALAPPDATA%\ShipinCut`。

## 2. POC 选用版本

- **Python 3.11.9 64-bit embeddable**。
- 来源：`https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip`（10.7 MB）。
- 理由见 `docs/阶段3C-1-Python依赖清单审计-20260620.md` 第 11 节：3.11 是 pyJianYingDraft / pymediainfo / uiautomation / comtypes 全部官方支持的稳定版本；3.14 没有 embeddable 包。

## 3. POC 目录结构

```text
installer/runtime/
├── README.md                           ← 目录说明（POC 入口）
├── run_server_embedded.bat             ← POC 启动脚本
└── python/                             ← embeddable Python 3.11.9
    ├── python.exe
    ├── pythonw.exe
    ├── python311.dll
    ├── python311.zip
    ├── python311._pth                  ← 已修改（启用 import site + 加 vendored runtime）
    ├── python3.dll
    ├── libcrypto-3.dll
    ├── libffi-8.dll
    ├── libssl-3.dll
    ├── sqlite3.dll
    ├── vcruntime140.dll
    ├── vcruntime140_1.dll
    ├── *.pyd                           ← stdlib 动态模块
    ├── python.cat
    └── LICENSE.txt
```

`installer/runtime/python/` 总计 **20.7 MB**（约 33 个文件）。在 50 MB 阈值内，本轮**直接提交**。

## 4. python311._pth 关键配置

POC 在 `installer/runtime/python/python311._pth` 写入：

```text
python311.zip
.

# 3C-2 POC: enable site-packages so embedded Python can load third-party
# packages placed in tools\pyjianying_runtime\.
import site

# 3C-2 POC: project vendored runtime. Path is relative to
# installer\runtime\python\ (i.e. the directory containing this _pth),
# going up three levels to the repo root, then into tools\pyjianying_runtime.
..\..\..\tools\pyjianying_runtime
```

要点：

1. `python311.zip` + `.` 是 embeddable 默认项，保留。
2. `import site` 取消注释，让 embedded Python 走 site-packages 查找路径。
3. `..\..\..\tools\pyjianying_runtime` 是相对路径（基于 `_pth` 所在目录），等价于 `<repo>\tools\pyjianying_runtime`。
4. **不**直接 `cd` 到 repo 根启动，而是从 `_pth` 所在目录反推，**避免**绝对路径被硬编码到 `Program Files` 之类的位置。

## 5. POC 启动脚本

`installer/runtime/run_server_embedded.bat`（POC 专用，不替换 `启动视频混剪工具.bat`）：

关键行为：

1. 强制调用 `installer\runtime\python\python.exe`，**不**调系统 PATH 的 `python.exe`。
2. 反推仓库根：`%~dp0..\..`。
3. `cd /d %REPO_ROOT%`。
4. 设置 `SHIPIN_CUT_DATA_ROOT=%LOCALAPPDATA%\ShipinCut`（与 3B / 3C-1 一致）。
5. 设置 `PYTHONPYCACHEPREFIX=%LOCALAPPDATA_DIR%\cache\pycache`（**关键**：见第 6 节）。
6. 启动 `tools\local_export_server.py`。
7. 控制台打印解释器路径、后端脚本路径、数据根目录、健康检查地址、前端页面地址。

## 6. 关键发现：PYTHONPYCACHEPREFIX 必须设置

POC 期间**先没**设置 `PYTHONPYCACHEPREFIX`，跑了一轮，发现：

- `import pyJianYingDraft` → `import uiautomation` → `import comtypes` 这条链在 Windows 上会自动 import 子模块，每个子模块都会写 `__pycache__/<name>.cpython-311.pyc`。
- 默认情况下，`.pyc` 写到 `.py` 同目录的 `__pycache__/`，**也就是** `tools/pyjianying_runtime/comtypes/client/__pycache__/...`。
- **这会违反** `{app}` 只读约束（`C:\Program Files\ShipinCut\tools\pyjianying_runtime\...` 不允许写入）。

**解决方法**：在启动脚本里设置 `PYTHONPYCACHEPREFIX`：

```text
set PYTHONPYCACHEPREFIX=%LOCALAPPDATA_DIR%\cache\pycache
```

效果：所有 `.pyc` 统一写到 `%LOCALAPPDATA%\ShipinCut\cache\pycache\<src-path>\<name>.cpython-311.pyc`，**不再**写 `{app}`。

> 这个 issue 3C-1 审计时没发现，因为审计只看 import 链，没真跑后端；3C-2 跑后端立刻暴露。**3C-3 启动器兼容层落地时，必须把 `PYTHONPYCACHEPREFIX` 同步注入到 launcher / 主启动脚本**。

## 7. POC 验证结果

### 7.1 解释器与 sys.executable

```text
$ ./installer/runtime/python/python.exe -c "import sys; print(sys.executable)"
F:\shipin-cut\installer\runtime\python\python.exe
$ ./installer/runtime/python/python.exe -c "import sys; print(sys.version)"
3.11.9 (tags/v3.11.9:de54cf5, Apr  2 2024, 10:12:12) [MSC v.1938 64 bit (AMD64)]
$ ./installer/runtime/python/python.exe -c "import sys; print(sys.prefix)"
F:\shipin-cut\installer\runtime\python
```

✅ `sys.executable` 是内置 `python.exe`，**不**是系统 `C:\Users\Admin\AppData\Local\Programs\Python\Python314\python.exe`。

### 7.2 import 链

```text
$ ./installer/runtime/python/python.exe -c "
import pyJianYingDraft, pymediainfo, uiautomation, comtypes
print('pyJianYingDraft:', pyJianYingDraft.__file__)
print('pymediainfo:', pymediainfo.__file__)
print('uiautomation:', uiautomation.__file__)
print('comtypes:', comtypes.__file__)
"
pyJianYingDraft: F:\shipin-cut\tools\pyjianying_runtime\pyJianYingDraft\__init__.py
pymediainfo: F:\shipin-cut\tools\pyjianying_runtime\pymediainfo\__init__.py
uiautomation: F:\shipin-cut\tools\pyjianying_runtime\uiautomation\__init__.py
comtypes: F:\shipin-cut\tools\pyjianying_runtime\comtypes\__init__.py
```

✅ 4 个第三方包全部从 `tools\pyjianying_runtime\` 加载。`sys.path` 正确包含 `<repo>\tools\pyjianying_runtime`。

### 7.3 MediaInfo.dll 加载

```text
$ ./installer/runtime/python/python.exe -c "
import pymediainfo
m = pymediainfo.MediaInfo.parse(r'F:\shipin-cut\input-videos\1.mp4')
print('parse OK, tracks:', len(m.tracks))
"
parse OK, tracks: 3
  track kind: General  duration_ms: 45303
  track kind: Video    duration_ms: 45300
  track kind: Audio    duration_ms: 45303
```

✅ `MediaInfo.dll` ctypes 加载成功，pymediainfo 能正常解析 MP4 元信息（General / Video / Audio 三轨，时长 45.3s）。

### 7.4 /health

```text
$ curl -i http://127.0.0.1:8765/health
HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.11.9
...
{
  "ok": true,
  "service": "shipin-cut-local-export",
  "version": "0.9.8",
  "whisper": {
    "available": true,
    "cli": "F:\\shipin-cut\\tools\\whisper\\whisper-cli.exe",
    "model": "F:\\shipin-cut\\tools\\whisper\\models\\ggml-base.bin"
  },
  "ffmpeg": {"path": "系统 PATH", "local": false}
}
```

✅ `Server: Python/3.11.9` —— 后端进程确认是 embeddable Python 3.11.9（不是系统 3.14.5）。
✅ whisper 模型和 cli 路径正确指向 `tools\whisper\`。
⚠️ ffmpeg 命中 “系统 PATH” —— 当前开发机 ffmpeg 在 PATH 上；安装版会通过 `_find_local_tool` 命中 `{app}\local-tools\ffmpeg\ffmpeg.exe`，**这条路径不变**。

### 7.5 前端页面

```text
$ curl -i http://127.0.0.1:8765/shipin-cut/
HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.11.9
Content-Type: text/html; charset=utf-8
...
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <title>视频混剪工具</title>
    <script type="module" crossorigin src="/shipin-cut/assets/index-Dcc3-tPY.js"></script>
    <link rel="stylesheet" crossorigin href="/shipin-cut/assets/index-Cq2FyATO.css">
  </head>
```

✅ 后端正确托管 `dist/index.html` + assets。

### 7.6 字幕识别（whisper）

POC 视频：`input-videos/1.mp4`（6.5 MB，45.3s 中文人声）。

```text
$ curl -X POST http://127.0.0.1:8765/upload-video -F "file=@input-videos/1.mp4"
{"ok": true, "type": "video", "fileName": "video_20260621_105343_1.mp4", ...}

$ curl -X POST http://127.0.0.1:8765/transcribe-video \
       -H "Content-Type: application/json" \
       -d '{"storedFile":"video_20260621_105343_1.mp4","language":"zh"}'
{"ok": true, "segments": [
  {"id": 1, "start": 0.0,  "end": 3.44, "text": "吃破碗的饺子皮可以做金酱肉丝捡柄"},
  {"id": 2, "start": 3.44, "end": 7.08, "text": "简单又好吃 协会了不用去饭店吃了"},
  ... 10 条
], "count": 10}
```

✅ whisper 子进程由 embeddable Python 启动，识别出 10 条字幕。

### 7.7 导出剪映草稿（pyJianYingDraft）

POC 用字幕识别结果的前 2 条做内联字幕：

```text
$ curl -X POST http://127.0.0.1:8765/export-jianying \
       -H "Content-Type: application/json; charset=utf-8" \
       --data-binary @jianying_test.json
{
  "ok": true,
  "message": "已生成剪映草稿：POC3C2。...",
  "draftName": "POC3C2",
  "draftPath": "C:\\Users\\Admin\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\POC3C2",
  "draftFolder": "C:\\Users\\Admin\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft",
  "isWrittenToJianyingDraftDir": true,
  "debug": {
    "expectedSubs": 2,
    "jianyingWrittenSubtitleCount": 2,
    "returncode": 0,
    "finalStatus": "success"
  }
}
```

✅ pyJianYingDraft 子进程由 embeddable Python 启动，剪映草稿成功写入真实 JianyingPro 草稿目录：

```text
C:\Users\Admin\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\POC3C2\
├── draft_content.json       (13137 bytes)
├── draft_meta_info.json     (1911 bytes)
├── draft_settings           (149 bytes)
└── timeline_layout.json     (311 bytes)
```

### 7.8 路径写入审计

**POC 期间（设置 PYTHONPYCACHEPREFIX 后）**：

```text
# 安装目录（应无运行时写入）
$ find installer -newer installer/build-installer.bat -type f
installer/dist/ShipinCutSetup.exe       ← pre-existing
installer/README.md                    ← pre-existing
installer/runtime/python/python311._pth ← 我修改的
installer/runtime/README.md             ← 我创建的
installer/runtime/run_server_embedded.bat ← 我创建的
installer/shipin-cut.iss               ← pre-existing

# tools/（应无 __pycache__ / .pyc）
$ find tools -name "__pycache__"  # 空
$ find tools -name "*.pyc"         # 空

# dist/（应无写入）
$ find dist -newer dist/index.html -type f
dist/assets/index-Cq2FyATO.css       ← pre-existing
dist/assets/index-Dcc3-tPY.js        ← pre-existing

# 用户目录（应有运行时数据 + __pycache__ 重定向到这里）
$ find "%LOCALAPPDATA%\ShipinCut\cache\pycache" -name "*.pyc" | wc -l
> 100 个（已重定向到 <LocalAppData>\ShipinCut\cache\pycache\shipin-cut\...）

$ ls "%LOCALAPPDATA%\ShipinCut\workspace\videos"
video_20260621_105343_1.mp4
$ ls "%LOCALAPPDATA%\ShipinCut\workspace\temp"
jianying_sub_20260621_105416_236372.srt
$ ls "%LOCALAPPDATA%\ShipinCut\workspace\drafts"
web-export-current.json
$ ls "%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft\POC3C2"
draft_content.json  draft_meta_info.json  draft_settings  timeline_layout.json
```

✅ 安装目录 `installer/`、`tools/`、`dist/` 全部**无运行时写入**。
✅ 所有运行时数据（workspace + cache/pycache）正确落到 `%LOCALAPPDATA%\ShipinCut\`。
✅ 剪映草稿正确落到 `%LOCALAPPDATA%\JianyingPro\User Data\Projects\com.lveditor.draft\`（系统约定）。

## 8. POC 结论

**embeddable Python 路线验证通过**。

| 验收项 | 结果 | 证据 |
|---|---|---|
| 内置 Python 跑后端 | ✅ | `Server: Python/3.11.9` |
| `/health` 200 | ✅ | curl 返回 200 + JSON |
| `/shipin-cut/` 页面正常 | ✅ | curl 返回 HTML + assets |
| 字幕识别成功 | ✅ | 10 条字幕 |
| 导出剪映草稿成功 | ✅ | 真实写入 JianyingPro 草稿目录 |
| `{app}` 无运行时写入 | ✅ | 6.5 节验证 |
| 数据写到 LocalAppData | ✅ | 6.5 节验证 |
| sys.executable 是 embed | ✅ | `F:\shipin-cut\installer\runtime\python\python.exe` |
| 4 个 vendored 包 import OK | ✅ | 7.2 节 |
| MediaInfo.dll 加载 OK | ✅ | 7.3 节 |

## 9. POC 暴露的关键 issue（需在 3C-3 / 3C-4 解决）

1. **PYTHONPYCACHEPREFIX 必须设置**（最重要，详见第 6 节）。
   - 3C-3 启动器兼容层落地时，**必须**把 `PYTHONPYCACHEPREFIX=%LOCALAPPDATA%\ShipinCut\cache\pycache` 注入到 launcher / 主启动脚本的环境变量。
   - 3C-4 装包时把 `installer/runtime/python/` 一起打入，**但** PYTHONPYCACHEPREFIX 仍然由 3C-3 启动器 / 3C-2 bat 注入。

2. **ffmpeg 路径在 POC 上命中“系统 PATH”**。
   - 当前开发机 ffmpeg 在 PATH 上，POC 没把 ffmpeg 拷进 `local-tools/ffmpeg/`。
   - 安装版 3B 已经通过 `_find_local_tool` 命中 `{app}\local-tools\ffmpeg\`，**这条路径不变**；POC 上 ffmpeg 行为与 3B 安装版一致。
   - **不是 issue，只是开发态 vs 安装态的差异**。

3. **whisper 模型 142 MB 没有进 installer/runtime/**。
   - 模型仍在 `tools/whisper/models/ggml-base.bin`，跟 3B 安装版一致。
   - 3C-4 是否把模型打进安装包单独决策，**POC 不展开**。

4. **embeddable Python 没有 pip**。
   - 站点包通过 `tools\pyjianying_runtime\` 提供，**不**走 pip。
   - 如果后续要补 pip，单独走 `get-pip.py` + 修改 `_pth`，3C-2 POC 不做。

## 10. 下一步

- **3C-3（启动器兼容 embedded Python）**：
  - `启动视频混剪工具.bat` 优先调 `{app}\runtime\python\python.exe`，回退系统 `python.exe`。
  - `launcher/ShipinCutLauncher.py` 在 start_process 之前注入 `PYTHONPYCACHEPREFIX`。
  - 不改 `local_export_server.py` / `tools/*.py`。
  - 完整保留 3B 桌面图标 / 启动器行为。

- **3C-4（安装包纳入 Python runtime）**：
  - `installer/shipin-cut.iss` 增加 `Source: "..\installer\runtime\python\*"; DestDir: "{app}\runtime\python"`。
  - 主启动脚本 / launcher 在 3C-3 落地时已经能优先用内置 Python，3C-4 装上后**自动生效**。

- **3C-5（干净机器测试）**：
  - Windows 10/11 虚拟机，**不**装 Python。
  - `ShipinCutSetup.exe` 全流程安装 → 桌面图标 → /health → /shipin-cut/ → 字幕识别 → 导出剪映草稿。

## 11. POC 期间触及的运行代码

**POC 期间没有改运行代码**。仅：

1. 新增 `installer/runtime/run_server_embedded.bat`（POC 专用 bat，**不**替换主启动器）。
2. 修改 `installer/runtime/python/python311._pth`（embeddable 自带，3C 必改）。
3. 新增 `installer/runtime/README.md`（说明）。
4. 提交 `installer/runtime/python/` 整目录（20.7 MB）。

POC 验证完毕后，**`tools/`、`launcher/`、`installer/shipin-cut.iss`、`src/`、`启动视频混剪工具.bat`** 全部**未修改**。3C-2 出口物 = 本文档 + `installer/runtime/`。
