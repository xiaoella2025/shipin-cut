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


def make_comp_input(tmp_path, template, output, videos, audio, subtitles):
    return {
        "title": output.name,
        "templateDraftDir": str(template),
        "outputDraftDir": str(output),
        "canvas": {"ratio": "9:16", "width": 1080, "height": 1920, "fps": 30},
        "segments": videos,
        "voice": {"path": str(audio), "timelineStartUs": 0, "durationUs": 7_000_000},
        "subtitles": subtitles,
    }


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

    def test_create_comp_draft_writes_single_video_audio_and_two_subtitles(self):
        create_comp = load_module(
            "create_comp_draft", "tools/jianying_draft/create_comp_draft.py"
        )
        template = make_template(self.tmp_path)
        video = self.tmp_path / "source.mp4"
        audio = self.tmp_path / "voice.mp3"
        video.write_bytes(b"video")
        audio.write_bytes(b"audio")
        output = self.tmp_path / "成品001"
        comp = make_comp_input(
            self.tmp_path,
            template,
            output,
            [
                {
                    "sourceVideo": str(video),
                    "sourceStartUs": 500_000,
                    "sourceDurationUs": 3_000_000,
                    "timelineStartUs": 0,
                    "timelineDurationUs": 3_000_000,
                    "speed": 1.0,
                }
            ],
            audio,
            [
                {"text": "第一句字幕", "startUs": 0, "durationUs": 1_200_000},
                {"text": "第二句字幕\n保留换行", "startUs": 1_400_000, "durationUs": 1_600_000},
            ],
        )

        result = create_comp.create_comp_draft_from_data(comp, overwrite=False)

        timeline = json.loads(result.timeline_template.read_text(encoding="utf-8"))
        tracks = {track["type"]: track for track in timeline["tracks"]}
        self.assertEqual(timeline["name"], "成品001")
        self.assertEqual(timeline["canvas_config"], {"ratio": "9:16", "width": 1080, "height": 1920})
        self.assertEqual(timeline["duration"], 7_000_000)
        self.assertEqual(len(timeline["materials"]["videos"]), 1)
        self.assertEqual(len(timeline["materials"]["audios"]), 1)
        self.assertEqual(len(timeline["materials"]["texts"]), 2)
        self.assertEqual([track["type"] for track in timeline["tracks"]], ["video", "audio", "text"])
        self.assertEqual(len(tracks["video"]["segments"]), 1)
        self.assertEqual(len(tracks["audio"]["segments"]), 1)
        self.assertEqual(len(tracks["text"]["segments"]), 2)
        self.assertEqual(tracks["video"]["segments"][0]["source_timerange"]["start"], 500_000)
        self.assertEqual(tracks["video"]["segments"][0]["target_timerange"]["duration"], 3_000_000)
        self.assertEqual(tracks["text"]["segments"][1]["target_timerange"]["start"], 1_400_000)
        self.assertEqual(
            timeline["materials"]["texts"][1]["recognize_text"],
            "第二句字幕\n保留换行",
        )

    def test_create_comp_draft_writes_multiple_video_segments_and_duration(self):
        create_comp = load_module(
            "create_comp_draft", "tools/jianying_draft/create_comp_draft.py"
        )
        template = make_template(self.tmp_path)
        audio = self.tmp_path / "voice.mp3"
        audio.write_bytes(b"audio")
        output = self.tmp_path / "成品多段"
        videos = []
        start = 0
        for index, duration in enumerate([1_000_000, 2_000_000, 1_500_000], start=1):
            source = self.tmp_path / f"source{index}.mp4"
            source.write_bytes(f"video-{index}".encode("utf-8"))
            videos.append(
                {
                    "sourceVideo": str(source),
                    "sourceStartUs": index * 100_000,
                    "sourceDurationUs": duration,
                    "timelineStartUs": start,
                    "timelineDurationUs": duration,
                    "speed": 1.0,
                }
            )
            start += duration
        comp = make_comp_input(
            self.tmp_path,
            template,
            output,
            videos,
            audio,
            [
                {"text": "字幕一", "startUs": 0, "durationUs": 800_000},
                {"text": "字幕二", "startUs": 1_000_000, "durationUs": 1_500_000},
                {"text": "字幕三", "startUs": 4_300_000, "durationUs": 2_000_000},
            ],
        )
        comp["voice"]["durationUs"] = 4_500_000

        result = create_comp.create_comp_draft_from_data(comp, overwrite=False)

        timeline = json.loads(result.timeline_template.read_text(encoding="utf-8"))
        video_track = next(track for track in timeline["tracks"] if track["type"] == "video")
        text_track = next(track for track in timeline["tracks"] if track["type"] == "text")
        self.assertEqual(len(video_track["segments"]), 3)
        self.assertEqual(
            [segment["target_timerange"]["start"] for segment in video_track["segments"]],
            [0, 1_000_000, 3_000_000],
        )
        self.assertEqual(
            [segment["source_timerange"]["start"] for segment in video_track["segments"]],
            [100_000, 200_000, 300_000],
        )
        self.assertEqual(timeline["duration"], 6_300_000)
        self.assertEqual(len(timeline["materials"]["videos"]), 3)
        self.assertEqual(len(text_track["segments"]), 3)
        self.assertTrue(
            (output / "Timelines" / result.timeline_id / "materials" / "video" / "source3.mp4").exists()
        )
        self.assertTrue(
            (output / "Timelines" / result.timeline_id / "materials" / "audio" / "voice.mp3").exists()
        )

    def test_create_comp_draft_accepts_utf8_bom_input_json(self):
        create_comp = load_module(
            "create_comp_draft", "tools/jianying_draft/create_comp_draft.py"
        )
        input_path = self.tmp_path / "current_comp_for_jianying.json"
        input_path.write_text("\ufeff{}", encoding="utf-8")

        data = create_comp.load_comp_input(input_path)

        self.assertEqual(data, {})


if __name__ == "__main__":
    unittest.main()
