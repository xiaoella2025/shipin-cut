"""
tests/test_jianying_draft_tools.py

单元测试 — 剪映草稿生成工具

数据来源：
  mock draft 结构基于真实 Storybound 草稿包分析
  （storybound_draft_structure_pack.zip，2026-06-07）

运行：
  python -m unittest tests.test_jianying_draft_tools -v
"""

import json
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools" / "jianying_draft"))

from create_draft_info_test import (
    rebuild_draft_info,
    _make_subtitle_content,
    collect_material_paths_from_data,
    TOTAL_DURATION_US,
    new_hex_id,
    run,
)
from inspect_draft import (
    load_main_json,
    collect_material_paths,
    extract_texts,
    count_tracks,
    count_segments,
)


# ────────────────────────────────────────────────
# Mock 草稿构造（基于真实 Storybound 字段结构）
# ────────────────────────────────────────────────

def _hex() -> str:
    return uuid.uuid4().hex


def _make_photo_material(i):
    """Storybound 的 photo 类型素材"""
    mid = _hex()
    return {
        "audio_fade": None, "category_id": "", "category_name": "local",
        "check_flag": 63487,
        "crop": {"upper_left_x": 0.0, "upper_left_y": 0.0,
                 "upper_right_x": 1.0, "upper_right_y": 0.0,
                 "lower_left_x": 0.0, "lower_left_y": 1.0,
                 "lower_right_x": 1.0, "lower_right_y": 1.0},
        "crop_ratio": "free", "crop_scale": 1.0,
        "duration": 10800000000, "height": 1920,
        "id": mid, "local_material_id": "", "material_id": mid,
        "material_name": f"{i}.png", "media_path": "",
        "path": f"D:\\storybound\\assets\\image\\{i}.png",
        "remote_url": None, "type": "photo", "width": 1080
    }


def _make_audio_material(i):
    mid = _hex()
    return {
        "app_id": 0, "category_id": "", "category_name": "local",
        "check_flag": 1, "copyright_limit_type": "none",
        "duration": 10200000, "effect_id": "", "formula_id": "",
        "id": mid, "intensifies_path": "",
        "is_ai_clone_tone": False, "is_text_edit_overdub": False, "is_ugc": False,
        "local_material_id": mid, "music_id": mid,
        "name": f"{i}.mp3",
        "path": f"D:\\storybound\\assets\\audio\\{i}.mp3",
        "remote_url": None, "query": "", "request_id": "", "resource_id": "",
        "search_id": "", "source_from": "", "source_platform": 0,
        "team_id": "", "text_id": "",
        "tone_category_id": "", "tone_category_name": "",
        "tone_effect_id": "", "tone_effect_name": "", "tone_platform": "",
        "tone_second_category_id": "", "tone_second_category_name": "",
        "tone_speaker": "", "tone_type": "",
        "type": "extract_music", "video_id": "", "wave_points": []
    }


def _make_subtitle_material(i):
    mid = _hex()
    text = f"原始字幕 {i}"
    return {
        "id": mid,
        "content": _make_subtitle_content(text),
        "typesetting": 0, "alignment": 1,
        "letter_spacing": 0.0, "line_spacing": 0.02,
        "line_feed": 1, "line_max_width": 1.0,
        "force_apply_line_max_width": False,
        "check_flag": 31, "type": "subtitle",
        "fixed_width": -1, "fixed_height": -1,
        "font_category_id": "", "font_category_name": "",
        "font_id": "", "font_name": "", "font_path": "",
        "font_resource_id": "", "font_size": 15.0,
        "font_source_platform": 0, "font_team_id": "",
        "font_title": "none", "font_url": "", "fonts": [],
        "background_style": 0, "background_color": "#000000",
        "background_alpha": 0.5, "background_round_radius": 0.3,
        "background_height": 0.14, "background_width": 0.14,
        "background_horizontal_offset": 0.0, "background_vertical_offset": 0.0,
        "sub_type": 0, "recognize_type": 0, "is_rich_text": True,
        "caption_template_info": {
            "category_id": "", "category_name": "", "effect_id": "",
            "is_new": False, "path": "", "request_id": "",
            "resource_id": "", "resource_name": "", "source_platform": 0
        },
        "combo_info": {"text_templates": []},
        "words": {"end_time": [], "start_time": [], "text": []},
        "subtitle_keywords": None
    }


def _make_speed(i):
    return {"curve_speed": None, "id": _hex(), "mode": 0, "speed": None, "type": "speed"}


def _make_video_segment(mat_id, start=0, dur=10200000):
    spd = _hex()
    return {
        "enable_adjust": True, "enable_color_correct_adjust": False,
        "enable_color_curves": True, "enable_color_match_adjust": False,
        "enable_color_wheels": True, "enable_lut": True,
        "enable_smart_color_adjust": False, "last_nonzero_volume": 1.0,
        "reverse": False, "track_attribute": 0, "track_render_index": 0, "visible": True,
        "id": _hex(), "material_id": mat_id,
        "target_timerange": {"start": start, "duration": dur},
        "source_timerange": {"start": 0, "duration": dur},
        "common_keyframes": [], "keyframe_refs": [],
        "speed": None, "volume": 1.0,
        "extra_material_refs": [spd],
        "clip": {"alpha": 1.0, "flip": {"horizontal": False, "vertical": False},
                 "rotation": 0.0, "scale": {"x": 1.0, "y": 1.0},
                 "transform": {"x": 0.0, "y": 0.0}},
        "uniform_scale": {"on": True, "value": 1.0},
        "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
        "render_index": 0,
    }


def make_mock_storybound_draft(n_photos=30, n_audios=31, n_texts=333,
                                duration_us=712_099_999) -> dict:
    """模拟真实 Storybound draft_info.json 结构"""
    photos = [_make_photo_material(i) for i in range(n_photos)]
    audios = [_make_audio_material(i) for i in range(n_audios)]
    texts  = [_make_subtitle_material(i) for i in range(n_texts)]
    speeds = [_make_speed(i) for i in range(n_photos + n_audios)]

    vid_segs = [_make_video_segment(p["id"], i * 10_200_000, 10_200_000)
                for i, p in enumerate(photos)]

    return {
        "canvas_config": {"width": 1080, "height": 1920, "ratio": "original"},
        "color_space": 0,
        "config": {"adjust_max_index": 1, "attachment_info": []},
        "cover": "",
        "create_time": 0,
        "duration": duration_us,
        "extra_info": None,
        "fps": 30,
        "free_render_index_mode_on": False,
        "group_container": None,
        "id": str(uuid.uuid4()).upper(),
        "keyframe_graph_list": [],
        "keyframes": {
            "adjusts": [], "audios": [], "effects": [],
            "filters": [], "handwrites": [], "stickers": [], "texts": [], "videos": []
        },
        "last_modified_platform": {
            "app_id": 359289, "app_source": "cc", "app_version": "6.5.0",
            "device_id": _hex(), "hard_disk_id": _hex(), "mac_address": _hex(),
            "os": "mac", "os_version": "15.5"
        },
        "materials": {
            "audios": audios, "beats": [], "canvases": [],
            "effects": [], "flowers": [], "green_screens": [], "handwrites": [],
            "hsl": [], "images": [], "log_color_wheels": [], "loudnesses": [],
            "manual_deformations": [], "material_animations": [],
            "material_colors": [], "multi_language_refs": [], "placeholders": [],
            "plugin_effects": [], "primary_color_wheels": [],
            "realtime_denoises": [], "shapes": [], "smart_crops": [],
            "smart_relights": [], "sound_channel_mappings": [],
            "speeds": speeds, "stickers": [], "tail_leaders": [],
            "text_templates": [], "texts": texts, "time_marks": [],
            "transitions": [], "video_effects": [], "video_trackings": [],
            "videos": photos, "vocal_beautifys": [], "vocal_separations": [],
            "masks": [], "ai_translates": [], "audio_balances": [],
            "audio_effects": [], "audio_fades": [], "audio_track_indexes": [],
            "beats": [], "chromas": [], "color_curves": [], "color_wheels": [],
            "digital_humans": [], "drafts": [],
        },
        "mutable_config": None,
        "name": "",
        "new_version": "100.0.0",
        "platform": {"app_id": 359289, "app_source": "cc", "app_version": "6.5.0",
                     "os": "mac", "os_version": "15.5"},
        "relationships": [],
        "render_index_track_mode_on": True,
        "retouch_cover": "",
        "source": "default",
        "static_cover_image_path": "",
        "time_marks": None,
        "tracks": [
            {"attribute": 0, "flag": 0, "id": _hex(),
             "is_default_name": False, "name": "image_main",
             "type": "video", "segments": vid_segs}
        ],
        "update_time": 0,
        "version": 360000,
    }


def make_mock_video_info(n=3, dur_us=1_666_666) -> list[dict]:
    return [{"path": f"/fake/assets/video/clip{i}.mp4",
             "dur_us": dur_us, "w": 1080, "h": 1920}
            for i in range(n)]


def make_mock_audio_info(n=1, dur_us=5_000_000) -> list[dict]:
    return [{"path": f"/fake/assets/audio/audio{i}.mp3", "dur_us": dur_us}
            for i in range(n)]


# ────────────────────────────────────────────────
# TestRebuildDraftInfo
# ────────────────────────────────────────────────

class TestRebuildDraftInfo(unittest.TestCase):

    def setUp(self):
        self.template  = make_mock_storybound_draft(n_photos=30, n_audios=31, n_texts=333)
        self.vid_info  = make_mock_video_info(n=3)
        self.aud_info  = make_mock_audio_info(n=1)
        self.subtitles = ["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"]

    def _rebuild(self, **kwargs):
        kw = dict(template_data=self.template, video_info=self.vid_info,
                  audio_info=self.aud_info, subtitle_texts=self.subtitles,
                  total_dur_us=TOTAL_DURATION_US)
        kw.update(kwargs)
        return rebuild_draft_info(**kw)

    # ── duration ─────────────────────────────────
    def test_duration_is_5s(self):
        out = self._rebuild()
        self.assertEqual(out["duration"], TOTAL_DURATION_US)

    # ── materials.videos ─────────────────────────
    def test_video_materials_count(self):
        out = self._rebuild()
        self.assertEqual(len(out["materials"]["videos"]), 3)

    def test_video_type_is_video_not_photo(self):
        out = self._rebuild()
        for v in out["materials"]["videos"]:
            self.assertEqual(v.get("type"), "video",
                             "video materials 应为 type='video'，不是 'photo'")

    def test_no_storybound_paths_in_videos(self):
        out = self._rebuild()
        for v in out["materials"]["videos"]:
            self.assertNotIn("storybound", (v.get("path") or "").lower())

    # ── materials.audios ─────────────────────────
    def test_audio_materials_count(self):
        out = self._rebuild()
        self.assertEqual(len(out["materials"]["audios"]), 1)

    def test_audio_has_music_id(self):
        out = self._rebuild()
        for a in out["materials"]["audios"]:
            self.assertIn("music_id", a, "audio material 应有 music_id 字段")
            self.assertEqual(a["music_id"], a["id"], "music_id 应与 id 相同")

    def test_audio_has_copyright_limit_type(self):
        out = self._rebuild()
        for a in out["materials"]["audios"]:
            self.assertIn("copyright_limit_type", a)

    # ── materials.texts ──────────────────────────
    def test_text_materials_count(self):
        out = self._rebuild()
        self.assertEqual(len(out["materials"]["texts"]), 3)

    def test_text_type_is_subtitle(self):
        """type 必须是 'subtitle'，不是 'text'！"""
        out = self._rebuild()
        for t in out["materials"]["texts"]:
            self.assertEqual(t.get("type"), "subtitle",
                             f"text material type 应为 'subtitle'，得到 {t.get('type')!r}")

    def test_text_content_correct(self):
        out = self._rebuild()
        texts_out = []
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                texts_out.append(json.loads(raw).get("text", ""))
            except Exception:
                texts_out.append(raw)
        for expected in self.subtitles:
            self.assertIn(expected, texts_out)

    def test_no_original_subtitles_remain(self):
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                text = json.loads(raw).get("text", "")
            except Exception:
                text = raw
            self.assertNotIn("原始字幕", text)

    def test_subtitle_content_has_alpha_in_fill(self):
        """Storybound 格式：styles[0].fill.alpha 字段必须存在"""
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                c = json.loads(raw)
                fill = c["styles"][0]["fill"]
                self.assertIn("alpha", fill,
                              "styles[0].fill.alpha 缺失（Storybound 格式要求）")
            except Exception:
                pass

    def test_subtitle_content_has_strokes(self):
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            raw = item.get("content") or ""
            try:
                c = json.loads(raw)
                self.assertIn("strokes", c["styles"][0],
                              "styles[0].strokes 缺失（Storybound 格式要求）")
            except Exception:
                pass

    def test_subtitle_has_is_rich_text(self):
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            self.assertTrue(item.get("is_rich_text"),
                            "is_rich_text 应为 True")

    def test_subtitle_has_caption_template_info(self):
        out = self._rebuild()
        for item in out["materials"]["texts"]:
            self.assertIn("caption_template_info", item,
                          "caption_template_info 缺失")

    # ── materials.speeds ─────────────────────────
    def test_speeds_count_equals_vid_plus_aud(self):
        out = self._rebuild()
        expected = len(self.vid_info) + len(self.aud_info)
        self.assertEqual(len(out["materials"]["speeds"]), expected)

    def test_speeds_type(self):
        out = self._rebuild()
        for s in out["materials"]["speeds"]:
            self.assertEqual(s.get("type"), "speed")

    # ── tracks ───────────────────────────────────
    def test_tracks_count(self):
        out = self._rebuild()
        self.assertEqual(len(out["tracks"]), 3)

    def test_track_types(self):
        out = self._rebuild()
        types = [t["type"] for t in out["tracks"]]
        self.assertIn("video", types)
        self.assertIn("audio", types)
        self.assertIn("text", types)

    def test_video_segments_count(self):
        out = self._rebuild()
        self.assertEqual(count_segments(out["tracks"], "video"), 3)

    def test_audio_segments_count(self):
        out = self._rebuild()
        self.assertEqual(count_segments(out["tracks"], "audio"), 1)

    def test_text_segments_count(self):
        out = self._rebuild()
        self.assertEqual(count_segments(out["tracks"], "text"), 3)

    # ── segment structure: clip.transform ────────
    def test_video_segment_uses_clip_transform(self):
        """clip 字段必须用 transform，不是 translation（Storybound 格式）"""
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        for seg in vid_track["segments"]:
            clip = seg.get("clip") or {}
            self.assertIn("transform", clip,
                          "video segment clip 应有 transform 字段（不是 translation）")
            self.assertNotIn("translation", clip,
                             "video segment clip 不应有 translation 字段（旧格式）")

    def test_text_segment_uses_clip_transform(self):
        out = self._rebuild()
        txt_track = next(t for t in out["tracks"] if t["type"] == "text")
        for seg in txt_track["segments"]:
            clip = seg.get("clip") or {}
            self.assertIn("transform", clip)

    # ── segment structure: uniform_scale ─────────
    def test_video_segment_uniform_scale(self):
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        for seg in vid_track["segments"]:
            us = seg.get("uniform_scale")
            self.assertIsNotNone(us, "uniform_scale 不应为 null（应为 {on,value}）")
            self.assertIsInstance(us, dict)
            self.assertTrue(us.get("on"))

    # ── segment structure: keyframe_refs ─────────
    def test_segments_have_keyframe_refs(self):
        out = self._rebuild()
        for track in out["tracks"]:
            for seg in (track.get("segments") or []):
                self.assertIn("keyframe_refs", seg,
                              f"segment {seg.get('id')} 缺少 keyframe_refs 字段")

    # ── segment structure: speed ─────────────────
    def test_video_segment_speed_is_null(self):
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        for seg in vid_track["segments"]:
            self.assertIsNone(seg.get("speed"),
                              "video segment speed 应为 null（Storybound 格式）")

    def test_text_segment_speed_is_1(self):
        out = self._rebuild()
        txt_track = next(t for t in out["tracks"] if t["type"] == "text")
        for seg in txt_track["segments"]:
            self.assertEqual(seg.get("speed"), 1.0)

    # ── segment structure: source_timerange ──────
    def test_text_segment_source_timerange_is_null(self):
        out = self._rebuild()
        txt_track = next(t for t in out["tracks"] if t["type"] == "text")
        for seg in txt_track["segments"]:
            self.assertIsNone(seg.get("source_timerange"),
                              "text segment source_timerange 应为 null")

    # ── segment structure: hdr_settings ──────────
    def test_video_segment_has_hdr_settings(self):
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        for seg in vid_track["segments"]:
            hdr = seg.get("hdr_settings")
            self.assertIsNotNone(hdr)
            self.assertEqual(hdr.get("mode"), 1)

    # ── segment structure: extra_material_refs ────
    def test_video_segment_refs_speed(self):
        """video segment 的 extra_material_refs 应包含一个 speed material id"""
        out = self._rebuild()
        speed_ids = {s["id"] for s in (out["materials"].get("speeds") or [])}
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        for seg in vid_track["segments"]:
            refs = seg.get("extra_material_refs") or []
            self.assertEqual(len(refs), 1, "video segment 应引用 1 个 speed material")
            self.assertIn(refs[0], speed_ids, "extra_material_refs[0] 应在 speeds 中")

    # ── video segments coverage ───────────────────
    def test_video_segments_cover_full_duration(self):
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        total = sum(s["target_timerange"]["duration"] for s in vid_track["segments"])
        self.assertEqual(total, TOTAL_DURATION_US)

    def test_video_segments_no_gap(self):
        out = self._rebuild()
        vid_track = next(t for t in out["tracks"] if t["type"] == "video")
        segs = sorted(vid_track["segments"], key=lambda s: s["target_timerange"]["start"])
        cursor = 0
        for seg in segs:
            tgt = seg["target_timerange"]
            self.assertEqual(tgt["start"], cursor)
            cursor += tgt["duration"]

    # ── text render_index ─────────────────────────
    def test_text_segment_render_index(self):
        out = self._rebuild()
        txt_track = next(t for t in out["tracks"] if t["type"] == "text")
        for seg in txt_track["segments"]:
            self.assertGreaterEqual(seg.get("render_index", 0), 15000,
                                    "text segment render_index 应 >= 15000")

    # ── keyframes cleared ─────────────────────────
    def test_keyframes_all_cleared(self):
        out = self._rebuild()
        kf = out.get("keyframes") or {}
        for k, v in kf.items():
            if isinstance(v, list):
                self.assertEqual(v, [], f"keyframes.{k} 应被清空")

    def test_keyframe_graph_list_cleared(self):
        out = self._rebuild()
        self.assertEqual(out.get("keyframe_graph_list"), [])

    # ── non-relevant materials cleared ───────────
    def test_stickers_cleared(self):
        out = self._rebuild()
        self.assertEqual(out["materials"].get("stickers") or [], [])

    def test_effects_cleared(self):
        out = self._rebuild()
        self.assertEqual(out["materials"].get("effects") or [], [])

    def test_material_animations_cleared(self):
        out = self._rebuild()
        self.assertEqual(out["materials"].get("material_animations") or [], [])

    # ── canvas_config preserved ───────────────────
    def test_canvas_config_preserved(self):
        out = self._rebuild()
        orig = self.template["canvas_config"]
        new  = out["canvas_config"]
        self.assertEqual(new["width"],  orig["width"])
        self.assertEqual(new["height"], orig["height"])
        self.assertEqual(new["ratio"],  orig["ratio"])

    # ── fps preserved ─────────────────────────────
    def test_fps_preserved(self):
        out = self._rebuild()
        self.assertEqual(out.get("fps"), self.template.get("fps"))

    # ── version preserved ─────────────────────────
    def test_version_preserved(self):
        out = self._rebuild()
        self.assertEqual(out.get("version"), self.template.get("version"))

    # ── draft id preserved ────────────────────────
    def test_draft_id_preserved(self):
        """草稿 id 必须保持不变（与 Timelines/<id>/ 一致）"""
        out = self._rebuild()
        self.assertEqual(out.get("id"), self.template.get("id"),
                         "draft id 应保持原值（与 Timelines 文件夹名一致）")

    # ── material_id references consistent ────────
    def test_segment_material_ids_valid(self):
        out = self._rebuild()
        all_ids = set()
        for k in ["videos", "audios", "texts"]:
            for m in (out["materials"].get(k) or []):
                all_ids.add(m["id"])
        for track in out["tracks"]:
            for seg in (track.get("segments") or []):
                mid = seg.get("material_id")
                self.assertIn(mid, all_ids,
                              f"segment material_id={mid} 在 materials 中找不到")

    # ── empty video list edge case ────────────────
    def test_empty_video_list(self):
        out = self._rebuild(video_info=[], subtitle_texts=[])
        vid_track = next((t for t in out["tracks"] if t["type"] == "video"), None)
        segs = (vid_track or {}).get("segments") or []
        self.assertEqual(len(segs), 0)


# ────────────────────────────────────────────────
# TestInspectHelpers
# ────────────────────────────────────────────────

class TestInspectHelpers(unittest.TestCase):

    def setUp(self):
        self.draft = make_mock_storybound_draft(n_photos=3, n_audios=1, n_texts=5)

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
        self.assertEqual(len(extract_texts(big["materials"], limit=10)), 10)

    def test_collect_material_paths_storybound(self):
        """Storybound 只有 path 字段，没有 file_Path"""
        paths = collect_material_paths(self.draft["materials"])
        self.assertEqual(len(paths), 3 + 1)   # 3 photos + 1 audio
        for p in paths:
            self.assertTrue(p.startswith("D:\\"), f"应为 Windows 绝对路径: {p}")

    def test_load_main_json_prefer_draft_info(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "draft_info.json").write_text(
                json.dumps({"id": "A"}), encoding="utf-8")
            (Path(td) / "draft_content.json").write_text(
                json.dumps({"id": "B"}), encoding="utf-8")
            data, fname = load_main_json(Path(td))
            self.assertEqual(fname, "draft_info.json")
            self.assertEqual(data["id"], "A")

    def test_load_main_json_fallback_to_content(self):
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "draft_content.json").write_text(
                json.dumps({"id": "B"}), encoding="utf-8")
            data, fname = load_main_json(Path(td))
            self.assertEqual(fname, "draft_content.json")

    def test_load_main_json_missing(self):
        with tempfile.TemporaryDirectory() as td:
            data, fname = load_main_json(Path(td))
            self.assertIsNone(data)
            self.assertIsNone(fname)

    def test_load_main_json_skips_opaque(self):
        """draft_content.json 是 opaque (base64) 时应优先用 draft_info.json"""
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "draft_info.json").write_text(
                json.dumps({"id": "REAL"}), encoding="utf-8")
            (Path(td) / "draft_content.json").write_bytes(b"opaque_garbage_base64==")
            data, fname = load_main_json(Path(td))
            self.assertEqual(fname, "draft_info.json")
            self.assertEqual(data["id"], "REAL")


# ────────────────────────────────────────────────
# TestMediaPathChecking
# ────────────────────────────────────────────────

class TestMediaPathChecking(unittest.TestCase):

    def test_missing_paths_detected(self):
        draft = make_mock_storybound_draft(n_photos=2, n_audios=1, n_texts=0)
        paths = collect_material_paths(draft["materials"])
        missing = [p for p in paths if not Path(p).exists()]
        self.assertEqual(len(missing), len(paths),
                         "假 Windows 路径都应被检测为缺失")

    def test_present_paths_detected(self):
        with tempfile.TemporaryDirectory() as td:
            f = Path(td) / "test.mp4"
            f.write_bytes(b"fake mp4")
            mats = {"videos": [{"id": "X", "path": str(f), "type": "video"}], "audios": []}
            missing = [p for p in collect_material_paths(mats) if not Path(p).exists()]
            self.assertEqual(missing, [])

    def test_collect_material_paths_from_data(self):
        template = make_mock_storybound_draft(n_photos=3, n_audios=1, n_texts=0)
        vid_info = make_mock_video_info(n=3)
        aud_info = make_mock_audio_info(n=1)
        out = rebuild_draft_info(
            template_data=template, video_info=vid_info,
            audio_info=aud_info, subtitle_texts=["CLEAN 字幕 1", "CLEAN 字幕 2", "CLEAN 字幕 3"],
            total_dur_us=TOTAL_DURATION_US,
        )
        paths = collect_material_paths_from_data(out)
        self.assertEqual(len(paths), 4)   # 3 videos + 1 audio
        missing = [p for p in paths if not Path(p).exists()]
        self.assertEqual(len(missing), len(paths),
                         "fake 路径都应被检测为缺失")


# ────────────────────────────────────────────────
# TestSubtitleContent
# ────────────────────────────────────────────────

class TestSubtitleContent(unittest.TestCase):

    def test_valid_json(self):
        content = _make_subtitle_content("你好世界")
        obj = json.loads(content)
        self.assertEqual(obj["text"], "你好世界")

    def test_range_matches_text_len(self):
        text = "CLEAN 字幕 1"
        obj = json.loads(_make_subtitle_content(text))
        r = obj["styles"][0]["range"]
        self.assertEqual(r, [0, len(text)])

    def test_fill_has_alpha(self):
        """Storybound 格式：fill 必须有 alpha 字段"""
        obj = json.loads(_make_subtitle_content("test"))
        fill = obj["styles"][0]["fill"]
        self.assertIn("alpha", fill)
        self.assertEqual(fill["alpha"], 1.0)

    def test_has_strokes(self):
        obj = json.loads(_make_subtitle_content("test"))
        self.assertIn("strokes", obj["styles"][0])
        self.assertIsInstance(obj["styles"][0]["strokes"], list)

    def test_has_size(self):
        obj = json.loads(_make_subtitle_content("test"))
        self.assertIn("size", obj["styles"][0])

    def test_color_white(self):
        obj = json.loads(_make_subtitle_content("test"))
        color = obj["styles"][0]["fill"]["content"]["solid"]["color"]
        self.assertEqual(color, [1.0, 1.0, 1.0])


# ────────────────────────────────────────────────
# TestIDFormat
# ────────────────────────────────────────────────

class TestIDFormat(unittest.TestCase):

    def test_new_hex_id_is_32_lowercase(self):
        for _ in range(10):
            hid = new_hex_id()
            self.assertEqual(len(hid), 32, f"hex id 应为 32 字符: {hid}")
            self.assertEqual(hid, hid.lower(), f"hex id 应全小写: {hid}")
            self.assertNotIn("-", hid, f"hex id 不应含连字符: {hid}")

    def test_material_ids_are_hex32(self):
        template = make_mock_storybound_draft(n_photos=1, n_audios=1, n_texts=0)
        out = rebuild_draft_info(
            template_data=template,
            video_info=make_mock_video_info(n=1),
            audio_info=make_mock_audio_info(n=1),
            subtitle_texts=["CLEAN 字幕 1"],
            total_dur_us=TOTAL_DURATION_US,
        )
        for k in ["videos", "audios", "texts", "speeds"]:
            for m in (out["materials"].get(k) or []):
                mid = m["id"]
                self.assertEqual(len(mid), 32, f"{k} material id 应为 32 字符: {mid}")
                self.assertEqual(mid, mid.lower(), f"{k} material id 应全小写: {mid}")


# ────────────────────────────────────────────────
# TestCLIInputValidation
# ────────────────────────────────────────────────

class TestCLIInputValidation(unittest.TestCase):
    """测试 run() 的参数验证：输入文件不存在时应 sys.exit(1)"""

    def _make_args(self, template_dir, video_paths, audio_paths):
        class Args:
            template = str(template_dir)
            output   = str(template_dir.parent / "output_test")
            video    = video_paths
            audio    = audio_paths
        return Args()

    def _make_template_dir(self, tmp: Path) -> Path:
        """在 tmp 下创建合法模板目录（含 draft_info.json）"""
        tpl = tmp / "template"
        tpl.mkdir()
        draft = {
            "id": "DEADBEEF-0000-0000-0000-000000000000",
            "duration": 5_000_000,
            "fps": 30.0,
            "canvas_config": {"width": 1920, "height": 1080, "ratio": "original"},
            "version": 360000,
            "new_version": "107.0.0",
            "tracks": [],
            "materials": {
                "videos": [], "audios": [], "texts": [],
                "speeds": [], "stickers": [], "effects": [], "transitions": [],
            },
            "keyframes": {
                "adjusts": [], "audios": [], "effects": [], "filters": [],
                "handwrites": [], "stickers": [], "texts": [], "videos": [],
            },
            "keyframe_graph_list": [],
        }
        (tpl / "draft_info.json").write_text(json.dumps(draft), encoding="utf-8")
        return tpl

    def test_run_exits_when_template_dir_missing(self):
        with tempfile.TemporaryDirectory() as td:
            fake_tpl = Path(td) / "no_such_dir"
            fake_vid = Path(td) / "v.mp4"
            fake_vid.touch()
            fake_aud = Path(td) / "a.mp3"
            fake_aud.touch()
            args = self._make_args(fake_tpl, [str(fake_vid)], [str(fake_aud)])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)

    def test_run_exits_when_draft_info_missing_in_template(self):
        with tempfile.TemporaryDirectory() as td:
            tpl = Path(td) / "empty_template"
            tpl.mkdir()
            fake_vid = Path(td) / "v.mp4"
            fake_vid.touch()
            fake_aud = Path(td) / "a.mp3"
            fake_aud.touch()
            args = self._make_args(tpl, [str(fake_vid)], [str(fake_aud)])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)

    def test_run_exits_when_video_file_missing(self):
        with tempfile.TemporaryDirectory() as td:
            tpl = self._make_template_dir(Path(td))
            fake_vid = Path(td) / "nonexistent_video.mp4"   # 不建
            fake_aud = Path(td) / "a.mp3"
            fake_aud.touch()
            args = self._make_args(tpl, [str(fake_vid)], [str(fake_aud)])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)

    def test_run_exits_when_audio_file_missing(self):
        with tempfile.TemporaryDirectory() as td:
            tpl = self._make_template_dir(Path(td))
            fake_vid = Path(td) / "v.mp4"
            fake_vid.touch()
            fake_aud = Path(td) / "nonexistent_audio.mp3"   # 不建
            args = self._make_args(tpl, [str(fake_vid)], [str(fake_aud)])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)

    def test_run_exits_when_no_video_provided(self):
        with tempfile.TemporaryDirectory() as td:
            tpl = self._make_template_dir(Path(td))
            fake_aud = Path(td) / "a.mp3"
            fake_aud.touch()
            args = self._make_args(tpl, [], [str(fake_aud)])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)

    def test_run_exits_when_no_audio_provided(self):
        with tempfile.TemporaryDirectory() as td:
            tpl = self._make_template_dir(Path(td))
            fake_vid = Path(td) / "v.mp4"
            fake_vid.touch()
            args = self._make_args(tpl, [str(fake_vid)], [])
            with self.assertRaises(SystemExit) as cm:
                run(args)
            self.assertEqual(cm.exception.code, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
