@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo  视频混剪工具 - 本地启动器
echo ============================================================
echo.

REM v0.9.14 (3C-3): 优先使用项目内置 Python。
REM 安装版布局：%~dp0\runtime\python\python.exe
REM 开发态布局：%~dp0\installer\runtime\python\python.exe
REM 内置 Python 命中后，launcher 会优先用它跑后端，
REM 同时把 PYTHONPATH / PYTHONPYCACHEPREFIX 注入后端。

if exist "%~dp0runtime\python\python.exe" goto :use_embedded
if exist "%~dp0installer\runtime\python\python.exe" goto :use_embedded_dev

python --version >nul 2>&1
if errorlevel 1 goto :try_py
echo [启动器] 未发现内置 Python，回退到系统 python。
python "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:try_py
py -3 --version >nul 2>&1
if errorlevel 1 goto :no_python
echo [启动器] 未发现内置 Python，回退到 py -3。
py -3 "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:use_embedded
echo [启动器] 使用内置 Python：%~dp0runtime\python\python.exe
"%~dp0runtime\python\python.exe" "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:use_embedded_dev
echo [启动器] 使用内置 Python：%~dp0installer\runtime\python\python.exe
"%~dp0installer\runtime\python\python.exe" "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:no_python
echo [错误] 未检测到 Python，请联系管理员安装运行环境。
pause
exit /b 1

:done
if "%EXIT_CODE%"=="0" exit /b 0
echo.
echo 启动失败，请查看 %LOCALAPPDATA%\ShipinCut\logs\launcher 下的日志，或联系管理员。
pause
exit /b %EXIT_CODE%
