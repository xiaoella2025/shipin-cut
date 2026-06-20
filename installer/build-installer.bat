@echo off
chcp 65001 >nul
setlocal

set "ROOT=%~dp0.."
set "ISCC="

if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 6\ISCC.exe"

if not defined ISCC (
    for %%I in (ISCC.exe) do set "ISCC=%%~$PATH:I"
)

if not defined ISCC (
    echo [错误] 未找到 Inno Setup，请先安装 Inno Setup 6。
    echo 下载后重新运行 installer\build-installer.bat。
    exit /b 1
)

cd /d "%ROOT%"
echo 正在使用：%ISCC%
echo 正在编译安装包...
"%ISCC%" "installer\shipin-cut.iss"
if errorlevel 1 (
    echo [错误] 安装包编译失败，请检查上方 Inno Setup 输出。
    exit /b 1
)

echo.
echo [成功] 安装包已生成：
echo %ROOT%\installer\dist\ShipinCutSetup.exe
exit /b 0
