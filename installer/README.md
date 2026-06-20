# Inno Setup 安装包雏形

本目录对应阶段 3A，仅把现有 Windows 本地启动器包装为 Inno Setup 安装包雏形。

## 前置条件

1. Windows 10/11 x64。
2. 已安装 [Inno Setup 6](https://jrsoftware.org/isinfo.php)。
3. 当前项目源码完整。

## 编译

从项目根目录运行：

```bat
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

## 3A 边界

这个雏形安装前端源码、Python 后端脚本、启动器和必要文档，但不包含 `node_modules`、Python runtime、ffmpeg、whisper-cli、模型文件及本地 pyJianYingDraft 虚拟环境。因此它只适合已准备 Python、Node/npm 和项目依赖的开发/验收机器。

正式交付需要继续完成阶段 3B/3C，详见 `docs/安装包雏形说明-20260619.md`。
