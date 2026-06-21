# installer/runtime — embeddable Python POC (阶段 3C-2)

本目录是 **3C-2 POC 入口**，不替换正式启动器，仅用于验证“内置 Python 跑后端”这条路是否可行。

## 文件清单

| 文件 / 目录 | 用途 |
|---|---|
| `python/` | embeddable Python 3.11.9 64-bit（POC 选用版本） |
| `python/python311._pth` | 启用 `import site` + 把 `tools\pyjianying_runtime` 加进 `sys.path` |
| `run_server_embedded.bat` | POC 启动脚本，强制调内置 `python.exe` 跑 `local_export_server.py` |

## 为什么是 3.11.9

- 3.11 是 pyJianYingDraft / pymediainfo / uiautomation / comtypes 全部官方支持的稳定版本（详见 `docs/阶段3C-1-Python依赖清单审计-20260620.md` 第 11 节）。
- 3.11 embeddable zip 在 python.org 长期可下载；3.14 没有 embeddable 包。
- 3.11.9 是写本 POC 时点 3.11 系列的稳定小版本。

> 后续如要升级，建议在 3.11.x 范围内升级到 3.11.13 / 3.11.14；不要直接跳到 3.12 / 3.13 / 3.14，除非重新做一次 vendored 包兼容性验证。

## 下载来源（如需手动准备）

```text
https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip
```

直接解压到 `installer/runtime/python/` 即可。`python311._pth` 由本目录 README 配套说明维护。

## python311._pth 关键配置

POC 当前内容（`installer/runtime/python/python311._pth`）：

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

1. `python311.zip` 和 `.` 是 embeddable 默认项，保留。
2. `import site` 取消注释，让 embedded Python 走 site-packages 查找路径。
3. `..\..\..\tools\pyjianying_runtime` 是相对路径（基于 `_pth` 所在目录），等价于绝对路径 `F:\shipin-cut\tools\pyjianying_runtime`。
4. 3C-3 启动器兼容层落地后，启动器可以再追加 `PYTHONPATH=tools\pyjianying_runtime` 作为双重保险（与 `_pth` 路径并存，不冲突）。

## 怎么用（POC）

```bat
installer\runtime\run_server_embedded.bat
```

启动后：

- 控制台会打印解释器路径、后端脚本路径、数据根目录、健康检查地址、前端页面地址。
- 浏览器打开 `http://127.0.0.1:8765/shipin-cut/` 即可。
- `/health` 端点：`http://127.0.0.1:8765/health`。

## POC 验收标准

详见 `docs/阶段3C-2-EmbeddablePython-POC-20260620.md`（与本目录同步新增）。

## 本目录不替换的主入口

- `启动视频混剪工具.bat`（仓库根 / 桌面图标入口）—— **不动**。
- `installer/shipin-cut.iss` 的 `[Files]` 列表 —— **3C-2 期间不动**；3C-4 阶段才会把 `installer/runtime/python/` 加进安装包。
- `launcher/ShipinCutLauncher.py` —— **3C-2 期间不动**；3C-3 阶段才会让 launcher 优先选 `{app}\runtime\python\python.exe`。

## 已知限制（POC 范围）

- 不支持升级：替换 `python/` 目录后 `_pth` 也可能需要重写。
- pip 没启用（embeddable 默认无 pip），如需补 pip，单独走 `get-pip.py` + 修改 `_pth`。
- `python.exe` 是 MS Windows 控制台程序，启动时会有一个 console 窗口。3C-3 阶段可考虑用 `pythonw.exe`（无 console），但本 POC 仍用 `python.exe` 方便排错。
