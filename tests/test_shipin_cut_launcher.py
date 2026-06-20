import json
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
    def test_installer_bundles_frontend_dependencies(self):
        source = (ROOT / "installer" / "shipin-cut.iss").read_text(encoding="utf-8")
        self.assertIn('Source: "..\\node_modules\\*"', source)


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


if __name__ == "__main__":
    unittest.main(verbosity=2)
