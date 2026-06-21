# 阶段 3C-3：启动器兼容 embedded Python - 2026-06-20

> 本轮把 3C-2 POC 已经验证的 embedded Python 接入正式启动器逻辑。不替换主启动器本身（`启动视频混剪工具.bat` 仍由双击图标触发），而是让 `launcher/ShipinCutLauncher.py` 启动后端时**优先用 embedded Python**。
>
> 本轮**不**做 3C-4（安装包纳入 runtime）。`installer/shipin-cut.iss` 未改。

## 1. 本轮目标

| 验收项 | 状态 |
|---|---|
| 启动器优先使用 `<root>/runtime/python/python.exe` 或 `<root>/installer/runtime/python/python.exe` | ✅ |
| 找不到 embedded Python 时回退到 `sys.executable` | ✅ |
| 启动器向后端注入 `PYTHONPATH`（含项目根 + `tools/pyjianying_runtime`） | ✅ |
| 启动器向后端注入 `PYTHONPYCACHEPREFIX=%LOCALAPPDATA%\ShipinCut\cache\pycache` | ✅ |
| 后端 `sys.executable` = embedded `python.exe` | ✅ |
| `/health` 正常，`Server: Python/3.11.9` | ✅ |
| `/shipin-cut/` 页面正常 | ✅ |
| 5173 / node.exe 不被启动 | ✅ |
| `{app}` / `tools/` 不产生 `__pycache__` / `.pyc` | ✅ |
| `.pyc` 全部落到 `%LOCALAPPDATA%\ShipinCut\cache\pycache` | ✅ |
| 字幕识别成功 | ✅ |
| 导出剪映草稿成功 | ✅ |
| `pytest tests/ -q` 通过 | ✅ |

## 2. Python 解释器查找优先级

启动器现在通过 `ShipinCutLauncher.resolve_embedded_python(project_root)` 解析后端 Python 解释器：

```text
1. <project_root>/runtime/python/python.exe              ← 3C-4 安装版布局
2. <project_root>/installer/runtime/python/python.exe   ← 3C-2 开发态布局
3. sys.executable（启动器自身的 Python）                 ← 兜底
```

任一命中即返回绝对路径；都不存在返回 `None`，启动器在 `run_launcher` 中打印“未找到内置 Python，回退到当前解释器”并继续。

bat 入口（`启动视频混剪工具.bat`）也加了同样的检查：

```bat
if exist "%~dp0runtime\python\python.exe" goto :use_embedded
if exist "%~dp0installer\runtime\python\python.exe" goto :use_embedded_dev

python --version >nul 2>&1
... 回退到系统 python
```

→ 这样**整条链路**（bat → launcher → backend）都可以在没有系统 Python 的机器上跑。

## 3. embedded Python 路径解析

新增 `ShipinCutLauncher.EMBEDDED_PYTHON_CANDIDATES` 和 `resolve_embedded_python`：

```python
EMBEDDED_PYTHON_CANDIDATES: tuple[tuple[str, ...], ...] = (
    ("runtime", "python", "python.exe"),                # 安装版
    ("installer", "runtime", "python", "python.exe"),   # 开发态
)

def resolve_embedded_python(project_root: Path) -> Path | None:
    for parts in EMBEDDED_PYTHON_CANDIDATES:
        candidate = project_root.joinpath(*parts)
        if candidate.is_file():
            return candidate.resolve()
    return None
```

测试覆盖：安装版布局优先（即便开发态布局同时存在）、开发态布局兜底、空目录返回 `None`、只建子目录但缺 `python.exe` 时不误报（`test_returns_none_when_partial_layout`）。

## 4. 后端 env 构造：build_backend_env

新增 `ShipinCutLauncher.build_backend_env(project_root, user_data_root, pycache_dir, base_env=None)`，向后端注入：

| 变量 | 取值 | 作用 |
|---|---|---|
| `SHIPIN_CUT_DATA_ROOT` | `<user_data_root>` | 写 `%LOCALAPPDATA%\ShipinCut\workspace` 等，3B 已存在 |
| `PYTHONPATH` | `<project_root>` + `<project_root>/tools/pyjianying_runtime`（+ 已有 `PYTHONPATH`） | 让 embedded Python 能 import pyJianYingDraft / pymediainfo / uiautomation / comtypes |
| `PYTHONPYCACHEPREFIX` | `<user_data_root>/cache/pycache`（自动 mkdir） | 把 `__pycache__` 重定向到用户目录，**不**写 `{app}` |

实现要点：

- `pyjianying_runtime` 不存在时不强行注入（避免挂空指针），只放项目根。
- 保留传入的 `PYTHONPATH`（如果有的话），拼到末尾。
- `pycache_dir` 自动 `mkdir(parents=True, exist_ok=True)`，调用方无需关心。

## 5. ensure_user_data_dirs 新增 pycache 目录

`ShipinCutLauncher.ensure_user_data_dirs` 现在创建 5 个目录而不是 4 个：

```python
paths = {
    "launcher_logs": user_data_root / "logs" / "launcher",
    "runtime":       user_data_root / "runtime",
    "config":        user_data_root / "config",
    "cache":         user_data_root / "cache",
    "pycache":       user_data_root / "cache" / "pycache",  # v0.9.14 (3C-3) 新增
}
```

`TestUserDataPaths.test_creates_writable_directories_outside_project_root` 已扩展校验 `paths["pycache"]`。

## 6. run_launcher 的新流程

`run_launcher` 在原本的 `static_mode` 判断之后、SingleInstanceLock 之前，**先解析后端 Python**：

```python
embedded_python = resolve_embedded_python(project_root)
if embedded_python is not None:
    backend_python = str(embedded_python)
    if not verify_python(backend_python):
        logger.error("找到内置 Python 但无法执行：%s", backend_python)
        return 1
    logger.info("使用内置 Python 启动后端：%s", backend_python)
else:
    backend_python = sys.executable
    logger.info("未找到内置 Python（…），回退到当前解释器：%s", backend_python)
```

启动后端时：

```python
backend_env = build_backend_env(
    project_root,
    user_data_root,
    user_paths["pycache"],
)
process = start_process(
    [backend_python, str(project_root / "tools" / "local_export_server.py")],
    project_root,
    child_log,
    backend_env,
)
```

`backend_python` 是 **str** 形式（不是 `Path`），`start_process` 内部用 `subprocess.Popen` 调。`verify_python` 现在支持可选 `python=` 参数（默认仍是 `sys.executable`），用于校验 embedded Python 是否能跑 `--version`。

## 7. 启动视频混剪工具.bat 更新

bat 增加三段新标签：

- `:use_embedded` 命中 `<root>/runtime/python/python.exe`（安装版布局）。
- `:use_embedded_dev` 命中 `<root>/installer/runtime/python/python.exe`（开发态布局）。
- 都没有时回退到 `python` / `py -3`，再没有就报错。

启动日志会明确打印：

```text
[启动器] 使用内置 Python：F:\shipin-cut\installer\runtime\python\python.exe
```

或：

```text
[启动器] 未发现内置 Python，回退到系统 python。
```

→ 用户在 cmd / powershell 里能直接看到走了哪条路。

## 8. 端到端验证（本机实测）

### 8.1 启动器日志

```text
$ python launcher/ShipinCutLauncher.py --no-browser
2026-06-21 11:08:37,121 [INFO] 正在启动视频混剪工具
2026-06-21 11:08:37,121 [INFO] 项目根目录：F:\shipin-cut
2026-06-21 11:08:37,121 [INFO] 用户数据目录：C:\Users\Admin\AppData\Local\ShipinCut
2026-06-21 11:08:37,121 [INFO] 启动日志：C:\Users\Admin\AppData\Local\ShipinCut\logs\launcher\launcher_20260621.log
2026-06-21 11:08:37,121 [INFO] 检测到 dist/index.html，进入静态前端模式（不依赖 Node/npm）。
2026-06-21 11:08:37,128 [INFO] 使用内置 Python 启动后端：F:\shipin-cut\installer\runtime\python\python.exe
2026-06-21 11:08:38,155 [INFO] 正在启动本地服务
2026-06-21 11:08:39,235 [INFO] 本地服务已启动（PID 11064）。
2026-06-21 11:08:39,236 [INFO] 检测到静态前端已就绪（后端托管 dist/）。
2026-06-21 11:08:39,238 [INFO] 视频混剪工具已就绪，请保持本窗口打开。
```

✅ 启动器明确走 `installer\runtime\python\python.exe`，不是系统 Python。

### 8.2 /health

```text
$ curl -i http://127.0.0.1:8765/health
HTTP/1.0 200 OK
Server: BaseHTTP/0.6 Python/3.11.9
...
{"ok": true, "whisper": {"available": true, "cli": "F:\\shipin-cut\\tools\\whisper\\whisper-cli.exe", "model": "F:\\shipin-cut\\tools\\whisper\\models\\ggml-base.bin"}, ...}
```

✅ `Server: Python/3.11.9` —— 后端进程是 embedded Python 3.11.9，**不是**系统 3.14.5。
✅ whisper CLI + 模型路径都从 `{app}\tools\whisper\` 解析。

### 8.3 页面 + 端口审计

```text
$ curl http://127.0.0.1:8765/shipin-cut/ | head -3
<!DOCTYPE html>
<html lang="zh-CN">
  <head>

$ netstat -ano | grep :5173   # 空
$ tasklist /fi "imagename eq node.exe"   # 空
```

✅ 页面正常。
✅ 5173 不被占用。
✅ node.exe 没有被启动。

### 8.4 pycache 重定向

```text
$ find tools -name "__pycache__"   # 空
$ find tools -name "*.pyc"          # 空

$ find "%LOCALAPPDATA%\ShipinCut\cache\pycache" -name "*.pyc" | wc -l
87
```

✅ `tools/` 下完全没有 `__pycache__` 或 `.pyc`。
✅ 87 个 `.pyc` 全部落到 `LocalAppData\ShipinCut\cache\pycache\shipin-cut\tools\pyjianying_runtime\...`。

### 8.5 端到端功能

```text
# 字幕识别
$ curl -X POST http://127.0.0.1:8765/transcribe-video -d '{"storedFile":"video_20260621_105343_1.mp4","language":"zh"}'
{"ok": true, "segments": [10 条字幕], "count": 10}

# 导出剪映草稿
$ curl -X POST http://127.0.0.1:8765/export-jianying -d @jianying_test_3c3.json
{"ok": true, "draftName": "POC3C3", "isWrittenToJianyingDraftDir": true,
 "expectedSubs": 2, "jianyingWrittenSubtitleCount": 2, "finalStatus": "success"}

$ ls "...\JianyingPro\User Data\Projects\com.lveditor.draft\POC3C3\"
draft_content.json  draft_meta_info.json  draft_settings  timeline_layout.json
```

✅ whisper 链路正常。
✅ pyJianYingDraft 链路正常，真实草稿写到 JianyingPro 草稿目录。

## 9. 修改的文件

- `launcher/ShipinCutLauncher.py`
  - 新增 `EMBEDDED_PYTHON_CANDIDATES` 常量
  - 新增 `resolve_embedded_python(project_root) -> Path | None`
  - 新增 `build_backend_env(project_root, user_data_root, pycache_dir, base_env=None)`
  - `verify_python()` 增加可选 `python=` 参数
  - `ensure_user_data_dirs()` 增加 `pycache` 目录
  - `run_launcher()` 在 SingleInstanceLock 之前解析后端 Python 并打印来源；在 spawn backend 时用解析出的 `backend_python` + `build_backend_env()` 注入的 env
- `启动视频混剪工具.bat`
  - 增加 `:use_embedded` / `:use_embedded_dev` 标签，bat 自身也优先用 embedded Python
- `tests/test_shipin_cut_launcher.py`
  - 新增 `TestEmbeddedPython` 类，含 8 个测试覆盖：
    - `resolve_embedded_python` 安装版布局优先
    - 开发态布局兜底
    - 空目录返回 `None`
    - 部分布局（缺 `python.exe`）返回 `None`
    - `build_backend_env` 设置 `SHIPIN_CUT_DATA_ROOT` / `PYTHONPATH` / `PYTHONPYCACHEPREFIX`
    - `build_backend_env` 保留传入的 `PYTHONPATH`
    - `build_backend_env` 缺 `pyjianying_runtime` 时不挂空指针
    - `run_launcher` 优先 embedded Python
    - `run_launcher` 回退到 `sys.executable` 时仍然注入 `PYTHONPYCACHEPREFIX`
  - 扩展 `TestUserDataPaths.test_creates_writable_directories_outside_project_root` 校验 `paths["pycache"]`

## 10. 期间**没**改的

- `tools/local_export_server.py` —— **未改**。
- `tools/export_video.py` —— **未改**。
- `tools/export_with_jianying.py` —— **未改**。
- `tools/jianying_draft/export_with_pyjianying.py` —— **未改**。
- `installer/shipin-cut.iss` —— **未改**（3C-4 才纳入 runtime）。
- `src/App.jsx` / `src/App.css` —— **未改**。
- `installer/runtime/python/` —— **未改**（沿用 3C-2 POC 的 embeddable 3.11.9）。
- `installer/runtime/README.md` —— **本轮未改**（3C-4 一起更新）。
- 任何 `dist/` 资源 —— **未改**。

## 11. 下一步：3C-4 需要做什么

3C-4 = **把 `installer/runtime/python/` 纳入安装包**。具体动作：

1. **`installer/shipin-cut.iss`**：
   ```iss
   Source: "..\installer\runtime\python\*"; DestDir: "{app}\runtime\python"; \
       Excludes: "__pycache__\*,*.pyc"; \
       Flags: ignoreversion recursesubdirs createallsubdirs
   ```
   - 必须 Excludes `__pycache__` / `*.pyc`，因为这些应该每次现生成。
   - 主入口 `启动视频混剪工具.bat` 已经优先用 `{app}\runtime\python\python.exe`（3C-3 改的 bat），**装包自动生效**。
   - 不要硬塞进 `installer/dist/ShipinCutSetup.exe` 的构建流程之外的中间目录。

2. **`.gitignore`**：可选加 `installer/runtime/python/__pycache__/`（防止以后有人跑 POC 后误提交）。

3. **installer/runtime/README.md**：把“3C-2 POC 入口”改写为“3C-3 起，桌面图标 bat 自动使用此目录；3C-4 装进 `{app}\runtime\python\`”。

4. **`docs/阶段3C-Python运行时打包方案-20260620.md`**：在 §5 阶段拆分里把 3C-3 标 ✅。

5. **回归**：3C-5（干净机器测试）在 3C-4 装出来的安装版上跑。

3C-3 期间不动 `installer/shipin-cut.iss` 主流程，等 3C-4 单独一轮做。
