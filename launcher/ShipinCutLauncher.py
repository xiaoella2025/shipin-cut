#!/usr/bin/env python3
"""Windows launcher prototype for the shipin-cut local development runtime."""

from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Mapping


BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8765
FRONTEND_HOST = "127.0.0.1"
FRONTEND_PORT = 5173
BACKEND_HEALTH_URL = f"http://{BACKEND_HOST}:{BACKEND_PORT}/health"
FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}/shipin-cut/"
BACKEND_SERVICE_ID = "shipin-cut-local-export"
START_TIMEOUT_SECONDS = 30


def configure_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure:
            reconfigure(encoding="utf-8", errors="replace")


def launcher_anchor() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent


def resolve_project_root(anchor: Path | None = None) -> Path:
    """Resolve APP_ROOT from the launcher location, never from a fixed drive."""
    anchor = (anchor or launcher_anchor()).resolve()
    candidates = [anchor.parent, anchor, anchor.parent.parent]
    for candidate in candidates:
        if (candidate / "package.json").is_file() and (
            candidate / "tools" / "local_export_server.py"
        ).is_file():
            return candidate
    raise RuntimeError("无法从启动器位置找到项目根目录，请确认程序文件完整。")


def resolve_user_data_root(environ: Mapping[str, str] | None = None) -> Path:
    """Resolve the per-user writable root independently of the install directory."""
    environ = environ or os.environ
    local_app_data = environ.get("LOCALAPPDATA")
    if not local_app_data:
        local_app_data = str(Path.home() / "AppData" / "Local")
    return Path(local_app_data).expanduser().resolve() / "ShipinCut"


def ensure_user_data_dirs(user_data_root: Path) -> dict[str, Path]:
    paths = {
        "launcher_logs": user_data_root / "logs" / "launcher",
        "runtime": user_data_root / "runtime",
        "config": user_data_root / "config",
        "cache": user_data_root / "cache",
    }
    for path in paths.values():
        path.mkdir(parents=True, exist_ok=True)
    return paths


def prepare_runtime_vite_config(runtime_dir: Path, cache_dir: Path, project_root: Path) -> Path:
    """Generate the runtime Vite config.

    The config is written to the writable user-data runtime dir rather than the
    read-only install location, so that ``cacheDir`` can be redirected there.
    We still need the React plugin (and any other plugins) declared in the
    project's ``vite.config.js`` — without it, App.jsx transforms to
    ``React.createElement(...)`` calls but only imports the named hooks, and the
    browser hits ``ReferenceError: React is not defined`` and renders blank.
    Importing the original config via a ``file://`` URL preserves those plugins.
    """
    cache_dir.mkdir(parents=True, exist_ok=True)
    config_path = runtime_dir / "vite.config.mjs"
    cache_value = json.dumps(cache_dir.as_posix(), ensure_ascii=False)
    source_config_url = (project_root / "vite.config.js").as_uri()
    config_path.write_text(
        f"import baseConfig from {json.dumps(source_config_url)}\n"
        "export default {\n"
        "  ...baseConfig,\n"
        "  base: '/shipin-cut/',\n"
        f"  cacheDir: {cache_value},\n"
        "}\n",
        encoding="utf-8",
    )
    return config_path


def setup_logging(log_dir: Path) -> tuple[logging.Logger, Path]:
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"launcher_{datetime.now():%Y%m%d}.log"

    logger = logging.getLogger("shipin_cut_launcher")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setFormatter(formatter)
    logger.addHandler(console)
    logger.addHandler(file_handler)
    return logger, log_path


def port_is_open(host: str, port: int, timeout: float = 0.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def fetch_url(url: str, timeout: float = 2.0) -> tuple[int, bytes, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "ShipinCutLauncher/0.1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read(), response.headers.get("Content-Type", "")


def backend_state() -> str:
    """Return stopped, shipin-cut, or occupied."""
    if not port_is_open(BACKEND_HOST, BACKEND_PORT):
        return "stopped"
    try:
        status, body, _ = fetch_url(BACKEND_HEALTH_URL)
        payload = json.loads(body.decode("utf-8"))
        if status == 200 and payload.get("service") == BACKEND_SERVICE_ID:
            return "shipin-cut"
    except (OSError, ValueError, UnicodeDecodeError, urllib.error.URLError):
        pass
    return "occupied"


def frontend_state() -> str:
    """Return stopped, shipin-cut, or occupied."""
    if not port_is_open(FRONTEND_HOST, FRONTEND_PORT):
        return "stopped"
    try:
        status, body, content_type = fetch_url(FRONTEND_URL)
        html = body.decode("utf-8", errors="replace")
        if status == 200 and "text/html" in content_type and "视频混剪工具" in html:
            return "shipin-cut"
    except (OSError, UnicodeDecodeError, urllib.error.URLError):
        pass
    return "occupied"


def find_npm() -> str | None:
    return shutil.which("npm.cmd") or shutil.which("npm")


def verify_python() -> bool:
    try:
        result = subprocess.run(
            [sys.executable, "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            check=False,
        )
        return result.returncode == 0
    except (OSError, subprocess.SubprocessError):
        return False


class SingleInstanceLock:
    def __init__(self, path: Path):
        self.path = path
        self.handle = None

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.handle = self.path.open("a+b")
        if self.path.stat().st_size == 0:
            self.handle.write(b"0")
            self.handle.flush()
        self.handle.seek(0)
        try:
            import msvcrt

            msvcrt.locking(self.handle.fileno(), msvcrt.LK_NBLCK, 1)
            return True
        except (ImportError, OSError):
            self.handle.close()
            self.handle = None
            return False

    def release(self) -> None:
        if not self.handle:
            return
        try:
            import msvcrt

            self.handle.seek(0)
            msvcrt.locking(self.handle.fileno(), msvcrt.LK_UNLCK, 1)
        except (ImportError, OSError):
            pass
        self.handle.close()
        self.handle = None


def wait_for_state(checker, expected: str, timeout: int, process=None) -> bool:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if checker() == expected:
            return True
        if process is not None and process.poll() is not None:
            return False
        time.sleep(0.5)
    return False


def start_process(
    command: list[str], cwd: Path, log_handle, env: Mapping[str, str] | None = None
) -> subprocess.Popen:
    flags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    return subprocess.Popen(
        command,
        cwd=str(cwd),
        stdin=subprocess.DEVNULL,
        stdout=log_handle,
        stderr=subprocess.STDOUT,
        creationflags=flags,
        env=env,
    )


def stop_owned_process(process: subprocess.Popen, logger: logging.Logger, label: str) -> None:
    if process.poll() is not None:
        return
    logger.info("正在停止本启动器拉起的%s（PID %s）", label, process.pid)
    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def write_runtime_state(path: Path, processes: dict[str, subprocess.Popen]) -> None:
    payload = {
        "launcherPid": os.getpid(),
        "startedAt": datetime.now().isoformat(timespec="seconds"),
        "processes": {name: process.pid for name, process in processes.items()},
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def wait_for_existing_launcher(logger: logging.Logger, no_browser: bool) -> int:
    logger.info("检测到视频混剪工具正在启动或运行，将复用现有服务。")
    deadline = time.monotonic() + START_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        if backend_state() == "shipin-cut" and frontend_state() == "shipin-cut":
            if not no_browser:
                webbrowser.open(FRONTEND_URL)
            logger.info("服务已运行，浏览器页面已打开。")
            return 0
        time.sleep(0.5)
    logger.error("已有启动器正在运行，但服务尚未就绪。请稍后重试。")
    return 1


def run_launcher(no_browser: bool = False) -> int:
    configure_console()
    try:
        project_root = resolve_project_root()
    except RuntimeError as exc:
        print(f"[错误] {exc}")
        return 1

    try:
        user_data_root = resolve_user_data_root()
        user_paths = ensure_user_data_dirs(user_data_root)
        vite_config_path = prepare_runtime_vite_config(
            user_paths["runtime"], user_paths["cache"] / "vite", project_root
        )
        logger, log_path = setup_logging(user_paths["launcher_logs"])
    except OSError as exc:
        print(f"[错误] 无法创建用户数据目录：{exc}")
        return 1

    logger.info("正在启动视频混剪工具")
    logger.info("项目根目录：%s", project_root)
    logger.info("用户数据目录：%s", user_data_root)
    logger.info("启动日志：%s", log_path)

    lock = SingleInstanceLock(user_paths["runtime"] / "launcher.lock")
    if not lock.acquire():
        return wait_for_existing_launcher(logger, no_browser)

    owned: dict[str, subprocess.Popen] = {}
    runtime_path = user_paths["runtime"] / "runtime.json"
    child_log_path = user_paths["launcher_logs"] / f"services_{datetime.now():%Y%m%d}.log"
    child_log = None

    try:
        if not verify_python():
            logger.error("未检测到 Python，请联系管理员安装运行环境。")
            return 1

        npm = find_npm()
        if not npm:
            logger.error("未检测到 Node / npm，请联系管理员安装运行环境。")
            return 1
        if not (project_root / "node_modules").is_dir():
            logger.error("首次启动需要安装前端依赖，请联系管理员。")
            return 1

        backend = backend_state()
        if backend == "occupied":
            logger.error("8765 端口被其他程序占用，请关闭占用该端口的程序后重试。")
            return 1

        frontend = frontend_state()
        if frontend == "occupied":
            logger.error("5173 端口被其他程序占用，请关闭占用该端口的程序后重试。")
            return 1

        child_log = child_log_path.open("a", encoding="utf-8", buffering=1)

        if backend == "shipin-cut":
            logger.info("检测到本地服务已运行，复用 8765 端口。")
        else:
            logger.info("正在启动本地服务")
            process = start_process(
                [sys.executable, str(project_root / "tools" / "local_export_server.py")],
                project_root,
                child_log,
                dict(os.environ, SHIPIN_CUT_DATA_ROOT=str(user_data_root)),
            )
            owned["backend"] = process
            write_runtime_state(runtime_path, owned)
            if not wait_for_state(backend_state, "shipin-cut", START_TIMEOUT_SECONDS, process):
                logger.error("本地服务启动失败，请查看日志：%s", child_log_path)
                return 1
            logger.info("本地服务已启动（PID %s）。", process.pid)

        if frontend == "shipin-cut":
            logger.info("检测到前端页面已运行，复用 5173 端口。")
        else:
            logger.info("正在启动前端页面")
            process = start_process(
                [
                    npm,
                    "run",
                    "dev",
                    "--",
                    "--host",
                    FRONTEND_HOST,
                    "--port",
                    str(FRONTEND_PORT),
                    "--strictPort",
                    "--config",
                    str(vite_config_path),
                ],
                project_root,
                child_log,
            )
            owned["frontend"] = process
            write_runtime_state(runtime_path, owned)
            if not wait_for_state(frontend_state, "shipin-cut", START_TIMEOUT_SECONDS, process):
                logger.error("前端页面启动失败，请查看日志：%s", child_log_path)
                return 1
            logger.info("前端页面已启动（PID %s）。", process.pid)

        if not no_browser:
            webbrowser.open(FRONTEND_URL)
            logger.info("浏览器已打开：%s", FRONTEND_URL)
        logger.info("视频混剪工具已就绪，请保持本窗口打开。")

        while True:
            for name, process in owned.items():
                if process.poll() is not None:
                    logger.error("%s 进程意外退出，退出码：%s", name, process.returncode)
                    return 1
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到退出指令，正在关闭本启动器拉起的服务。")
        return 0
    except Exception:
        logger.exception("启动器发生异常，请将日志文件发给管理员：%s", log_path)
        return 1
    finally:
        for label, process in reversed(list(owned.items())):
            stop_owned_process(process, logger, label)
        if runtime_path.exists():
            try:
                runtime_path.unlink()
            except OSError:
                pass
        if child_log:
            child_log.close()
        lock.release()


def main() -> int:
    parser = argparse.ArgumentParser(description="视频混剪工具 Windows 本地启动器")
    parser.add_argument("--no-browser", action="store_true", help="测试时不自动打开浏览器")
    args = parser.parse_args()
    return run_launcher(no_browser=args.no_browser)


if __name__ == "__main__":
    raise SystemExit(main())
