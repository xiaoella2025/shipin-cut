@echo off
chcp 65001 >nul
echo ============================================================
echo  shipin-cut v0.9.1  本地导出服务
echo ============================================================
echo.
echo 正在检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 找不到 Python，请先安装 Python 3.8 或更高版本
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo Python 检测通过。
echo.
echo 启动本地导出服务...
echo 服务地址: http://127.0.0.1:8765
echo.
echo ► 请回到网页，进入导出准备页，点击「导出成品视频」
echo ► 关闭此窗口将停止服务
echo.
python "%~dp0tools\local_export_server.py"
echo.
pause
