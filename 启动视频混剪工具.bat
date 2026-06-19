@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ============================================================
echo  视频混剪工具 - 本地启动器
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 goto :try_py
python "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:try_py
py -3 --version >nul 2>&1
if errorlevel 1 goto :no_python
py -3 "%~dp0launcher\ShipinCutLauncher.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :done

:no_python
echo [错误] 未检测到 Python，请联系管理员安装运行环境。
pause
exit /b 1

:done
if "%EXIT_CODE%"=="0" exit /b 0
echo.
echo 启动失败，请查看 logs\launcher 下的日志，或联系管理员。
pause
exit /b %EXIT_CODE%
