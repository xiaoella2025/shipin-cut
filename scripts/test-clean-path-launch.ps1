<#
test-clean-path-launch.ps1
==========================

3C-5A 验收脚本：在 PATH 强隔离环境下启动安装版（默认
C:\ShipinCutCleanTest），验证安装版不依赖系统 Python / Node /
ffmpeg / whisper。

设计目标：

1. 只在当前 PowerShell 进程里修改 PATH，**绝不**改用户或系统环境变量。
2. PATH 缩到 Windows 基础目录（C:\Windows\System32 + C:\Windows +
   C:\Windows\System32\Wbem + C:\Windows\System32\WindowsPowerShell\v1.0）。
3. 启动后端前断言系统级工具（python / node / ffmpeg / ffprobe /
   whisper-cli / npm）都 `where` 不到。
4. 用 `{app}\runtime\python\python.exe` 的绝对路径直接调 launcher，
   绕开 bat（避免 cmd.exe 在 PATH 受限时再去找 python）。
5. 全部断言通过后 echo "ALL CHECKS PASSED"，任何失败 echo
   "FAILED: <step>" 并 exit 1。

跑法（在仓库根 powershell）：

    powershell -ExecutionPolicy Bypass -File scripts\test-clean-path-launch.ps1
    powershell -ExecutionPolicy Bypass -File scripts\test-clean-path-launch.ps1 -InstallDir 'C:\ShipinCutCleanTest'
#>

[CmdletBinding()]
param(
    [string]$InstallDir = 'C:\ShipinCutCleanTest',
    [string]$BasePath = 'C:\Windows\System32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0',
    [int]$HealthTimeoutSec = 20,
    [int]$TranscribeTimeoutSec = 180,
    [int]$JianyingTimeoutSec = 60,
    [switch]$SkipHeavy = $false
)

$ErrorActionPreference = 'Stop'
$ErrorActionPreference = 'Continue'  # 让我们用 try/catch 控

$failed = $false
function Step($name, $block) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
    try {
        & $block
        Write-Host "  [OK] $name" -ForegroundColor Green
    } catch {
        Write-Host "  [FAIL] $name : $_" -ForegroundColor Red
        $script:failed = $true
    }
}

function WhereEmpty($tool) {
    $r = & "$env:SystemRoot\System32\where.exe" $tool 2>$null
    return ($LASTEXITCODE -ne 0) -or ($null -eq $r) -or ($r.Count -eq 0)
}

# --- 0. 准备：把 InstallDir 标准化 ---
$InstallDir = $InstallDir.TrimEnd('\', '/')
$pythonExe  = Join-Path $InstallDir 'runtime\python\python.exe'
$launcherPy = Join-Path $InstallDir 'launcher\ShipinCutLauncher.py'
$logFile    = Join-Path $env:LOCALAPPDATA 'ShipinCut\logs\launcher\launcher_3c5a_isolated.log'

Step 'Pre-check: install layout exists' {
    foreach ($p in @($pythonExe, $launcherPy,
                     (Join-Path $InstallDir 'tools\whisper\whisper-cli.exe'),
                     (Join-Path $InstallDir 'tools\whisper\models\ggml-base.bin'),
                     (Join-Path $InstallDir 'local-tools\ffmpeg\ffmpeg.exe'),
                     (Join-Path $InstallDir 'local-tools\ffmpeg\ffprobe.exe'),
                     (Join-Path $InstallDir 'dist\index.html'))) {
        if (-not (Test-Path -LiteralPath $p)) {
            throw "missing: $p"
        }
    }
    Write-Host "  install dir=$InstallDir"
    Write-Host "  pythonExe=$pythonExe"
}

# --- 1. 隔离 PATH ---
$originalPath = $env:PATH
$env:PATH = $BasePath
Write-Host ""
Write-Host "=== PATH ISOLATION ===" -ForegroundColor Cyan
Write-Host "  original PATH length: $($originalPath.Length)"
Write-Host "  isolated PATH:        $env:PATH"

# 还要清掉 PATHEXT 的可执行后缀（防止 PowerShell 默认关联到系统 Python）
# 实际上 PATHEXT 只影响 cmd 的命令查找，不影响 where.exe 的命中，跳过。

# --- 2. 验证 where 工具都找不到 ---
Step 'where python is empty' {
    if (-not (WhereEmpty 'python')) {
        throw "system python is still on PATH after isolation"
    }
}
Step 'where py is empty' {
    if (-not (WhereEmpty 'py')) {
        throw "py launcher is still on PATH after isolation"
    }
}
Step 'where node is empty' {
    if (-not (WhereEmpty 'node')) {
        throw "node is still on PATH after isolation"
    }
}
Step 'where npm is empty' {
    if (-not (WhereEmpty 'npm')) {
        throw "npm is still on PATH after isolation"
    }
}
Step 'where ffmpeg is empty' {
    if (-not (WhereEmpty 'ffmpeg')) {
        throw "ffmpeg is still on PATH after isolation"
    }
}
Step 'where ffprobe is empty' {
    if (-not (WhereEmpty 'ffprobe')) {
        throw "ffprobe is still on PATH after isolation"
    }
}
Step 'where whisper-cli is empty' {
    if (-not (WhereEmpty 'whisper-cli')) {
        throw "whisper-cli is still on PATH after isolation"
    }
}
Step 'where pip is empty (sanity)' {
    if (-not (WhereEmpty 'pip')) {
        throw "pip is still on PATH after isolation"
    }
}

# --- 3. 验证 embedded python 自己能找到自己 ---
Step 'embedded python --version' {
    $out = & $pythonExe --version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "embedded python exit $LASTEXITCODE" }
    Write-Host "  $out"
}

Step 'embedded python sys.executable + version' {
    $out = & $pythonExe -c "import sys,platform; print('exe=',sys.executable); print('ver=',sys.version); print('machine=',platform.machine())" 2>&1
    Write-Host ($out -join "`n  ")
    if (-not ($out -join "`n" -match '3\.11\.9')) {
        throw "embedded python did not report 3.11.9"
    }
    if (-not ($out -join "`n" -match [regex]::Escape($pythonExe))) {
        throw "embedded python sys.executable does not match $pythonExe"
    }
}

# --- 4. 启动 launcher（embedded python 直接调 launcher，绕开 bat）---
Step 'launch launcher with embedded python' {
    $pycacheDir = Join-Path $env:LOCALAPPDATA 'ShipinCut\cache\pycache'
    if (-not (Test-Path $pycacheDir)) { New-Item -ItemType Directory -Force -Path $pycacheDir | Out-Null }
    $env:PYTHONPYCACHEPREFIX = $pycacheDir
    $env:SHIPIN_CUT_DATA_ROOT = Join-Path $env:LOCALAPPDATA 'ShipinCut'
    Write-Host "  PYTHONPYCACHEPREFIX=$env:PYTHONPYCACHEPREFIX"
    Write-Host "  SHIPIN_CUT_DATA_ROOT=$env:SHIPIN_CUT_DATA_ROOT"

    # 写一个一次性 helper bat（绕开 PowerShell Start-Process 的 ArgumentList 编码问题）。
    Write-Host "  before assignment: helperBatPath=$([string]::IsNullOrEmpty($helperBatPath))"
    $helperBatPath = "C:\ShipinCutCleanTest\_3c5a_launcher.bat"
    Write-Host "  after assignment: helperBatPath=$([string]::IsNullOrEmpty($helperBatPath)) len=$($helperBatPath.Length)"
    $pyEsc        = $pythonExe -replace '/', '\'
    $launcherEsc  = $launcherPy -replace '/', '\'
    $logEsc       = $logFile -replace '/', '\'
    $batBody      = "@echo off`r`n`"$pyEsc`" `"$launcherEsc`" --no-browser > `"$logEsc`" 2>&1`r`n"
    Write-Host "  helper bat path: [$helperBatPath]"
    Write-Host "  helper bat body: $batBody"
    if (-not (Test-Path $InstallDir)) { throw "InstallDir does not exist: $InstallDir" }
    try {
        [System.IO.File]::WriteAllText($helperBatPath, $batBody, [System.Text.Encoding]::Default)
    } catch {
        throw "WriteAllText failed: $($_.Exception.Message) | path=[$helperBatPath] | dir=$([System.IO.Directory]::Exists($InstallDir))"
    }
    if (-not (Test-Path $helperBatPath)) { throw "helper bat was not created" }
    Write-Host "  helper bat written OK"

    $proc = Start-Process -FilePath $helperBatPath -WorkingDirectory $InstallDir -PassThru -WindowStyle Hidden
    Write-Host "  helper bat PID=$($proc.Id)"
    Start-Sleep -Milliseconds 500
    # helper bat 立刻 spawn embedded python 后退出；新进程是 embedded python
    $pythonProcs = @(Get-Process -Name 'python' -ErrorAction SilentlyContinue)
    $pythonProc = $pythonProcs | Where-Object { $_.Path -eq $pythonExe } | Select-Object -First 1
    if (-not $pythonProc) {
        # 可能 helper 还没 spawn python；再等一下
        Start-Sleep -Milliseconds 1500
        $pythonProcs = @(Get-Process -Name 'python' -ErrorAction SilentlyContinue)
        $pythonProc = $pythonProcs | Where-Object { $_.Path -eq $pythonExe } | Select-Object -First 1
    }
    if (-not $pythonProc) {
        $allP = ($pythonProcs | ForEach-Object { "$($_.Id) $($_.Path)" }) -join "; "
        throw "embedded python did not start (existing python procs: $allP)"
    }
    Write-Host "  embedded python PID=$($pythonProc.Id) exe=$($pythonProc.Path)"
    $script:launcherPid = $pythonProc.Id
}

# --- 5. 等 /health ---
Step 'wait for /health' {
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
    $ok = $false
    $serverHeader = ''
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            $serverHeader = $resp.Headers['Server'] -join '; '
            if ($resp.StatusCode -eq 200) { $ok = $true; break }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    if (-not $ok) { throw "/health did not return 200 within $HealthTimeoutSec s" }
    Write-Host "  /health 200; Server header: $serverHeader"
    if ($serverHeader -notmatch 'Python/3\.11\.9') {
        throw "Server header does not contain Python/3.11.9 (got '$serverHeader')"
    }
}

# --- 6. /health 内容核对：whisper / ffmpeg 路径都指向安装目录 ---
Step '/health body references install dir' {
    $body = (Invoke-WebRequest -Uri 'http://127.0.0.1:8765/health' -UseBasicParsing).Content
    # JSON escapes backslashes; accept either single or double backslashes in path.
    $InstallDirRegex = [regex]::Escape($InstallDir) -replace '\\\\', '\\{1,2}'
    if ($body -notmatch $InstallDirRegex) { throw "health body does not reference $InstallDir (body snippet: $($body.Substring(0, [Math]::Min(200, $body.Length))))" }
    if ($body -notmatch 'whisper-cli\.exe') { throw "health body does not reference whisper-cli.exe" }
    if ($body -notmatch 'ffmpeg\.exe') { throw "health body does not reference ffmpeg.exe" }
    Write-Host "  health body references $InstallDir (whisper-cli.exe + ffmpeg.exe)"
}

# --- 7. /shipin-cut/ 页面 ---
Step '/shipin-cut/ serves HTML' {
    $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/shipin-cut/' -UseBasicParsing -TimeoutSec 5
    if ($resp.StatusCode -ne 200) { throw "shipin-cut/ status $($resp.StatusCode)" }
    if ($resp.Content -notmatch '<!DOCTYPE html>') { throw "shipin-cut/ body is not HTML" }
    Write-Host "  /shipin-cut/ returns 200 + <!DOCTYPE html>"
}

# --- 8. 5173 / node.exe ---
Step 'port 5173 is empty' {
    $r = & "$env:SystemRoot\System32\netstat.exe" -ano | Select-String ':5173\s'
    if ($r) { throw "5173 is in use: $r" }
    Write-Host "  5173 not bound"
}
Step 'node.exe is not running' {
    $nodeProcs = Get-Process -Name 'node' -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        throw "node.exe is running: $($nodeProcs | Out-String)"
    }
    Write-Host "  no node.exe process (via Get-Process)"
}

if (-not $SkipHeavy) {
    # --- 9. 字幕识别 ---
    Step 'transcribe-video' {
        # 找一个真实的 video
        $videosDir = Join-Path $env:LOCALAPPDATA 'ShipinCut\workspace\videos'
        $video = Get-ChildItem -LiteralPath $videosDir -Filter '*.mp4' -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if (-not $video) { throw "no mp4 in $videosDir (skip heavy or seed a video first)" }
        $bodyObj = @{ storedFile = $video.Name; language = 'zh' }
        $body = $bodyObj | ConvertTo-Json -Compress
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/transcribe-video' `
            -Method POST -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
            -UseBasicParsing -TimeoutSec $TranscribeTimeoutSec
        if ($resp.StatusCode -ne 200) { throw "transcribe-video status $($resp.StatusCode): $($resp.Content)" }
        $j = $resp.Content | ConvertFrom-Json
        if (-not $j.ok) { throw "transcribe-video ok=false: $($j.error)" }
        if ($j.count -lt 1) { throw "transcribe-video returned 0 segments" }
        Write-Host "  transcribe ok=true, segments=$($j.count)"
    }

    # --- 10. 导出剪映草稿 ---
    Step 'export-jianying' {
        $videosDir = Join-Path $env:LOCALAPPDATA 'ShipinCut\workspace\videos'
        $video = Get-ChildItem -LiteralPath $videosDir -Filter '*.mp4' -ErrorAction SilentlyContinue |
                 Select-Object -First 1
        if (-not $video) { throw "no mp4 in $videosDir" }
        $mp4Abs = $video.FullName
        $draftName = "POC3C5A_$(Get-Date -Format 'HHmmss')"
        $srt = "1`n00:00:00,000 --> 00:00:03,000`n3C-5A subtitle 1`n`n2`n00:00:03,000 --> 00:00:06,000`n3C-5A subtitle 2`n"
        $bodyObj = @{
            name            = $draftName
            mp4             = $mp4Abs
            subtitleContent = $srt
        }
        $body = $bodyObj | ConvertTo-Json -Compress
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:8765/export-jianying' `
            -Method POST -ContentType 'application/json; charset=utf-8' `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
            -UseBasicParsing -TimeoutSec $JianyingTimeoutSec
        if ($resp.StatusCode -ne 200) { throw "export-jianying status $($resp.StatusCode): $($resp.Content)" }
        $j = $resp.Content | ConvertFrom-Json
        if (-not $j.ok) { throw "export-jianying ok=false: $($j.error)" }
        $finalStatus = $j.debug.finalStatus
        if ($finalStatus -ne 'success') {
            throw "export-jianying finalStatus='$finalStatus' error='$($j.error)' debug=$($j.debug | ConvertTo-Json -Depth 4 -Compress)"
        }
        Write-Host "  jianying export success: draftName=$($j.draftName)"
        Write-Host "  draftPath=$($j.draftPath)"

        # 草稿目录文件核对
        $draftDir = $j.draftPath
        foreach ($f in @('draft_content.json', 'draft_meta_info.json', 'draft_settings', 'timeline_layout.json')) {
            $p = Join-Path $draftDir $f
            if (-not (Test-Path -LiteralPath $p)) { throw "missing draft file: $p" }
        }
        Write-Host "  all 4 draft files present in $draftDir"
    }
} else {
    Write-Host ""
    Write-Host "=== heavy checks skipped (-SkipHeavy) ===" -ForegroundColor Yellow
}

# --- 10b. 安装目录仍然干净（无运行时 __pycache__ / .pyc）---
Step 'install dir has no runtime __pycache__ or .pyc' {
    $pycache = Get-ChildItem -LiteralPath $InstallDir -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue
    $pyc     = Get-ChildItem -LiteralPath $InstallDir -Recurse -File -Filter '*.pyc' -ErrorAction SilentlyContinue
    if ($pycache) {
        # 列出它们以便诊断
        $names = ($pycache | ForEach-Object { $_.FullName }) -join "; "
        throw "install dir has __pycache__ dirs at runtime: $names"
    }
    if ($pyc) {
        $names = ($pyc | ForEach-Object { $_.FullName }) -join "; "
        throw "install dir has .pyc files at runtime: $names"
    }
    Write-Host "  install dir clean (no __pycache__, no *.pyc)"
}

Step 'local app data pycache has .pyc files' {
    $pyc = Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'ShipinCut\cache\pycache') -Recurse -File -Filter '*.pyc' -ErrorAction SilentlyContinue
    if (-not $pyc -or $pyc.Count -lt 1) { throw "no .pyc files in LocalAppData\ShipinCut\cache\pycache" }
    Write-Host "  $($pyc.Count) .pyc files in LocalAppData\ShipinCut\cache\pycache"
}

Step 'install dir has no runtime logs / config / cache / workspace' {
    foreach ($sub in @('logs', 'config', 'cache', 'workspace', 'export_workspace', 'tmp', 'temp')) {
        $p = Join-Path $InstallDir $sub
        if (Test-Path -LiteralPath $p) { throw "install dir has unexpected ${sub}: $p" }
    }
    Write-Host "  install dir has no logs/ config/ cache/ workspace/ export_workspace/ tmp/ temp/"
}

# --- 11. 收尾 ---
Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
$env:PATH = $originalPath
Write-Host "  PATH restored to system default."

if ($failed) {
    Write-Host ""
    Write-Host "FAILED: at least one step did not pass. See above." -ForegroundColor Red
    exit 1
} else {
    Write-Host ""
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    exit 0
}
