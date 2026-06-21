@echo off
REM ============================================================
REM 3C-2 POC: 用内置 embeddable Python 启动后端
REM ------------------------------------------------------------
REM 本脚本只用于 POC 验证，不替换正式启动器：
REM   * 不修改桌面图标
REM   * 不修改 installer/shipin-cut.iss 的主流程
REM   * 不修改 启动视频混剪工具.bat
REM
REM 行为：
REM   1. 强制调用 installer\runtime\python\python.exe，不使用系统 PATH 的 python
REM   2. 把仓库根目录（脚本所在目录的祖父级）反推出来
REM   3. 设置 SHIPIN_CUT_DATA_ROOT 指向 %LOCALAPPDATA%\ShipinCut
REM   4. 启动 tools\local_export_server.py，监听 127.0.0.1:8765
REM   5. 前端页面： http://127.0.0.1:8765/shipin-cut/
REM ============================================================

setlocal
chcp 65001 >nul
set "SCRIPT_DIR=%~dp0"
REM installer\runtime\run_server_embedded.bat → 仓库根 = %SCRIPT_DIR%..\..
set "REPO_ROOT=%SCRIPT_DIR%..\.."
set "EMBED_PY=%SCRIPT_DIR%python\python.exe"
set "SERVER_SCRIPT=%REPO_ROOT%\tools\local_export_server.py"
set "LOCALAPPDATA_DIR=%LOCALAPPDATA%\ShipinCut"

if not exist "%EMBED_PY%" (
    echo [错误] 找不到内置 Python: %EMBED_PY%
    echo        请先在 installer\runtime\python\ 下放 embeddable Python 3.11.x
    exit /b 1
)

if not exist "%SERVER_SCRIPT%" (
    echo [错误] 找不到后端脚本: %SERVER_SCRIPT%
    exit /b 1
)

if not defined LOCALAPPDATA (
    set "LOCALAPPDATA=%USERPROFILE%\AppData\Local"
)
if not exist "%LOCALAPPDATA_DIR%" (
    mkdir "%LOCALAPPDATA_DIR%"
)

echo ============================================================
echo  3C-2 POC: 内置 Python 启动后端
echo  解释器:  %EMBED_PY%
echo  后端:    %SERVER_SCRIPT%
echo  数据根:  %LOCALAPPDATA_DIR%
echo  健康:    http://127.0.0.1:8765/health
echo  前端:    http://127.0.0.1:8765/shipin-cut/
echo ============================================================
echo.

cd /d "%REPO_ROOT%"
set "SHIPIN_CUT_DATA_ROOT=%LOCALAPPDATA_DIR%"

REM 3C-2 POC: 把 __pycache__ 全部重定向到用户可写目录，避免在
REM %app% 下的 tools\pyjianying_runtime\*\__pycache__\ 写入。
REM 这是 Program Files 只读约束的必要条件。
set "PYTHONPYCACHEPREFIX=%LOCALAPPDATA_DIR%\cache\pycache"
if not exist "%PYTHONPYCACHEPREFIX%" mkdir "%PYTHONPYCACHEPREFIX%"

"%EMBED_PY%" "%SERVER_SCRIPT%"
endlocal
