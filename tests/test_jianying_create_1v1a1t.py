import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools" / "jianying_draft"))

from create_1v1a1t import run
from inspect_draft import collect_material_paths, count_segments, extract_texts


def make_template(root: Path) -> Path:
    template = root / "template"
    template.mkdir()
    data = {
        "id": "TEMPLATE-ID",
        "duration": 712099999,
        "fps": 30,
        "canvas_config": {"width": 1080, "height": 1920, "ratio": "original"},
        "materials": {
            "videos": [{"id": "old-video", "path": "Z:\\old\\v.mp4"}],
            "audios": [{"id": "old-audio", "path": "Z:\\old\\a.mp3"}],
            "texts": [{"id": "old-text", "content": "{\"text\":\"old\"}"}],
            "speeds": [{"id": "old-speed"}],
            "material_animations": [{"id": "old-animation"}],
        },
        "tracks": [{"id": "old-track", "type": "video", "segments": []}],
        "keyframes": {},
        "keyframe_graph_list": [],
    }
    (template / "draft_info.json").write_text(
        json.dumps(data, ensure_ascii=False), encoding="utf-8"
    )
    (template / "draft_content.json").write_bytes(b"opaque-content")
    (template / "draft_meta_info.json").write_bytes(b"opaque-meta")
    (template / "template-2.tmp").write_bytes(b"opaque-template")
    (template / "timeline_layout.json").write_text("{}", encoding="utf-8")
    (template / "Timelines").mkdir()
    return template


def make_media(root: Path) -> tuple[Path, Path]:
    video = root / "clip-source.mp4"
    audio = root / "audio-source.mp3"
    video.write_bytes(b"fake mp4")
    audio.write_bytes(b"fake mp3")
    return video, audio


class Args:
    def __init__(self, template: Path, output: Path, video: Path, audio: Path):
        self.template = str(template)
        self.output = str(output)
        self.video = str(video)
        self.audio = str(audio)
        self.subtitle = "这是我的第一个测试草稿"
        self.duration = 5_000_000
        self.video_duration = None
        self.audio_duration = None


class TestCreate1V1A1T(unittest.TestCase):
    def test_generates_minimal_draft(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            template = make_template(root)
            video, audio = make_media(root)
            output = root / "output"

            run(Args(template, output, video, audio))

            data = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            self.assertEqual(data["id"], "TEMPLATE-ID")
            self.assertEqual(data["duration"], 5_000_000)
            self.assertEqual(count_segments(data["tracks"], "video"), 1)
            self.assertEqual(count_segments(data["tracks"], "audio"), 1)
            self.assertEqual(count_segments(data["tracks"], "text"), 1)
            self.assertEqual(extract_texts(data["materials"], limit=1), ["这是我的第一个测试草稿"])
            self.assertEqual([p for p in collect_material_paths(data["materials"]) if not Path(p).exists()], [])
            self.assertEqual(data["materials"].get("speeds"), [])
            self.assertEqual(data["materials"].get("material_animations"), [])
            self.assertEqual(
                (template / "draft_content.json").read_bytes(),
                (output / "draft_content.json").read_bytes(),
            )

    def test_missing_template_exits(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            video, audio = make_media(root)
            with self.assertRaises(SystemExit):
                run(Args(root / "missing", root / "output", video, audio))

    def test_missing_video_exits(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            template = make_template(root)
            _, audio = make_media(root)
            with self.assertRaises(SystemExit):
                run(Args(template, root / "output", root / "missing.mp4", audio))

    def test_missing_audio_exits(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            template = make_template(root)
            video, _ = make_media(root)
            with self.assertRaises(SystemExit):
                run(Args(template, root / "output", video, root / "missing.mp3"))

    def test_existing_output_does_not_delete_template(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            template = make_template(root)
            video, audio = make_media(root)
            output = root / "output"
            output.mkdir()
            (output / "old.txt").write_text("old", encoding="utf-8")

            run(Args(template, output, video, audio))

            self.assertTrue((template / "draft_info.json").exists())
            self.assertFalse((output / "old.txt").exists())


if __name__ == "__main__":
    unittest.main(verbosity=2)
