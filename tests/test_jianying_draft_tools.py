import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name, relative_path):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def make_template(tmp_path):
    draft = tmp_path / "template"
    timeline_id = "TL-1"
    timeline = draft / "Timelines" / timeline_id
    timeline.mkdir(parents=True)
    (draft / "Resources").mkdir()
    (draft / "draft_content.json").write_text("encrypted-content", encoding="utf-8")
    (draft / "draft_meta_info.json").write_text("encrypted-meta", encoding="utf-8")
    write_json(
        draft / "Timelines" / "project.json",
        {
            "id": "PROJECT-1",
            "main_timeline_id": timeline_id,
            "timelines": [{"id": timeline_id, "name": "时间线01"}],
            "create_time": 1,
            "update_time": 1,
            "version": 0,
        },
    )
    base = {
        "id": "OLD-DRAFT",
        "name": "old",
        "duration": 0,
        "fps": 30,
        "canvas_config": {"height": 1280, "ratio": "9:16", "width": 720},
        "materials": {
            "videos": [],
            "audios": [],
            "texts": [],
            "speeds": [],
            "sound_channel_mappings": [],
        },
        "tracks": [],
    }
    write_json(timeline / "template.tmp", base)
    write_json(timeline / "template.json", base)
    return draft


class JianyingDraftToolsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.tmp_path = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_inspect_draft_reads_timeline_template(self):
        inspect_draft = load_module(
            "inspect_draft", "tools/jianying_draft/inspect_draft.py"
        )
        draft = make_template(self.tmp_path)

        summary = inspect_draft.inspect_draft(draft)

        self.assertIs(summary["draft_content_found"], True)
        self.assertIs(summary["draft_meta_info_found"], True)
        self.assertIs(summary["draft_content_parseable"], False)
        self.assertIs(summary["timeline_template_found"], True)
        self.assertEqual(summary["draft_name"], "old")
        self.assertEqual(summary["duration"], 0)
        self.assertEqual(summary["tracks_count"], 0)
        self.assertEqual(summary["materials_counts"]["videos"], 0)

    def test_create_minimal_draft_writes_video_audio_and_subtitle(self):
        create_minimal = load_module(
            "create_minimal_draft", "tools/jianying_draft/create_minimal_draft.py"
        )
        template = make_template(self.tmp_path)
        video = self.tmp_path / "source.mp4"
        audio = self.tmp_path / "voice.mp3"
        video.write_bytes(b"video")
        audio.write_bytes(b"audio")
        output = self.tmp_path / "out-draft"

        result = create_minimal.create_minimal_draft(
            template_dir=template,
            output_dir=output,
            video_path=video,
            audio_path=audio,
            title="测试导出草稿",
            subtitle="这是从 shipin-cut 导出的测试字幕",
            duration_us=3_000_000,
            overwrite=False,
        )

        timeline_json = json.loads(result.timeline_template.read_text(encoding="utf-8"))
        timeline_id = result.timeline_id
        self.assertTrue(
            (output / "Timelines" / timeline_id / "materials" / "video" / "source.mp4").exists()
        )
        self.assertTrue(
            (output / "Timelines" / timeline_id / "materials" / "audio" / "voice.mp3").exists()
        )
        self.assertEqual(timeline_json["name"], "测试导出草稿")
        self.assertEqual(timeline_json["duration"], 3_000_000)
        self.assertEqual(timeline_json["materials"]["videos"][0]["path"], "materials/video/source.mp4")
        self.assertEqual(timeline_json["materials"]["audios"][0]["path"], "materials/audio/voice.mp3")
        self.assertEqual(
            timeline_json["materials"]["texts"][0]["recognize_text"],
            "这是从 shipin-cut 导出的测试字幕",
        )
        self.assertEqual([track["type"] for track in timeline_json["tracks"]], ["video", "audio", "text"])

    def test_create_minimal_draft_cli_reports_output(self):
        template = make_template(self.tmp_path)
        video = self.tmp_path / "source.mp4"
        audio = self.tmp_path / "voice.mp3"
        video.write_bytes(b"video")
        audio.write_bytes(b"audio")
        output = self.tmp_path / "out-draft"

        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "tools" / "jianying_draft" / "create_minimal_draft.py"),
                "--template",
                str(template),
                "--output",
                str(output),
                "--video",
                str(video),
                "--audio",
                str(audio),
                "--title",
                "测试导出草稿",
                "--duration-seconds",
                "2",
            ],
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        self.assertIn("已生成剪映草稿", completed.stdout)
        self.assertIn(str(output), completed.stdout)


if __name__ == "__main__":
    unittest.main()
