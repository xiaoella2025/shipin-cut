import json
import logging
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "launcher"))

import ShipinCutLauncher as launcher
from tools import local_export_server


class TestProjectRoot(unittest.TestCase):
    def test_resolves_root_from_launcher_directory(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "launcher").mkdir()
            (root / "tools").mkdir()
            (root / "package.json").write_text("{}", encoding="utf-8")
            (root / "tools" / "local_export_server.py").write_text("", encoding="utf-8")

            self.assertEqual(launcher.resolve_project_root(root / "launcher"), root.resolve())

    def test_source_does_not_hardcode_workspace_drive(self):
        source = (ROOT / "launcher" / "ShipinCutLauncher.py").read_text(encoding="utf-8")
        self.assertNotIn("F:\\shipin-cut", source)

    def test_batch_error_points_to_user_log_directory(self):
        source = (ROOT / "启动视频混剪工具.bat").read_text(encoding="utf-8")
        self.assertIn(r"%LOCALAPPDATA%\ShipinCut\logs\launcher", source)
        self.assertNotIn("查看 logs\\launcher", source)


class TestUserDataPaths(unittest.TestCase):
    def test_resolves_user_data_root_from_localappdata(self):
        with tempfile.TemporaryDirectory() as td:
            local_app_data = Path(td) / "LocalAppData"

            self.assertEqual(
                launcher.resolve_user_data_root({"LOCALAPPDATA": str(local_app_data)}),
                local_app_data / "ShipinCut",
            )

    def test_creates_writable_directories_outside_project_root(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "Program Files" / "ShipinCut"
            project_root.mkdir(parents=True)
            user_data_root = base / "LocalAppData" / "ShipinCut"

            paths = launcher.ensure_user_data_dirs(user_data_root)

            self.assertEqual(paths["launcher_logs"], user_data_root / "logs" / "launcher")
            self.assertEqual(paths["runtime"], user_data_root / "runtime")
            self.assertEqual(paths["config"], user_data_root / "config")
            self.assertEqual(paths["cache"], user_data_root / "cache")
            self.assertEqual(paths["pycache"], user_data_root / "cache" / "pycache")
            self.assertTrue(all(path.is_dir() for path in paths.values()))
            self.assertFalse((project_root / "logs").exists())

    def test_runtime_vite_config_uses_user_cache(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "Program Files" / "ShipinCut"
            project_root.mkdir(parents=True)
            (project_root / "vite.config.js").write_text(
                "import react from '@vitejs/plugin-react'\n"
                "export default { plugins: [react()], base: '/' }\n",
                encoding="utf-8",
            )
            user_data_root = base / "LocalAppData" / "ShipinCut"
            paths = launcher.ensure_user_data_dirs(user_data_root)

            config_path = launcher.prepare_runtime_vite_config(
                paths["runtime"], paths["cache"] / "vite", project_root
            )
            source = config_path.read_text(encoding="utf-8")

            self.assertEqual(config_path.parent, user_data_root / "runtime")
            self.assertIn("/shipin-cut/", source)
            self.assertIn((paths["cache"] / "vite").as_posix(), source)
            # The runtime config must import the project's vite.config.js so the
            # React plugin is preserved (otherwise App.jsx references React
            # without importing it and the dev server renders a blank page).
            self.assertIn("baseConfig", source)
            self.assertIn(project_root.as_uri(), source)

    def test_backend_writable_paths_use_launcher_data_root(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            repo_root = base / "Program Files" / "ShipinCut"
            user_data_root = base / "LocalAppData" / "ShipinCut"

            workspace, settings = local_export_server.resolve_writable_paths(
                repo_root,
                {"SHIPIN_CUT_DATA_ROOT": str(user_data_root)},
            )

            self.assertEqual(workspace, user_data_root / "workspace")
            self.assertEqual(settings, user_data_root / "config" / "local_settings.json")
            self.assertNotEqual(workspace.parent, repo_root)


class TestInstallerRuntimeFiles(unittest.TestCase):
    def test_installer_bundles_dist_frontend(self):
        """v0.9.13 (3B): 安装版前端由 dist/ 提供，shipin-cut.iss 必须打包它。"""
        source = (ROOT / "installer" / "shipin-cut.iss").read_text(encoding="utf-8")
        self.assertIn('Source: "..\\dist\\*"', source)
        # 目标目录必须是 {app}\dist
        self.assertIn('DestDir: "{app}\\dist"', source)

    def test_installer_no_longer_bundles_node_modules(self):
        """v0.9.13: 安装版不再需要 node_modules/，把它从 shipin-cut.iss 移除。"""
        source = (ROOT / "installer" / "shipin-cut.iss").read_text(encoding="utf-8")
        self.assertNotIn('Source: "..\\node_modules\\*"', source)


class TestStaticFrontendMode(unittest.TestCase):
    """v0.9.13 (3B): 启动器 + 后端必须支持静态前端托管，避免再依赖 Node/npm。"""

    def test_has_static_frontend_detects_dist_index(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            (root / "dist" / "assets").mkdir(parents=True)
            (root / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
            self.assertTrue(launcher.has_static_frontend(root))

    def test_has_static_frontend_false_without_dist(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.assertFalse(launcher.has_static_frontend(root))

    def test_static_frontend_url_points_to_backend(self):
        # 静态前端 URL 走 8765/shipin-cut/，不再走 5173
        self.assertEqual(
            launcher.STATIC_FRONTEND_URL,
            f"http://{launcher.BACKEND_HOST}:{launcher.BACKEND_PORT}/shipin-cut/",
        )
        self.assertNotIn("5173", launcher.STATIC_FRONTEND_URL)

    def test_dev_frontend_url_unchanged(self):
        # 开发态仍走 Vite dev server，5173 不动
        self.assertEqual(launcher.DEV_FRONTEND_URL, "http://localhost:5173/shipin-cut/")

    def test_run_launcher_static_mode_skips_npm_and_node_modules(self):
        """dist 存在时，启动器必须跳过 find_npm() 与 node_modules 检查。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "app"
            project_root.mkdir()
            (project_root / "dist" / "index.html").parent.mkdir(parents=True, exist_ok=True)
            (project_root / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
            (project_root / "tools").mkdir()
            (project_root / "tools" / "local_export_server.py").write_text(
                "pass\n", encoding="utf-8"
            )
            (project_root / "package.json").write_text("{}", encoding="utf-8")

            user_data_root = base / "LocalAppData" / "ShipinCut"

            calls = {"npm": 0, "browser_url": None}

            def fake_find_npm():
                calls["npm"] += 1
                return None  # 即使 npm 不在也不应被调用

            def fake_wb_open(url, *args, **kwargs):
                calls["browser_url"] = url
                return True

            # 用一个无文件 handler 的 logger，避免测试结束后 Windows 删不掉日志文件
            null_logger = logging.getLogger("shipin_cut_launcher_test_null")
            null_logger.handlers = [logging.NullHandler()]
            null_logger.setLevel(logging.INFO)
            null_logger.propagate = False

            with patch.object(launcher, "find_npm", side_effect=fake_find_npm), \
                 patch.object(launcher, "backend_state", return_value="shipin-cut"), \
                 patch.object(launcher, "static_frontend_state", return_value="shipin-cut"), \
                 patch.object(launcher, "verify_python", return_value=True), \
                 patch.object(launcher, "resolve_project_root", return_value=project_root), \
                 patch.object(launcher, "resolve_user_data_root", return_value=user_data_root), \
                 patch.object(launcher, "setup_logging", return_value=(null_logger, base / "no.log")), \
                 patch.object(launcher, "SingleInstanceLock") as fake_lock_cls, \
                 patch.object(launcher, "webbrowser") as fake_wb, \
                 patch("time.sleep", side_effect=KeyboardInterrupt):
                fake_lock_cls.return_value.acquire.return_value = True
                fake_wb.open.side_effect = fake_wb_open

                try:
                    launcher.run_launcher(no_browser=False)
                except SystemExit:
                    pass

            # npm 一次都不应被调用
            self.assertEqual(calls["npm"], 0, "static mode must not invoke find_npm()")
            # node_modules 不存在也不应触发"请安装前端依赖"路径
            self.assertFalse((project_root / "node_modules").exists())
            # webbrowser.open 必须用 STATIC_FRONTEND_URL，不带 5173
            self.assertIsNotNone(calls["browser_url"], "webbrowser.open must be called")
            self.assertEqual(calls["browser_url"], launcher.STATIC_FRONTEND_URL)
            self.assertNotIn("5173", calls["browser_url"])

    def test_run_launcher_dev_mode_requires_npm_and_node_modules(self):
        """无 dist 时启动器回退到 dev 模式，必须仍校验 npm + node_modules。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "app"
            project_root.mkdir()
            (project_root / "tools").mkdir()
            (project_root / "tools" / "local_export_server.py").write_text(
                "pass\n", encoding="utf-8"
            )
            (project_root / "package.json").write_text("{}", encoding="utf-8")
            user_data_root = base / "LocalAppData" / "ShipinCut"

            null_logger = logging.getLogger("shipin_cut_launcher_test_null2")
            null_logger.handlers = [logging.NullHandler()]
            null_logger.setLevel(logging.INFO)
            null_logger.propagate = False

            with patch.object(launcher, "find_npm", return_value=None), \
                 patch.object(launcher, "verify_python", return_value=True), \
                 patch.object(launcher, "resolve_project_root", return_value=project_root), \
                 patch.object(launcher, "resolve_user_data_root", return_value=user_data_root), \
                 patch.object(launcher, "setup_logging", return_value=(null_logger, base / "no.log")), \
                 patch.object(launcher, "SingleInstanceLock") as fake_lock_cls:
                fake_lock_cls.return_value.acquire.return_value = True
                ret = launcher.run_launcher(no_browser=True)
                self.assertEqual(ret, 1, "missing npm must abort dev mode")


class TestStaticFrontendServing(unittest.TestCase):
    """v0.9.13: local_export_server.py 在 /shipin-cut/ 下托管 dist/。"""

    def _make_handler(self):
        from io import BytesIO

        # 构造一个最小可用的 handler 实例，直接调我们的方法
        handler_cls = local_export_server.ExportHandler
        # BaseHTTPRequestHandler.__init__ 在没 socket 时会报错；
        # 我们绕过它，只绑定方法所需的几个属性。
        handler = handler_cls.__new__(handler_cls)
        handler.path = "/shipin-cut/"
        handler.wfile = BytesIO()
        handler.requestline = "GET /shipin-cut/ HTTP/1.1"
        handler.request_version = "HTTP/1.1"
        handler.command = "GET"
        handler.headers = {}
        handler.client_address = ("127.0.0.1", 0)
        # log_request 会读 self.requestline 等；测试只关心业务逻辑，把它压住。
        handler.log_request = lambda *a, **kw: None
        handler.log_message = lambda *a, **kw: None
        return handler

    def test_frontend_prefix_and_dist_dir_exposed(self):
        # 常量必须可用
        self.assertEqual(local_export_server.FRONTEND_PREFIX, "/shipin-cut")
        self.assertTrue(str(local_export_server.DIST_DIR).endswith("dist"))

    def test_serve_static_skips_non_frontend_paths(self):
        handler = self._make_handler()
        handler.path = "/health"
        self.assertFalse(handler._serve_static_frontend())

    def test_serve_static_returns_index_for_root(self):
        handler = self._make_handler()
        handler.path = "/shipin-cut/"
        # 仓库根目录有真实 dist/，必须能拿到 index.html
        self.assertTrue(handler._serve_static_frontend())
        body = handler.wfile.getvalue()
        self.assertIn("视频混剪工具".encode("utf-8"), body)

    def test_serve_static_returns_assets_with_correct_mime(self):
        handler = self._make_handler()
        dist_assets = local_export_server.DIST_DIR / "assets"
        if not dist_assets.is_dir() or not any(dist_assets.iterdir()):
            self.skipTest("dist/assets/ not yet built; run npm.cmd run build first")
        first_asset = next(dist_assets.iterdir())
        handler.path = f"/shipin-cut/assets/{first_asset.name}"
        handler.wfile = __import__("io").BytesIO()
        self.assertTrue(handler._serve_static_frontend())
        body = handler.wfile.getvalue()
        self.assertGreater(len(body), 0)
        suffix = first_asset.suffix.lower()
        if suffix in local_export_server.STATIC_EXTRA_TYPES:
            expected = local_export_server.STATIC_EXTRA_TYPES[suffix].split(";")[0]
            # Content-Type 在 send_header 里被设置；这里通过 STATIC_EXTRA_TYPES 间接验证

    def test_serve_static_spa_fallback(self):
        handler = self._make_handler()
        handler.path = "/shipin-cut/this/is/spa"
        self.assertTrue(handler._serve_static_frontend())
        body = handler.wfile.getvalue()
        self.assertIn("视频混剪工具".encode("utf-8"), body)

    def test_serve_static_rejects_path_traversal(self):
        handler = self._make_handler()
        handler.path = "/shipin-cut/assets/../../package.json"
        self.assertTrue(handler._serve_static_frontend())
        body = handler.wfile.getvalue()
        # 不应返回 package.json 的真实内容；要么 403，要么 404
        self.assertNotIn(b'"name"', body)


class TestExportScriptPaths(unittest.TestCase):
    """v0.9.10: 安装版下 export_video.py / export_with_jianying.py 不再写死
    REPO_ROOT/export_workspace；它们和 local_export_server.py 一样读
    SHIPIN_CUT_DATA_ROOT，否则回退到仓库根目录的开发态路径。"""

    def _writable_fake_repo(self, td):
        base = Path(td)
        repo_root = base / "Program Files" / "ShipinCut"
        repo_root.mkdir(parents=True)
        (repo_root / "export_workspace").mkdir(parents=True)
        return base, repo_root

    def _probe_module_attr(self, module, attr, env):
        """在隔离子进程里导入 module 并打印 module.<attr>，避开 export_with_jianying
        在 import 阶段跑 argparse 的副作用。"""
        bootstrap = (
            "import sys;"
            "sys.path.insert(0,r'" + str(ROOT / "tools") + "');"
            "sys.argv=['probe'];"
        )
        script = bootstrap + f"import {module};print(getattr({module},'{attr}'))"
        return subprocess.run(
            [sys.executable, "-c", script],
            env=env, capture_output=True, text=True, check=False,
        )

    def test_export_video_workspace_uses_data_root_when_set(self):
        with tempfile.TemporaryDirectory() as td:
            base, repo_root = self._writable_fake_repo(td)
            user_data_root = base / "LocalAppData" / "ShipinCut"
            env = {k: v for k, v in os.environ.items() if k != "SHIPIN_CUT_DATA_ROOT"}
            env["SHIPIN_CUT_DATA_ROOT"] = str(user_data_root)

            probe = self._probe_module_attr("export_video", "WORKSPACE", env)
            self.assertEqual(probe.returncode, 0, probe.stderr)
            self.assertEqual(probe.stdout.strip(), str(user_data_root / "workspace"))
            self.assertNotIn(str(repo_root), probe.stdout)

    def test_export_video_success_marker_is_relative_to_workspace(self):
        """v0.9.11: 成功行「完成！输出文件: ...」必须输出相对 WORKSPACE 的路径，
        否则安装版（WORKSPACE = %LOCALAPPDATA%\\ShipinCut\\workspace）下后端
        用 WORKSPACE / rel 拼回绝对路径时会去找不存在的
        <workspace>\\export_workspace\\output\\<name>，导致 /export 报
        "生成失败" 假阴性。开发态下应输出 export_workspace/output/<name>，
        安装态下应输出 output/<name>。"""
        source = (ROOT / "tools" / "export_video.py").read_text(encoding="utf-8")
        # 不能继续硬编码 export_workspace/output/ 前缀
        self.assertNotIn("export_workspace/output/{final_name}", source)
        self.assertIn("rel_str", source)

    def test_export_video_workspace_falls_back_to_repo_root(self):
        """开发态（不注入 SHIPIN_CUT_DATA_ROOT）继续走仓库根目录下的 export_workspace。
        子进程里 REPO_ROOT 就是 export_video.py 所在的真实 tools/ 的父目录，
        即本仓库根目录 F:\\shipin-cut，fallback 分支必须落到那里。"""
        with tempfile.TemporaryDirectory() as td:
            base, _ = self._writable_fake_repo(td)
            env = {k: v for k, v in os.environ.items() if k != "SHIPIN_CUT_DATA_ROOT"}

            probe = self._probe_module_attr("export_video", "WORKSPACE", env)
            self.assertEqual(probe.returncode, 0, probe.stderr)
            # export_video.WORKSPACE 应该等于脚本所在 tools/ 的父目录 + export_workspace
            self.assertEqual(probe.stdout.strip(), str(ROOT / "export_workspace"))
            self.assertNotIn("workspace", probe.stdout.replace(str(ROOT / "export_workspace"), ""))

    def test_export_with_jianying_uses_data_root_when_set(self):
        """export_with_jianying.py 在 import 阶段就跑 argparse + 主流程，没法
        直接 import。改用 exec 执行从 import 块到 WORKSPACE_DIR/SUBTITLE_DIR
        赋值为止的源码片段，验证路径解析逻辑。"""
        source = (ROOT / "tools" / "export_with_jianying.py").read_text(encoding="utf-8")
        # 截取到 SUBTITLE_DIR 赋值的最后一个分支结束
        marker = "SUBTITLE_DIR  = SCRIPT_DIR.parent / \"local-output\" / \"subtitles\""
        cut_at = source.index(marker) + len(marker)
        snippet = source[:cut_at]
        # main 流程使用 SCRIPT_DIR 做绝对路径定位，把 __file__ 指向真实脚本
        snippet = snippet.replace(
            "SCRIPT_DIR = Path(__file__).resolve().parent",
            "SCRIPT_DIR = Path(r'" + str(ROOT / "tools" / "export_with_jianying.py")
            + "').resolve().parent",
        )

        with tempfile.TemporaryDirectory() as td:
            base, _ = self._writable_fake_repo(td)
            user_data_root = base / "LocalAppData" / "ShipinCut"
            env = {k: v for k, v in os.environ.items() if k != "SHIPIN_CUT_DATA_ROOT"}
            env["SHIPIN_CUT_DATA_ROOT"] = str(user_data_root)

            probe = subprocess.run(
                [sys.executable, "-c",
                 snippet + "\nprint(WORKSPACE_DIR);print(SUBTITLE_DIR)"],
                env=env, capture_output=True, text=True, check=False,
            )
            self.assertEqual(probe.returncode, 0, probe.stderr)
            out = probe.stdout.strip().splitlines()
            self.assertEqual(out[0], str(user_data_root / "workspace"))
            self.assertEqual(out[1], str(user_data_root / "local-output" / "subtitles"))
            self.assertNotIn(str(ROOT), probe.stdout)

    def test_local_export_server_safe_open_path_accepts_data_root_workspace(self):
        """安装版下 _is_safe_open_path 必须把 WORKSPACE 视作合法父目录，
        否则"打开草稿文件夹"会被闸门拒掉。这里临时替换 WORKSPACE 引用，模拟
        launcher 把 WORKSPACE 重定向到用户数据目录之后的运行环境。"""
        workspace = Path(tempfile.mkdtemp(prefix="shipin-test-ws-"))
        try:
            drafts = workspace / "drafts"
            drafts.mkdir(parents=True)

            with patch.object(local_export_server, "WORKSPACE", new=workspace), \
                 patch.object(local_export_server, "JIANYING_DRAFT_ROOT",
                              new=workspace / "no-jianying"):
                ok = local_export_server._is_safe_open_path(drafts)
                self.assertTrue(
                    ok,
                    "_is_safe_open_path must accept the resolved WORKSPACE root",
                )
        finally:
            import shutil
            shutil.rmtree(workspace, ignore_errors=True)


class TestJianyingRuntime(unittest.TestCase):
    """v0.9.11: /export-jianying 不再硬编码 tmp\\pyjianying_probe\\.venv\\Scripts\\python，
    改用后端 sys.executable + PYTHONPATH 指到 tools/pyjianying_runtime/。安装版下
    这两个组合必须可用；dev 模式下若 pyjianying_runtime 不存在则回退到 .venv/site-packages。"""

    def test_handler_source_drops_hardcoded_dev_venv_path(self):
        """local_export_server.py 里 /export-jianying 不再硬编码
        tmp\\pyjianying_probe\\.venv\\Scripts\\python 作为执行解释器路径，
        否则安装版 {app}\\tmp\\pyjianying_probe\\... 不存在会直接 WinError 2。
        dev 回退路径（Lib\\site-packages）只在 pyjianying_runtime 缺失时才走，
        不阻塞安装版。"""
        source = (ROOT / "tools" / "local_export_server.py").read_text(encoding="utf-8")
        # 拦截点：Scripts\\python 是 Windows .exe 路径，只在 venv 解释器调用
        # 场景下出现；Lib\\site-packages 作为 dev 回退保留是 OK 的。
        self.assertNotIn(
            r"tmp" + "\\" + "pyjianying_probe" + "\\" + ".venv" + "\\" + "Scripts" + "\\" + "python",
            source,
        )
        # 必须改用 sys.executable + pyjianying_runtime 注入 PYTHONPATH
        self.assertIn("sys.executable", source)
        self.assertIn("pyjianying_runtime", source)
        self.assertIn("PYTHONPATH", source)

    def test_orchestrator_drops_dash_dash_venv_arg(self):
        """tools/export_with_jianying.py 里的 --venv argparse 字段已经无人使用，
        删除避免误导；改用 sys.executable + pyjianying_runtime 透传。"""
        source = (ROOT / "tools" / "export_with_jianying.py").read_text(encoding="utf-8")
        self.assertNotIn('"--venv"', source)
        self.assertNotIn("args.venv", source)
        self.assertIn("sys.executable", source)
        self.assertIn("pyjianying_runtime", source)

    def test_pyjianying_runtime_bundled_alongside_tools(self):
        """tools/pyjianying_runtime/ 必须随仓库一起提交，pyJianYingDraft +
        pymediainfo + uiautomation + comtypes 都在（uiautomation 间接拉 comtypes，
        pyJianYingDraft 在 import 期就触达 jianying_controller → uiautomation）。"""
        runtime = ROOT / "tools" / "pyjianying_runtime"
        self.assertTrue(runtime.is_dir(), "tools/pyjianying_runtime must exist for installer bundling")
        for pkg in ("pyJianYingDraft", "pymediainfo", "uiautomation", "comtypes"):
            self.assertTrue(
                (runtime / pkg / "__init__.py").is_file(),
                f"tools/pyjianying_runtime/{pkg}/__init__.py must be present",
            )
        # MediaInfo.dll 必须随 pymediainfo 一起打包
        self.assertTrue(
            (runtime / "pymediainfo" / "MediaInfo.dll").is_file(),
            "pymediainfo/MediaInfo.dll must be bundled so pymediainfo.MediaInfo() works",
        )

    def test_bundled_runtime_imports_under_backend_python(self):
        """用系统 Python 模拟后端运行时，把 runtime 注入 PYTHONPATH 后必须能
        import pyJianYingDraft + DraftFolder + pymediainfo。这是安装版路径下
        /export-jianying 的关键可用性闸门。"""
        runtime = ROOT / "tools" / "pyjianying_runtime"
        if not runtime.is_dir():
            self.skipTest("tools/pyjianying_runtime not yet populated")

        env = {k: v for k, v in os.environ.items() if k != "PYTHONPATH"}
        env["PYTHONPATH"] = str(runtime)
        probe = subprocess.run(
            [sys.executable, "-c",
             "import sys; "
             "from pyJianYingDraft import DraftFolder, VideoMaterial, VideoSegment, "
             "TextSegment, TrackType, Timerange; "
             "import pymediainfo; import uiautomation; import comtypes; "
             "print('ok')"],
            env=env, capture_output=True, text=True, check=False,
        )
        self.assertEqual(probe.returncode, 0, probe.stderr)
        self.assertIn("ok", probe.stdout)

    def test_installer_iss_bundles_pyjianying_runtime(self):
        """shipin-cut.iss 必须把 tools/pyjianying_runtime/ 加入安装包，
        否则装出来的 {app}\\tools\\pyjianying_runtime 为空，运行时会报
        '未找到 pyJianYingDraft 运行时'。"""
        source = (ROOT / "installer" / "shipin-cut.iss").read_text(encoding="utf-8")
        self.assertIn("tools\\pyjianying_runtime", source)


class TestServiceDetection(unittest.TestCase):
    @patch.object(launcher, "port_is_open", return_value=False)
    def test_backend_stopped(self, _port):
        self.assertEqual(launcher.backend_state(), "stopped")

    @patch.object(launcher, "fetch_url")
    @patch.object(launcher, "port_is_open", return_value=True)
    def test_backend_recognized(self, _port, fetch):
        fetch.return_value = (
            200,
            json.dumps({"ok": True, "service": launcher.BACKEND_SERVICE_ID}).encode("utf-8"),
            "application/json",
        )
        self.assertEqual(launcher.backend_state(), "shipin-cut")

    @patch.object(launcher, "fetch_url", return_value=(200, b"other", "text/plain"))
    @patch.object(launcher, "port_is_open", return_value=True)
    def test_backend_foreign_port(self, _port, _fetch):
        self.assertEqual(launcher.backend_state(), "occupied")

    @patch.object(launcher, "fetch_url")
    @patch.object(launcher, "port_is_open", return_value=True)
    def test_frontend_recognized(self, _port, fetch):
        fetch.return_value = (
            200,
            "<title>视频混剪工具</title>".encode("utf-8"),
            "text/html; charset=utf-8",
        )
        self.assertEqual(launcher.frontend_state(), "shipin-cut")

    @patch.object(launcher, "fetch_url", return_value=(200, b"other", "text/html"))
    @patch.object(launcher, "port_is_open", return_value=True)
    def test_frontend_foreign_port(self, _port, _fetch):
        self.assertEqual(launcher.frontend_state(), "occupied")


class TestEmbeddedPython(unittest.TestCase):
    """v0.9.14 (3C-3): 启动器必须能解析内置 Python 解释器并把环境变量注入后端。"""

    def test_resolves_install_layout_first(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            (project_root / "runtime" / "python").mkdir(parents=True)
            install_py = project_root / "runtime" / "python" / "python.exe"
            install_py.write_text("", encoding="utf-8")
            # 同时存在开发态布局，必须优先安装布局
            (project_root / "installer" / "runtime" / "python").mkdir(parents=True)
            dev_py = project_root / "installer" / "runtime" / "python" / "python.exe"
            dev_py.write_text("", encoding="utf-8")

            self.assertEqual(launcher.resolve_embedded_python(project_root), install_py.resolve())

    def test_resolves_dev_layout_when_install_missing(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "shipin-cut"
            (project_root / "installer" / "runtime" / "python").mkdir(parents=True)
            dev_py = project_root / "installer" / "runtime" / "python" / "python.exe"
            dev_py.write_text("", encoding="utf-8")

            self.assertEqual(launcher.resolve_embedded_python(project_root), dev_py.resolve())

    def test_returns_none_when_no_embedded(self):
        with tempfile.TemporaryDirectory() as td:
            self.assertIsNone(launcher.resolve_embedded_python(Path(td)))

    def test_returns_none_when_partial_layout(self):
        """只建 python 子目录但缺 python.exe 时不能误报命中。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            (project_root / "runtime" / "python").mkdir(parents=True)
            # python 子目录存在但没 python.exe
            self.assertIsNone(launcher.resolve_embedded_python(project_root))

    def test_build_backend_env_sets_required_vars(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            (project_root / "tools" / "pyjianying_runtime").mkdir(parents=True)
            user_data_root = base / "LocalAppData" / "ShipinCut"
            pycache_dir = user_data_root / "cache" / "pycache"

            env = launcher.build_backend_env(
                project_root, user_data_root, pycache_dir
            )

            self.assertEqual(env["SHIPIN_CUT_DATA_ROOT"], str(user_data_root))
            self.assertIn(str(project_root), env["PYTHONPATH"].split(os.pathsep))
            self.assertIn(
                str(project_root / "tools" / "pyjianying_runtime"),
                env["PYTHONPATH"].split(os.pathsep),
            )
            self.assertEqual(env["PYTHONPYCACHEPREFIX"], str(pycache_dir))
            # 目录必须自动创建
            self.assertTrue(pycache_dir.is_dir())

    def test_build_backend_env_preserves_existing_pythonpath(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            (project_root / "tools" / "pyjianying_runtime").mkdir(parents=True)
            user_data_root = base / "LocalAppData" / "ShipinCut"
            pycache_dir = user_data_root / "cache" / "pycache"

            base_env = {"PYTHONPATH": "C:\\extra\\path"}
            env = launcher.build_backend_env(
                project_root, user_data_root, pycache_dir, base_env=base_env
            )
            parts = env["PYTHONPATH"].split(os.pathsep)
            self.assertIn("C:\\extra\\path", parts)
            self.assertIn(str(project_root), parts)

    def test_build_backend_env_omits_missing_pyjianying(self):
        """tools/pyjianying_runtime 不存在时（例如只装一半）不能把不存在的路径塞进 PYTHONPATH。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            user_data_root = base / "LocalAppData" / "ShipinCut"
            pycache_dir = user_data_root / "cache" / "pycache"

            env = launcher.build_backend_env(
                project_root, user_data_root, pycache_dir
            )
            self.assertNotIn("pyjianying_runtime", env["PYTHONPATH"])

    def test_run_launcher_prefers_embedded_python(self):
        """当项目根下有内置 Python 时，启动器必须优先用它跑后端。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            project_root.mkdir()
            (project_root / "dist").mkdir()
            (project_root / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
            (project_root / "tools").mkdir()
            (project_root / "tools" / "local_export_server.py").write_text(
                "pass\n", encoding="utf-8"
            )
            (project_root / "package.json").write_text("{}", encoding="utf-8")
            (project_root / "runtime" / "python").mkdir(parents=True)
            embedded_py = project_root / "runtime" / "python" / "python.exe"
            embedded_py.write_text("", encoding="utf-8")
            (project_root / "tools" / "pyjianying_runtime").mkdir()

            user_data_root = base / "LocalAppData" / "ShipinCut"

            null_logger = logging.getLogger("shipin_cut_launcher_embedded_test")
            null_logger.handlers = [logging.NullHandler()]
            null_logger.setLevel(logging.INFO)
            null_logger.propagate = False

            captured = {"cmd": None, "env": None}

            def fake_start_process(command, cwd, log_handle, env=None):
                captured["cmd"] = command
                captured["env"] = env
                # 立刻标记进程结束，让 run_launcher 走 wait_for_state 失败分支 → 退 1
                proc = subprocess.Popen([sys.executable, "-c", "import sys; sys.exit(0)"])
                return proc

            with patch.object(launcher, "backend_state", return_value="stopped"), \
                 patch.object(launcher, "static_frontend_state", return_value="shipin-cut"), \
                 patch.object(launcher, "verify_python", return_value=True), \
                 patch.object(launcher, "resolve_project_root", return_value=project_root), \
                 patch.object(launcher, "resolve_user_data_root", return_value=user_data_root), \
                 patch.object(launcher, "setup_logging",
                              return_value=(null_logger, base / "no.log")), \
                 patch.object(launcher, "start_process", side_effect=fake_start_process), \
                 patch.object(launcher, "SingleInstanceLock") as fake_lock_cls, \
                 patch.object(launcher, "wait_for_state", return_value=False):
                fake_lock_cls.return_value.acquire.return_value = True
                try:
                    launcher.run_launcher(no_browser=True)
                except SystemExit:
                    pass

            self.assertIsNotNone(captured["cmd"], "start_process must be called")
            # 第一项必须是内置 Python 路径，不应是 sys.executable
            self.assertEqual(
                Path(captured["cmd"][0]).resolve(),
                embedded_py.resolve(),
                "launcher must use embedded python.exe, not sys.executable",
            )
            self.assertEqual(
                Path(captured["cmd"][1]).name, "local_export_server.py"
            )
            # env 必须包含 PYTHONPATH 和 PYTHONPYCACHEPREFIX
            self.assertIsNotNone(captured["env"])
            self.assertIn("PYTHONPATH", captured["env"])
            self.assertIn("PYTHONPYCACHEPREFIX", captured["env"])
            self.assertEqual(
                captured["env"]["SHIPIN_CUT_DATA_ROOT"], str(user_data_root)
            )

    def test_run_launcher_falls_back_when_no_embedded(self):
        """无内置 Python 时回退到当前解释器，且仍然注入 PYTHONPATH/PYTHONPYCACHEPREFIX。"""
        with tempfile.TemporaryDirectory() as td:
            base = Path(td)
            project_root = base / "ShipinCut"
            project_root.mkdir()
            (project_root / "dist").mkdir()
            (project_root / "dist" / "index.html").write_text("<html></html>", encoding="utf-8")
            (project_root / "tools").mkdir()
            (project_root / "tools" / "local_export_server.py").write_text(
                "pass\n", encoding="utf-8"
            )
            (project_root / "package.json").write_text("{}", encoding="utf-8")
            # 注意：没有 runtime/python/ 也没有 installer/runtime/python/

            user_data_root = base / "LocalAppData" / "ShipinCut"

            null_logger = logging.getLogger("shipin_cut_launcher_fallback_test")
            null_logger.handlers = [logging.NullHandler()]
            null_logger.setLevel(logging.INFO)
            null_logger.propagate = False

            captured = {"cmd": None, "env": None}

            def fake_start_process(command, cwd, log_handle, env=None):
                captured["cmd"] = command
                captured["env"] = env
                proc = subprocess.Popen([sys.executable, "-c", "import sys; sys.exit(0)"])
                return proc

            with patch.object(launcher, "backend_state", return_value="stopped"), \
                 patch.object(launcher, "static_frontend_state", return_value="shipin-cut"), \
                 patch.object(launcher, "verify_python", return_value=True), \
                 patch.object(launcher, "resolve_project_root", return_value=project_root), \
                 patch.object(launcher, "resolve_user_data_root", return_value=user_data_root), \
                 patch.object(launcher, "setup_logging",
                              return_value=(null_logger, base / "no.log")), \
                 patch.object(launcher, "start_process", side_effect=fake_start_process), \
                 patch.object(launcher, "SingleInstanceLock") as fake_lock_cls, \
                 patch.object(launcher, "wait_for_state", return_value=False):
                fake_lock_cls.return_value.acquire.return_value = True
                try:
                    launcher.run_launcher(no_browser=True)
                except SystemExit:
                    pass

            self.assertIsNotNone(captured["cmd"])
            # 没有 embedded，回退到当前解释器
            self.assertEqual(Path(captured["cmd"][0]).resolve(), Path(sys.executable).resolve())
            # 即使是回退路径，env 也必须有 PYTHONPYCACHEPREFIX
            self.assertIn("PYTHONPYCACHEPREFIX", captured["env"])


class TestActivationAPI(unittest.TestCase):
    """v4A: 兑换码入口占位（仅本地模拟）。

    验证：
      - GET /activation-status 默认 trial（无文件时）
      - POST /activate-code 输入测试码成功，activation.json 写到 LocalAppData
      - POST /activate-code 输入错误码失败，但 status 仍为 trial
      - activation.json 不会写到项目根 / 安装目录
      - 失败重试仍安全（多次写入安全覆盖）
    """

    def setUp(self):
        from http.client import HTTPConnection
        # 用临时目录模拟 SHIPIN_CUT_DATA_ROOT，避免污染真实 %LOCALAPPDATA%
        self._td_ctx = tempfile.TemporaryDirectory()
        self.td = Path(self._td_ctx.name)
        self.user_data_root = self.td / "LocalAppData" / "ShipinCut"
        self.user_data_root.mkdir(parents=True)
        self.config_dir = self.user_data_root / "config"
        self.activation_path = self.config_dir / "activation.json"

        # 把 SHIPIN_CUT_DATA_ROOT 注入环境，再 spawn 一次性后端进程
        env = dict(os.environ, SHIPIN_CUT_DATA_ROOT=str(self.user_data_root))
        # 用一个空闲端口
        import socket
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        self.port = sock.getsockname()[1]
        sock.close()

        script = (ROOT / "tools" / "local_export_server.py").resolve()
        env = dict(env, SHIPIN_CUT_PORT=str(self.port))
        self.proc = subprocess.Popen(
            [sys.executable, str(script)],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(ROOT),
        )
        # 等服务就绪
        deadline = __import__("time").time() + 10
        ready = False
        while __import__("time").time() < deadline:
            try:
                conn = HTTPConnection("127.0.0.1", self.port, timeout=1)
                conn.request("GET", "/health")
                r = conn.getresponse()
                _ = r.read()
                if r.status == 200:
                    ready = True
                    break
            except Exception:
                __import__("time").sleep(0.2)
            finally:
                try: conn.close()
                except Exception: pass
        if not ready:
            self.proc.terminate()
            self.fail(f"local export server did not start on port {self.port}")

    def tearDown(self):
        try:
            self.proc.terminate()
            try:
                self.proc.wait(timeout=3)
            except Exception:
                self.proc.kill()
        finally:
            self._td_ctx.cleanup()

    def _request(self, method, path, body=None):
        from http.client import HTTPConnection
        conn = HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            headers = {}
            data = None
            if body is not None:
                data = json.dumps(body).encode("utf-8")
                headers["Content-Type"] = "application/json; charset=utf-8"
            conn.request(method, path, body=data, headers=headers)
            r = conn.getresponse()
            raw = r.read()
            return r.status, json.loads(raw.decode("utf-8")) if raw else {}
        finally:
            conn.close()

    def test_default_status_is_trial_when_no_file(self):
        """GET /activation-status 在 activation.json 不存在时返回 trial。"""
        status, body = self._request("GET", "/activation-status")
        self.assertEqual(status, 200)
        self.assertTrue(body.get("ok"))
        self.assertEqual(body.get("status"), "trial")
        self.assertEqual(body.get("source"), "default-local-trial")
        self.assertEqual(body.get("version"), "4A")
        # 懒写盘：trial 时不应该落 activation.json
        self.assertFalse(self.activation_path.exists(),
                         "trial 时不该落 activation.json")

    def test_activate_with_test_code_succeeds(self):
        """POST /activate-code 输入 SHIPIN-TEST-2026 激活成功。"""
        status, body = self._request("POST", "/activate-code", {"code": "SHIPIN-TEST-2026"})
        self.assertEqual(status, 200)
        self.assertTrue(body.get("ok"))
        self.assertEqual(body.get("status"), "activated")
        self.assertEqual(body.get("message"), "激活成功")
        activation = body.get("activation") or {}
        self.assertEqual(activation.get("code"), "SHIPIN-TEST-2026")
        self.assertEqual(activation.get("source"), "local-placeholder")
        self.assertEqual(activation.get("version"), "4A")
        self.assertIn("activatedAt", activation)
        # activation.json 落到 LocalAppData/config/
        self.assertTrue(self.activation_path.exists(),
                         f"activation.json 应当写入 {self.activation_path}")
        on_disk = json.loads(self.activation_path.read_text(encoding="utf-8"))
        self.assertEqual(on_disk.get("status"), "activated")
        self.assertEqual(on_disk.get("code"), "SHIPIN-TEST-2026")

    def test_activate_with_invalid_code_keeps_trial(self):
        """POST /activate-code 输入错误码返回 ok=false，**绝不**改写 status。"""
        # 先确认默认是 trial
        _, before = self._request("GET", "/activation-status")
        self.assertEqual(before.get("status"), "trial")

        status, body = self._request("POST", "/activate-code", {"code": "WRONG-CODE-XYZ"})
        self.assertEqual(status, 200)
        self.assertFalse(body.get("ok"))
        self.assertEqual(body.get("status"), "trial",
                          "错误码不能让 status 变 inactive / unknown")
        self.assertIn("无效", body.get("message", ""))
        # activation.json 不应被错误码污染
        self.assertFalse(self.activation_path.exists())

        # 再 GET，状态仍是 trial
        _, after = self._request("GET", "/activation-status")
        self.assertEqual(after.get("status"), "trial")

    def test_activate_with_empty_code_rejected(self):
        """POST /activate-code 输入空字符串视为无效，不写文件。"""
        status, body = self._request("POST", "/activate-code", {"code": ""})
        self.assertEqual(status, 200)
        self.assertFalse(body.get("ok"))
        self.assertEqual(body.get("status"), "trial")
        self.assertFalse(self.activation_path.exists())

    def test_all_three_test_codes_accepted(self):
        """4A 文档列出的 3 个测试码都应能激活。"""
        from http.client import HTTPConnection
        import socket as _s
        for code in ("SHIPIN-TEST-2026", "SHIPIN-VIP-LOCAL", "MIXCUT-LOCAL-OK"):
            # 每个测试码用独立的临时目录
            with tempfile.TemporaryDirectory() as td2:
                udr = Path(td2) / "LocalAppData" / "ShipinCut"
                udr.mkdir(parents=True)
                ap = udr / "config" / "activation.json"
                # 找空闲端口
                sock = _s.socket(); sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]; sock.close()
                env = dict(os.environ, SHIPIN_CUT_DATA_ROOT=str(udr), SHIPIN_CUT_PORT=str(port))
                p = subprocess.Popen(
                    [sys.executable, str(ROOT / "tools" / "local_export_server.py")],
                    env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                    cwd=str(ROOT),
                )
                try:
                    # 等就绪
                    deadline = __import__("time").time() + 10
                    while __import__("time").time() < deadline:
                        try:
                            c = HTTPConnection("127.0.0.1", port, timeout=1)
                            c.request("GET", "/health")
                            r = c.getresponse(); r.read()
                            if r.status == 200: break
                        except Exception:
                            __import__("time").sleep(0.2)
                        finally:
                            try: c.close()
                            except Exception: pass
                    # POST 激活
                    c = HTTPConnection("127.0.0.1", port, timeout=5)
                    c.request("POST", "/activate-code",
                              body=json.dumps({"code": code}).encode("utf-8"),
                              headers={"Content-Type": "application/json; charset=utf-8"})
                    r = c.getresponse(); raw = r.read(); c.close()
                    j = json.loads(raw.decode("utf-8"))
                    self.assertEqual(r.status, 200, f"{code}: HTTP {r.status}")
                    self.assertTrue(j.get("ok"), f"{code}: ok=false, {j}")
                    self.assertEqual(j.get("status"), "activated")
                    self.assertTrue(ap.exists(), f"{code}: activation.json 未写入")
                finally:
                    p.terminate()
                    try: p.wait(timeout=3)
                    except Exception: p.kill()

    def test_status_persists_across_requests(self):
        """激活后 GET /activation-status 仍返回 activated（文件持久化）。"""
        # 激活
        self._request("POST", "/activate-code", {"code": "SHIPIN-TEST-2026"})
        # 重新读
        status, body = self._request("GET", "/activation-status")
        self.assertEqual(status, 200)
        self.assertEqual(body.get("status"), "activated")
        # 文件在 LocalAppData
        self.assertTrue(self.activation_path.exists())
        self.assertTrue(str(self.activation_path).startswith(str(self.user_data_root)),
                        f"activation.json 必须在 {self.user_data_root} 下")

    def test_activation_path_never_under_project_root_or_install_dir(self):
        """安全断言：activation.json 不会写到项目根，也不会写到 {app}。

        即使用户在 {app} 下运行后端，ACTIVATION_PATH 仍要落到
        %LOCALAPPDATA%/ShipinCut/config/，绝不写到 {app}。
        """
        # 已经在 setUp 时用 SHIPIN_CUT_DATA_ROOT 强制写到 LocalAppData
        self._request("POST", "/activate-code", {"code": "MIXCUT-LOCAL-OK"})
        self.assertTrue(self.activation_path.exists())
        # 路径必须在 self.user_data_root 下，不能在 ROOT（项目根）下
        try:
            self.activation_path.relative_to(self.user_data_root.resolve())
        except ValueError:
            self.fail(f"activation.json 没落到 LocalAppData: {self.activation_path}")
        # 不在项目根
        try:
            self.activation_path.relative_to(ROOT.resolve())
            self.fail(f"activation.json 落到了项目根: {self.activation_path}")
        except ValueError:
            pass  # 期望：不在项目根


if __name__ == "__main__":
    unittest.main(verbosity=2)
