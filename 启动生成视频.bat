@echo off
chcp 65001 >nul
echo ============================================================
echo  shipin-cut v0.9  本地成品视频生成
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

echo 正在检查 FFmpeg...
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 找不到 FFmpeg，请先安装 FFmpeg 并加入 PATH
    echo 下载地址: https://ffmpeg.org/download.html
    echo 安装后请重启命令行再试
    pause
    exit /b 1
)

echo.
echo 开始生成视频...
echo.
python "%~dp0tools\export_video.py" %*
echo.
if %errorlevel% equ 0 (
    echo ============================================================
    echo  生成成功！请查看 export_workspace\output\ 目录
    echo ============================================================
) else (
    echo ============================================================
    echo  生成失败，请检查上方错误信息
    echo ============================================================
)
echo.
pause
