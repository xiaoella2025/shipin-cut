import json
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
            user_data_root = Path(td) / "ShipinCut"
            paths = launcher.ensure_user_data_dirs(user_data_root)

            config_path = launcher.prepare_runtime_vite_config(
                paths["runtime"], paths["cache"] / "vite"
            )
            source = config_path.read_text(encoding="utf-8")

            self.assertEqual(config_path.parent, user_data_root / "runtime")
            self.assertIn("/shipin-cut/", source)
            self.assertIn((paths["cache"] / "vite").as_posix(), source)

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
