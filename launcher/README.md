# ShipinCut Launcher

阶段 2 的 Windows 本地启动器原型。正式使用说明见：

`docs/本地启动器说明-20260618.md`

开发环境运行：

```powershell
python launcher/ShipinCutLauncher.py
```

普通用户入口：项目根目录的 `启动视频混剪工具.bat`。

本目录后续可作为 PyInstaller 输入，阶段 3 的 Inno Setup 桌面快捷方式将指向打包后的启动器。
