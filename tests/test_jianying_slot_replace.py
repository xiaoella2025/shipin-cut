"""
Unit tests for template_slot_replace_draft.py.

These tests verify the slot-replacement strategy: preserve the template
timeline/opaque files and only replace existing material slots.
"""

import json
import sys
import tempfile
import unittest
import uuid
from pathlib import Path


ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools" / "jianying_draft"))

from inspect_draft import collect_material_paths, extract_texts, load_main_json
from template_slot_replace_draft import run


def _hex() -> str:
    return uuid.uuid4().hex


def _subtitle_content(text: str) -> str:
    return json.dumps(
        {
            "styles": [{"range": [0, len(text)], "size": 12.0}],
            "text": text,
        },
        ensure_ascii=False,
    )


def _make_template_data() -> dict:
    video_ids = [_hex() for _ in range(4)]
    audio_ids = [_hex() for _ in range(2)]
    text_ids = [_hex() for _ in range(4)]

    return {
        "id": "ACTIVE-TIMELINE-ID",
        "duration": 712099999,
        "fps": 30,
        "canvas_config": {"width": 1080, "height": 1920, "ratio": "original"},
        "materials": {
            "videos": [
                {
                    "id": mid,
                    "local_material_id": mid,
                    "material_name": f"old-{i}.png",
                    "path": f"Z:\\missing\\old-{i}.png",
                    "type": "photo",
                }
                for i, mid in enumerate(video_ids)
            ],
            "audios": [
                {
                    "id": mid,
                    "local_material_id": mid,
                    "music_id": mid,
                    "name": f"old-{i}",
                    "path": f"Z:\\missing\\old-{i}.mp3",
                    "type": "extract_music",
                }
                for i, mid in enumerate(audio_ids)
            ],
            "texts": [
                {
                    "id": mid,
                    "content": _subtitle_content(f"原始字幕 {i}"),
                    "type": "subtitle",
                    "name": f"原始字幕 {i}",
                }
                for i, mid in enumerate(text_ids)
            ],
            "speeds": [],
            "stickers": [],
            "effects": [],
            "transitions": [],
        },
        "tracks": [
            {
                "id": "video-track",
                "type": "video",
                "segments": [{"id": _hex(), "material_id": mid} for mid in video_ids],
            },
            {
                "id": "audio-track",
                "type": "audio",
                "segments": [{"id": _hex(), "material_id": mid} for mid in audio_ids],
            },
            {
                "id": "text-track",
                "type": "text",
                "segments": [{"id": _hex(), "material_id": mid} for mid in text_ids],
            },
        ],
        "keyframes": {},
        "keyframe_graph_list": [],
    }


def _write_template_dir(root: Path) -> Path:
    template = root / "template"
    template.mkdir()
    (template / "draft_info.json").write_text(
        json.dumps(_make_template_data(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (template / "draft_content.json").write_bytes(b"opaque-draft-content")
    (template / "draft_meta_info.json").write_bytes(b"opaque-meta")
    (template / "template-2.tmp").write_bytes(b"opaque-template-root")
    (template / "timeline_layout.json").write_text(
        json.dumps({"active_timeline_id": "ACTIVE-TIMELINE-ID"}),
        encoding="utf-8",
    )
    timeline_dir = template / "Timelines" / "ACTIVE-TIMELINE-ID"
    timeline_dir.mkdir(parents=True)
    (timeline_dir / "template-2.tmp").write_bytes(b"opaque-template-timeline")
    (timeline_dir / "project.json").write_text("{}", encoding="utf-8")
    return template


def _write_media(root: Path) -> tuple[list[Path], Path]:
    media = root / "media"
    media.mkdir()
    videos = []
    for index in range(1, 4):
        path = media / f"clip{index}.mp4"
        path.write_bytes(f"fake mp4 {index}".encode("ascii"))
        videos.append(path)
    audio = media / "audio.mp3"
    audio.write_bytes(b"fake mp3")
    return videos, audio


class _Args:
    def __init__(self, template: Path, output: Path, videos: list[Path], audio: Path):
        self.template = str(template)
        self.output = str(output)
        self.video = [str(path) for path in videos]
        self.audio = [str(audio)]
        self.subtitle = ["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"]


class TestJianyingSlotReplace(unittest.TestCase):
    def _run_replace(self, tmp: Path):
        template = _write_template_dir(tmp)
        videos, audio = _write_media(tmp)
        output = tmp / "output"
        result = run(_Args(template, output, videos, audio))
        return template, output, videos, audio, result

    def test_preserves_opaque_files(self):
        with tempfile.TemporaryDirectory() as td:
            template, output, *_ = self._run_replace(Path(td))
            pairs = [
                ("draft_content.json",),
                ("template-2.tmp",),
                ("draft_meta_info.json",),
                ("Timelines", "ACTIVE-TIMELINE-ID", "template-2.tmp"),
            ]
            for parts in pairs:
                self.assertEqual(
                    (template.joinpath(*parts)).read_bytes(),
                    (output.joinpath(*parts)).read_bytes(),
                )

    def test_preserves_timeline_layout_and_active_id(self):
        with tempfile.TemporaryDirectory() as td:
            template, output, *_ = self._run_replace(Path(td))
            self.assertEqual(
                (template / "timeline_layout.json").read_text(encoding="utf-8"),
                (output / "timeline_layout.json").read_text(encoding="utf-8"),
            )
            before = json.loads((template / "draft_info.json").read_text(encoding="utf-8"))
            after = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            self.assertEqual(after["id"], before["id"])

    def test_does_not_delete_tracks_or_segments(self):
        with tempfile.TemporaryDirectory() as td:
            template, output, *_ = self._run_replace(Path(td))
            before = json.loads((template / "draft_info.json").read_text(encoding="utf-8"))
            after = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            self.assertEqual(len(after["tracks"]), len(before["tracks"]))
            before_counts = [len(track["segments"]) for track in before["tracks"]]
            after_counts = [len(track["segments"]) for track in after["tracks"]]
            self.assertEqual(after_counts, before_counts)

    def test_copies_mp4_and_mp3_to_assets(self):
        with tempfile.TemporaryDirectory() as td:
            _, output, videos, audio, _ = self._run_replace(Path(td))
            for path in videos:
                self.assertTrue((output / "assets" / "video" / path.name).exists())
            self.assertTrue((output / "assets" / "audio" / audio.name).exists())

    def test_replaces_first_three_video_paths_and_first_audio_path(self):
        with tempfile.TemporaryDirectory() as td:
            _, output, videos, audio, _ = self._run_replace(Path(td))
            data = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            video_paths = [item["path"] for item in data["materials"]["videos"][:3]]
            audio_path = data["materials"]["audios"][0]["path"]
            for source, replaced in zip(videos, video_paths):
                self.assertEqual(Path(replaced).name, source.name)
                self.assertTrue(Path(replaced).exists())
            self.assertEqual(Path(audio_path).name, audio.name)
            self.assertTrue(Path(audio_path).exists())

    def test_fills_missing_remaining_media_paths_without_adding_slots(self):
        with tempfile.TemporaryDirectory() as td:
            _, output, *_ = self._run_replace(Path(td))
            data = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            self.assertEqual(len(data["materials"]["videos"]), 4)
            self.assertEqual(len(data["materials"]["audios"]), 2)
            missing = [path for path in collect_material_paths(data["materials"]) if not Path(path).exists()]
            self.assertEqual(missing, [])

    def test_replaces_first_three_subtitles(self):
        with tempfile.TemporaryDirectory() as td:
            _, output, *_ = self._run_replace(Path(td))
            data = json.loads((output / "draft_info.json").read_text(encoding="utf-8"))
            texts = extract_texts(data["materials"], limit=4)
            self.assertEqual(texts[:3], ["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"])

    def test_missing_input_media_exits(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            template = _write_template_dir(tmp)
            videos, audio = _write_media(tmp)
            videos[0].unlink()
            with self.assertRaises(SystemExit):
                run(_Args(template, tmp / "output", videos, audio))

    def test_existing_output_does_not_delete_template(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            template = _write_template_dir(tmp)
            videos, audio = _write_media(tmp)
            output = tmp / "output"
            output.mkdir()
            (output / "old.txt").write_text("old", encoding="utf-8")
            run(_Args(template, output, videos, audio))
            self.assertTrue((template / "draft_info.json").exists())
            self.assertFalse((output / "old.txt").exists())

    def test_refuses_output_equal_to_template(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            template = _write_template_dir(tmp)
            videos, audio = _write_media(tmp)
            with self.assertRaises(SystemExit):
                run(_Args(template, template, videos, audio))

    def test_inspect_helpers_read_replaced_output(self):
        with tempfile.TemporaryDirectory() as td:
            _, output, *_ = self._run_replace(Path(td))
            data, fname = load_main_json(output)
            self.assertEqual(fname, "draft_info.json")
            self.assertIsNotNone(data)
            paths = collect_material_paths(data["materials"])
            self.assertTrue(paths)
            self.assertEqual([path for path in paths if not Path(path).exists()], [])
            self.assertEqual(
                extract_texts(data["materials"], limit=3),
                ["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"],
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)
