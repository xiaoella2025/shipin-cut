# Inno Setup 安装包雏形

本目录对应阶段 3A + 3B。3A 把现有 Windows 本地启动器包装为 Inno Setup 安装包雏形；3B 在 3A 基础上把前端运行时从 Vite dev server 替换为后端托管的静态 `dist/`，安装版不再依赖 Node/npm。

## 前置条件

1. Windows 10/11 x64。
2. 已安装 [Inno Setup 6](https://jrsoftware.org/isinfo.php)。
3. 当前项目源码完整。
4. **构建安装包前必须先 `npm.cmd run build` 生成 `dist/`**；缺 `dist/` 时 `shipin-cut.iss` 仍能编译，但装出来的程序会因找不到前端文件而报"前端构建产物缺失"。

## 编译

从项目根目录运行：

```bat
npm.cmd run build
installer\build-installer.bat
```

构建脚本依次查找：

```text
C:\Program Files (x86)\Inno Setup 6\ISCC.exe
C:\Program Files\Inno Setup 6\ISCC.exe
PATH 中的 ISCC.exe
```

成功产物：

```text
installer\dist\ShipinCutSetup.exe
```

`installer/dist/` 已加入 Git 忽略规则，安装包二进制不提交仓库。

## 3B 边界（当前阶段）

安装包内容：

- `dist/` —— 由 `vite build` 生成，前端运行时。
- `package.json` / `src/` / `vite.config.js` —— 保留作为开发文档，运行时不读取。
- ~~`node_modules/`~~ —— **不再打包**（体积大头；安装版也不需要它）。
- `launcher/`、`tools/`、`tools/pyjianying_runtime/`、`tools/jianying_draft/`、`tools/whisper/`（可选）、`local-tools/ffmpeg/`（可选）等 Python 与媒体处理依赖。
- `启动视频混剪工具.bat` + 桌面 / 开始菜单快捷方式。

安装后运行链路：

1. 双击桌面"视频混剪工具" → `启动视频混剪工具.bat` → `python launcher\ShipinCutLauncher.py`。
2. 启动器检测 `{app}\dist\index.html`，进入静态前端模式，**不再启动 Vite dev、不再校验 Node/npm**。
3. 只启动 `tools\local_export_server.py`（Python 后端），监听 `http://127.0.0.1:8765/`。
4. 后端把 `dist/` 暴露在 `http://127.0.0.1:8765/shipin-cut/` 下，包括 SPA fallback。
5. 浏览器自动打开该地址，**不再占用 5173 端口，也不再出现 node.exe**。

正式交付还需要继续完成阶段 3C（内置 Python runtime 等），详见 `docs/安装包雏形说明-20260619.md`。
