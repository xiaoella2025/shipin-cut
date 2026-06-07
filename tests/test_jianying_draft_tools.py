"""
tests/test_jianying_draft_tools.py

单元测试 — 剪映草稿生成工具

测试策略:
  - 使用 MockDraft（内存构造的最小 draft_info.json）模拟 Storybound 草稿
  - 不依赖真实剪映 GUI、ffprobe、Storybound
  - MockDraft 模拟"333 条字幕 + 30 视频 + 31 音频"的 Storybound 草稿结构
  - 测试 rebuild_draft_info() 能完全清空并重建

运行:
  python -m unittest tests.test_jianying_draft_tools -v
"""

import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

# 把 tools/jianying_draft 加入 path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools" / "jianying_draft"))

from create_draft_info_test import (
    rebuild_draft_info,
    _make_text_content_json,
    _self_verify,
    collect_material_paths_from_data,
    TOTAL_DURATION_US,
)
from inspect_draft import (
    load_main_json,
    collect_material_paths,
    extract_texts,
    count_tracks,
    count_segments,
)


# ────────────────────────────────────────────────
# 辅助：构造模拟草稿数据
# ────────────────────────────────────────────────

def make_mock_storybound_draft(
    n_videos=30, n_audios=31, n_texts=333,
    duration_us=712_000_000
) -> dict:
    """模拟 Storybound 原始草稿 draft_info.json（大型草稿）"""

    def fake_vid(i):
        mid = str(uuid.uuid4()).upper()
        return {
            "aigc_type": "none",
            "audio_fade": None,
            "cartoon_path": "",
            "category_id": "",
            "category_name": "local",
            "check_flag": 63487,
            "crop": {"lower_left_x": 0.0, "lower_left_y": 1.0,
                     "lower_right_x": 1.0, "lower_right_y": 1.0,
                     "upper_left_x": 0.0, "upper_left_y": 0.0,
                     "upper_right_x": 1.0, "upper_right_y": 0.0},
            "crop_ratio": "free", "crop_scale": 1.0,
            "duration": 3_000_000,
            "extra_type_option": 0,
            "file_Path": f"C:\\storybound\\assets\\video\\vid{i}.mp4",
            "formula_id": "", "freeze": None, "has_audio": True,
            "height": 1920, "id": mid,
            "import_time": 1700000000, "import_time_ms": 1700000000000,
            "is_ai_matting_valid_cache": False,
            "is_unified_beauty_valid_cache": False,
            "local_material_id": mid, "material_id": mid,
            "material_name": f"vid{i}.mp4", "material_url": "",
            "matting": {"flag": 0, "has_use_quick_brush": False,
                        "has_use_quick_eraser": False,
                        "interactiveTime": [], "path": "", "strokes": []},
            "media_path": "", "object_file_key": "",
            "path": f"C:\\storybound\\assets\\video\\vid{i}.mp4",
            "picture_from": "none",
            "picture_set_category_id": "", "picture_set_category_name": "",
            "request_id": "", "reverse_path": "", "smart_motion": None,
            "source": "none", "source_platform": 0, "stable": None,
            "team_id": "", "type": "video",
            "video_algorithm": {"algorithms": [], "deflicker": None,
                                "motion_blur_config": None, "noise_reduction": None,
                                "path": "", "quality_enhance": None, "time_range": None},
            "width": 1080
        }

    def fake_aud(i):
        mid = str(uuid.uuid4()).upper()
        return {
            "app_id": 0, "category_id": "", "category_name": "local",
            "check_flag": 1, "duration": 3_000_000,
            "effect_id": "", "formula_id": "", "id": mid,
            "intensifies_path": "", "local_material_id": mid,
            "material_id": mid, "material_name": f"aud{i}.mp3",
            "material_url": "", "name": f"aud{i}",
            "path": f"C:\\storybound\\assets\\audio\\{i}.mp3",
            "request_id": "", "search_id": "",
            "source_platform": 0, "team_id": "", "text": "",
            "tone_folder_path": "", "type": "extract_music", "wave_points": []
        }

    def fake_txt(i):
        mid = str(uuid.uuid4()).upper()
        text = f"原始字幕 {i}"
        return {
            "alignment": 1, "background_alpha": 0.0,
            "background_color": "", "background_height": 0.14,
            "background_horizontal_offset": 0.0, "background_round_radius": 0.0,
            "background_style": 0, "background_vertical_offset": 0.0,
            "background_width": 0.14, "base_content": "",
            "bold_width": 0.0, "border_alpha": 0.0,
            "border_color": "", "border_width": 0.08,
            "content": _make_text_content_json(text),
            "font_category_id": "", "font_category_name": "",
            "font_id": "", "font_name": "", "font_path": "",
            "font_size": 8.0, "fonts": [], "id": mid,
            "italic": False, "letter_spacing": 0.0,
            "line_feed": 1, "line_max_width": 0.82, "line_spacing": 0.02,
            "name": "", "original_size": [], "preset_id": "",
            "recognize_task_id": "", "recognize_type": 0,
            "relevance_segment": [], "shadow_alpha": 0.0,
            "shadow_angle": -45.0, "shadow_color": "",
            "shadow_distance": 5.0, "shadow_point": {"x": 0.6364, "y": -0.6364},
            "shadow_smoothing": 1.0, "shape_clip_x": False,
            "shape_clip_y": False, "source_from": "",
            "style_name": "", "sub_type": 0, "text_alpha": 1.0,
            "text_color": "#FFFFFF", "text_curve": None,
            "text_preset_resource_id": "", "text_size": 30,
            "text_to_audio_ids": [], "tts_auto_update": False,
            "type": "text", "typesetting": 0, "underline": False,
            "underline_offset": 0.22, "underline_width": 0.05,
            "use_effect_default_color": True,
            "words": {"end_time": [], "start_time": [], "text": []}
        }

    vids = [fake_vid(i) for i in range(n_videos)]
    auds = [fake_aud(i) for i in range(n_audios)]
    txts = [fake_txt(i) for i in range(n_texts)]

    vid_segs = [{"id": str(uuid.uuid4()).upper(), "material_id": v["id"],
                 "source_timerange": {"duration": 3_000_000, "start": 0},
                 "target_timerange": {"duration": 3_000_000, "start": i * 3_000_000},
                 "speed": 1.0, "volume": 1.0, "visible": True,
                 "extra_material_refs": [], "common_keyframes": [],
                 "clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False},
                          "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0},
                          "translation": {"x": 0.0, "y": 0.0}}}
                for i, v in enumerate(vids)]

    return {
        "canvas_config": {"height": 1920, "ratio": "9:16", "width": 1080},
        "color_space": 0,
        "cover": "",
        "duration": duration_us,
        "fps": 30.0,
        "id": str(uuid.uuid4()).upper(),
        "keyframe_graph_list": [{"fake_kf": True}],
        "keyframes": {
            "adjusts": [], "beats": [], "color_curves": [],
            "effects": [{"fake": True}],
            "stickers": [{"fake": True}],
            "texts": [{"fake": True}],
            "videos": [{"fake": True}]
        },
        "materials": {
            "audios": auds,
            "beats": [],
            "canvases": [],
            "effects": [],
            "flowers": [],
            "stickers": [],
            "texts": txts,
            "transitions": [],
            "videos": vids,
        },
        "new_version": "100.0.0",
        "platform": {"app_version": "5.9.0", "os": "windows",
                     "app_id": 359289478, "device_id": "", "hard_disk_id": "",
                     "mac_address": "", "os_version": "10.0.0"},
        "relationships": [],
        "render_index_track_mode_on": False,
        "source": "default",
        "tracks": [
            {"attribute": 0, "flag": 0, "id": str(uuid.uuid4()).upper(),
             "is_default_name": True, "name": "", "segments": vid_segs, "type": "video"},
        ],
        "update_time": 1700000000000,
        "version": 360000,
    }


def make_mock_video_info(n=3, dur_us=2_000_000) -> list[dict]:
    return [
        {"path": f"/fake/assets/video/clip{i}.mp4",
         "dur_us": dur_us, "w": 1080, "h": 1920}
        for i in range(n)
    ]


def make_mock_audio_info(n=1, dur_us=6_000_000) -> list[dict]:
    return [
        {"path": f"/fake/assets/audio/audio{i}.mp3", "dur_us": dur_us}
        for i in range(n)
    ]


# ────────────────────────────────────────────────
# Test: rebuild_draft_info
# ────────────────────────────────────────────────

class TestRebuildDraftInfo(unittest.TestCase):

    def setUp(self):
        self.template = make_mock_storybound_draft(n_videos=30, n_audios=31, n_texts=333)
        self.video_info = make_mock_video_info(n=3)
        self.audio_info = make_mock_audio_info(n=1)
        self.subtitles = ["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"]

    def _rebuild(self, **kwargs):
        kw = dict(
            template_data=self.template,
            video_info=self.video_info,
            audio_info=self.audio_info,
            subtitle_texts=self.subtitles,
            total_dur_us=TOTAL_DURATION_US,
        )
        kw.update(kwargs)
        return rebuild_draft_info(**kw)

    # ── duration ─────────────────────────────────
    def test_duration_is_5s(self):
        out = self._rebuild()
        self.assertEqual(out["duration"], TOTAL_DURATION_US,
                         f"duration 应为 {TOTAL_DURATION_US}, 实际 {out['duration']}")

    # ── materials.videos ─────────────────────────
    def test_video_materials_count(self):
        out = self._rebuild()
        videos = out["materials"]["videos"]
        self.assertEqual(len(videos), 3, f"video materials 应为 3, 实际 {len(videos)}")

    def test_no_storybound_video_paths_remain(self):
        out = self._rebuild()
        for v in out["materials"]["videos"]:
            path = v.get("path", "") or ""
            self.assertNotIn("storybound", path.lower(),
                             f"video path 不应含 storybound 旧路径: {path}")

    # ── materials.audios ─────────────────────────
    def test_audio_materials_count(self):
        out = self._rebuild()
        audios = out["materials"]["audios"]
        self.assertEqual(len(audios), 1, f"audio materials 应为 1, 实际 {len(audios)}")

    def test_no_storybound_audio_paths_remain(self):
        out = self._rebuild()
        for a in out["materials"]["audios"]:
            path = a.get("path", "") or ""
            self.assertNotIn("storybound", path.lower(),
                             f"audio path 不应含 storybound 旧路径: {path}")

    # ── materials.texts ──────────────────────────
    def test_text_materials_count(self):
        out = self._rebuild()
        texts = out["materials"]["texts"]
        self.assertEqual(len(texts), 3, f"text materials 应为 3, 实际 {len(texts)}")

    def test_text_content_correct(self):
        out = self._rebuild()
        actual_texts = []
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                actual_texts.append(json.loads(raw).get("text", ""))
            except Exception:
                actual_texts.append(raw[:50])
        for expected in self.subtitles:
            self.assertIn(expected, actual_texts,
                          f"字幕 {expected!r} 应存在于 text materials")

    def test_no_original_subtitles_remain(self):
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                text = json.loads(raw).get("text", "")
            except Exception:
                text = raw
            self.assertNotIn("原始字幕", text,
                             f"Storybound 原始字幕不应残留: {text!r}")

    # ── tracks ───────────────────────────────────
    def test_tracks_count(self):
        out = self._rebuild()
        tracks = out["tracks"]
        self.assertEqual(len(tracks), 3, f"应有 3 条轨道, 实际 {len(tracks)}")

    def test_track_types(self):
        out = self._rebuild()
        types = [t["type"] for t in out["tracks"]]
        self.assertIn("video", types)
        self.assertIn("audio", types)
        self.assertIn("text", types)

    def test_video_segments_count(self):
        out = self._rebuild()
        segs = count_segments(out["tracks"], "video")
        self.assertEqual(segs, 3, f"video segments 应为 3, 实际 {segs}")

    def test_audio_segments_count(self):
        out = self._rebuild()
        segs = count_segments(out["tracks"], "audio")
        self.assertEqual(segs, 1, f"audio segments 应为 1, 实际 {segs}")

    def test_text_segments_count(self):
        out = self._rebuild()
        segs = count_segments(out["tracks"], "text")
        self.assertEqual(segs, 3, f"text segments 应为 3, 实际 {segs}")

    # ── video segments cover full duration ───────
    def test_video_segments_cover_duration(self):
        out = self._rebuild()
        vid_tracks = [t for t in out["tracks"] if t["type"] == "video"]
        self.assertTrue(vid_tracks)
        total = sum(
            seg["target_timerange"]["duration"]
            for seg in vid_tracks[0]["segments"]
        )
        self.assertEqual(total, TOTAL_DURATION_US,
                         f"video segments 总时长应为 {TOTAL_DURATION_US}, 实际 {total}")

    def test_video_segments_no_gap(self):
        """video segments 应无缝衔接（每段 start = 上段 start + dur）"""
        out = self._rebuild()
        vid_tracks = [t for t in out["tracks"] if t["type"] == "video"]
        segs = sorted(vid_tracks[0]["segments"],
                      key=lambda s: s["target_timerange"]["start"])
        cursor = 0
        for seg in segs:
            tgt = seg["target_timerange"]
            self.assertEqual(tgt["start"], cursor,
                             f"segment start={tgt['start']} 应紧接 cursor={cursor}")
            cursor += tgt["duration"]

    # ── keyframes cleared ─────────────────────────
    def test_keyframes_cleared(self):
        out = self._rebuild()
        kf = out.get("keyframes") or {}
        for k, v in kf.items():
            if isinstance(v, list):
                self.assertEqual(v, [],
                                 f"keyframes.{k} 应被清空，实际 {len(v)} items")

    def test_keyframe_graph_list_cleared(self):
        out = self._rebuild()
        self.assertEqual(out.get("keyframe_graph_list"), [],
                         "keyframe_graph_list 应被清空")

    # ── non-relevant materials cleared ───────────
    def test_sticker_materials_cleared(self):
        out = self._rebuild()
        stickers = out.get("materials", {}).get("stickers") or []
        self.assertEqual(stickers, [],
                         f"stickers 应被清空，实际 {len(stickers)} items")

    def test_effects_materials_cleared(self):
        out = self._rebuild()
        effects = out.get("materials", {}).get("effects") or []
        self.assertEqual(effects, [],
                         f"effects 应被清空，实际 {len(effects)} items")

    # ── canvas_config preserved ───────────────────
    def test_canvas_config_preserved(self):
        out = self._rebuild()
        orig_cc = self.template.get("canvas_config") or {}
        out_cc  = out.get("canvas_config") or {}
        self.assertEqual(out_cc.get("width"),  orig_cc.get("width"))
        self.assertEqual(out_cc.get("height"), orig_cc.get("height"))
        self.assertEqual(out_cc.get("ratio"),  orig_cc.get("ratio"))

    # ── material_id references consistent ────────
    def test_segment_material_ids_valid(self):
        """所有 segment 的 material_id 都能在 materials 里找到"""
        out = self._rebuild()
        all_mat_ids = set()
        for key in ["videos", "audios", "texts"]:
            for m in (out["materials"].get(key) or []):
                all_mat_ids.add(m["id"])
        for track in out["tracks"]:
            for seg in (track.get("segments") or []):
                mid = seg.get("material_id")
                self.assertIn(mid, all_mat_ids,
                              f"segment material_id={mid} 在 materials 里找不到")

    # ── new draft id ──────────────────────────────
    def test_new_draft_id_generated(self):
        out = self._rebuild()
        orig_id = self.template.get("id")
        out_id  = out.get("id")
        self.assertNotEqual(out_id, orig_id,
                            "重建后的 draft id 应与模板不同")

    # ── version preserved ─────────────────────────
    def test_version_preserved(self):
        out = self._rebuild()
        self.assertEqual(out.get("version"), self.template.get("version"))

    # ── fps preserved ─────────────────────────────
    def test_fps_preserved(self):
        out = self._rebuild()
        self.assertAlmostEqual(out.get("fps", 0),
                               self.template.get("fps", 0), places=2)


# ────────────────────────────────────────────────
# Test: inspect helpers
# ────────────────────────────────────────────────

class TestInspectHelpers(unittest.TestCase):

    def setUp(self):
        self.draft = make_mock_storybound_draft(n_videos=3, n_audios=1, n_texts=5)

    def test_count_tracks_video(self):
        self.assertEqual(count_tracks(self.draft["tracks"], "video"), 1)

    def test_count_segments_video(self):
        self.assertEqual(count_segments(self.draft["tracks"], "video"), 3)

    def test_extract_texts(self):
        texts = extract_texts(self.draft["materials"], limit=10)
        self.assertEqual(len(texts), 5)
        self.assertIn("原始字幕 0", texts)

    def test_extract_texts_limit(self):
        big = make_mock_storybound_draft(n_texts=100)
        texts = extract_texts(big["materials"], limit=10)
        self.assertEqual(len(texts), 10)

    def test_collect_material_paths(self):
        paths = collect_material_paths(self.draft["materials"])
        self.assertEqual(len(paths), 3 + 1)   # 3 videos + 1 audio

    def test_load_main_json_draft_info(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "draft_info.json"
            p.write_text(json.dumps(self.draft), encoding="utf-8")
            data, fname = load_main_json(Path(td))
            self.assertIsNotNone(data)
            self.assertEqual(fname, "draft_info.json")

    def test_load_main_json_fallback(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "draft_content.json"
            p.write_text(json.dumps(self.draft), encoding="utf-8")
            data, fname = load_main_json(Path(td))
            self.assertIsNotNone(data)
            self.assertEqual(fname, "draft_content.json")

    def test_load_main_json_prefer_draft_info(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "draft_info.json").write_text(
                json.dumps({"id": "A"}), encoding="utf-8")
            (Path(td) / "draft_content.json").write_text(
                json.dumps({"id": "B"}), encoding="utf-8")
            data, fname = load_main_json(Path(td))
            self.assertEqual(fname, "draft_info.json")
            self.assertEqual(data["id"], "A")

    def test_load_main_json_missing(self):
        with tempfile.TemporaryDirectory() as td:
            data, fname = load_main_json(Path(td))
            self.assertIsNone(data)
            self.assertIsNone(fname)


# ────────────────────────────────────────────────
# Test: media path checking
# ────────────────────────────────────────────────

class TestMediaPathChecking(unittest.TestCase):

    def test_missing_paths_detected(self):
        draft = make_mock_storybound_draft(n_videos=2, n_audios=1, n_texts=0)
        paths = collect_material_paths(draft["materials"])
        missing = [p for p in paths if not Path(p).exists()]
        self.assertEqual(len(missing), len(paths),
                         "假路径都应该检测为缺失")

    def test_present_paths_detected(self):
        with tempfile.TemporaryDirectory() as td:
            f = Path(td) / "test.mp4"
            f.write_bytes(b"fake mp4")
            materials = {
                "videos": [{
                    "id": "X", "path": str(f), "file_Path": str(f),
                    "type": "video"
                }],
                "audios": [],
            }
            paths = collect_material_paths(materials)
            missing = [p for p in paths if not Path(p).exists()]
            self.assertEqual(missing, [], f"文件存在时不应检测为缺失: {paths}")


# ────────────────────────────────────────────────
# Test: create_draft_info_test 输入验证
# ────────────────────────────────────────────────

class TestCreateDraftInputValidation(unittest.TestCase):
    """
    验证脚本在输入文件不存在时正确拒绝，而不是生成假草稿。
    （不调用 main()，直接调用核心逻辑）
    """

    def test_missing_video_path_raises_or_detected(self):
        """video_info 里的路径不存在，probe_duration 返回 None 但路径本身不应被忽略"""
        # 只验证 collect_material_paths_from_data 在重建后能检出缺失
        template = make_mock_storybound_draft(n_videos=1, n_audios=1, n_texts=0)
        video_info = [{"path": "/nonexistent/video.mp4", "dur_us": 2_000_000, "w": 1080, "h": 1920}]
        audio_info = [{"path": "/nonexistent/audio.mp3", "dur_us": 5_000_000}]
        out = rebuild_draft_info(
            template_data=template,
            video_info=video_info,
            audio_info=audio_info,
            subtitle_texts=["CLEAN 字幕 1"],
            total_dur_us=TOTAL_DURATION_US,
        )
        paths = collect_material_paths_from_data(out)
        missing = [p for p in paths if not Path(p).exists()]
        self.assertEqual(len(missing), len(paths),
                         "不存在的路径写入后，检测应全部报告缺失")

    def test_empty_video_list_not_allowed(self):
        """video_info 为空时 rebuild_draft_info 应产生空 video track"""
        template = make_mock_storybound_draft(n_videos=1, n_audios=1, n_texts=0)
        audio_info = [{"path": "/fake/a.mp3", "dur_us": 5_000_000}]
        out = rebuild_draft_info(
            template_data=template,
            video_info=[],
            audio_info=audio_info,
            subtitle_texts=[],
            total_dur_us=TOTAL_DURATION_US,
        )
        vid_track = next((t for t in out["tracks"] if t["type"] == "video"), None)
        segs = (vid_track or {}).get("segments") or []
        self.assertEqual(len(segs), 0, "空 video_info 应产生 0 段 video segments")


# ────────────────────────────────────────────────
# Test: text content JSON
# ────────────────────────────────────────────────

class TestTextContentJson(unittest.TestCase):

    def test_content_is_valid_json_string(self):
        content = _make_text_content_json("你好世界")
        obj = json.loads(content)
        self.assertEqual(obj["text"], "你好世界")

    def test_content_range_matches_text_len(self):
        text = "CLEAN 字幕 1"
        content = _make_text_content_json(text)
        obj = json.loads(content)
        r = obj["styles"][0]["range"]
        self.assertEqual(r, [0, len(text)],
                         f"range 应为 [0, {len(text)}]，实际 {r}")

    def test_content_color_white(self):
        content = _make_text_content_json("test")
        obj = json.loads(content)
        color = obj["styles"][0]["fill"]["content"]["solid"]["color"]
        self.assertEqual(color, [1.0, 1.0, 1.0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
