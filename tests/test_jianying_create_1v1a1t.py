"""
tests/test_jianying_create_1v1a1t.py

单元测试 — create_1v1a1t.py（seed-based 1V1A1T 剪映草稿生成器）

测试原则：
  - 所有测试都使用从 make_mock_template() 生成的 mock Storybound 草稿
  - mock 数据尽量保留真实 Storybound 字段结构（含 extra_material_refs / speeds）
  - 不依赖本地文件系统（路径合法性由 main() 验证，这里测 build 逻辑）

运行：
  python -m unittest tests.test_jianying_create_1v1a1t -v
"""

import json
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "tools" / "jianying_draft"))

from create_1v1a1t import (
    build_draft_info,
    make_video_material,
    make_audio_material,
    make_text_material,
    make_video_segment,
    make_audio_segment,
    make_text_segment,
    make_track,
    clone_extra_refs,
    find_material_seed,
    find_segment_seed,
    find_track_seed,
    update_subtitle_content,
    hex32,
)


# ────────────────────────────────────────────────
# Mock 数据构造
# ────────────────────────────────────────────────

def _hid():
    return uuid.uuid4().hex


def make_mock_speed_mat(sid):
    return {"curve_speed": None, "id": sid, "mode": 0, "speed": None, "type": "speed"}


def make_mock_template(
    n_videos=30, n_audios=31, n_texts=333,
    duration_us=712_099_999,
    with_speeds=True,
):
    """构造 mock Storybound draft_info dict（含种子对象 + extra_material_refs）"""
    spd_id_v = _hid()   # video 0 segment 引用的 speed id
    spd_id_a = _hid()   # audio 0 segment 引用的 speed id

    # video materials
    videos = []
    for i in range(n_videos):
        mid = _hid()
        videos.append({
            "audio_fade": None,
            "category_id": "", "category_name": "local",
            "check_flag": 63487,
            "crop": {
                "lower_left_x": 0.0, "lower_left_y": 1.0,
                "lower_right_x": 1.0, "lower_right_y": 1.0,
                "upper_left_x": 0.0, "upper_left_y": 0.0,
                "upper_right_x": 1.0, "upper_right_y": 0.0,
            },
            "crop_ratio": "free", "crop_scale": 1.0,
            "duration": 10_200_000,
            "has_audio": True,
            "height": 1920, "width": 1080,
            "id": mid, "local_material_id": mid, "material_id": mid,
            "material_name": f"photo_{i}.png",
            "media_path": "", "path": f"/fake/path/photo_{i}.png",
            "remote_url": None, "type": "photo",
        })

    # audio materials
    audios = []
    for i in range(n_audios):
        mid = _hid()
        audios.append({
            "app_id": 0, "category_id": "", "category_name": "local",
            "check_flag": 1, "copyright_limit_type": "none",
            "duration": 10_200_000, "effect_id": "", "formula_id": "",
            "id": mid, "intensifies_path": "",
            "is_ai_clone_tone": False, "is_text_edit_overdub": False,
            "is_ugc": False, "local_material_id": mid, "music_id": mid,
            "name": f"audio_{i}", "path": f"/fake/path/audio_{i}.mp3",
            "query": "", "remote_url": None, "request_id": "",
            "resource_id": "", "search_id": "", "source_from": "",
            "source_platform": 0, "team_id": "", "text_id": "",
            "tone_category_id": "", "tone_category_name": "",
            "tone_effect_id": "", "tone_effect_name": "", "tone_platform": "",
            "tone_second_category_id": "", "tone_second_category_name": "",
            "tone_speaker": "", "tone_type": "",
            "type": "extract_music", "video_id": "", "wave_points": [],
        })

    # text materials
    def _content(txt):
        return json.dumps({
            "styles": [{
                "fill": {
                    "alpha": 1.0,
                    "content": {"render_type": "solid",
                                "solid": {"alpha": 1.0, "color": [1.0,1.0,1.0]}}
                },
                "range": [0, len(txt)], "size": 12.0,
                "bold": False, "italic": False, "underline": False,
                "strokes": [{"content": {"solid": {"alpha":0.0,
                              "color":[0.0,0.0,0.0]}}, "width": 0.0}]
            }],
            "text": txt
        }, ensure_ascii=False, separators=(",", ":"))

    texts = []
    for i in range(n_texts):
        mid = _hid()
        texts.append({
            "id": mid, "type": "subtitle",
            "content": _content(f"原字幕 {i}"),
            "alignment": 1, "check_flag": 31,
            "is_rich_text": True, "letter_spacing": 0.0,
            "line_feed": 1, "line_max_width": 1.0, "line_spacing": 0.02,
            "typesetting": 0, "fixed_width": -1, "fixed_height": -1,
            "font_size": 15.0, "fonts": [],
            "caption_template_info": {
                "category_id": "", "category_name": "", "effect_id": "",
                "is_new": False, "path": "", "request_id": "",
                "resource_id": "", "resource_name": "", "source_platform": 0,
            },
            "combo_info": {"text_templates": []},
            "words": {"end_time": [], "start_time": [], "text": []},
            "subtitle_keywords": None,
            "background_style": 0, "background_color": "#000000",
            "background_alpha": 0.5, "background_round_radius": 0.3,
            "background_height": 0.14, "background_width": 0.14,
            "background_horizontal_offset": 0.0,
            "background_vertical_offset": 0.0,
            "force_apply_line_max_width": False,
            "recognize_type": 0, "sub_type": 0,
        })

    speeds = [make_mock_speed_mat(spd_id_v), make_mock_speed_mat(spd_id_a)]

    def _base_seg_fields(sid, mat_id):
        return {
            "enable_adjust": True, "enable_color_correct_adjust": False,
            "enable_color_curves": True, "enable_color_match_adjust": False,
            "enable_color_wheels": True, "enable_lut": True,
            "enable_smart_color_adjust": False,
            "last_nonzero_volume": 1.0, "reverse": False,
            "track_attribute": 0, "track_render_index": 0, "visible": True,
            "id": sid, "material_id": mat_id,
            "common_keyframes": [], "keyframe_refs": [],
        }

    v_seg_id = _hid()
    v_seg = {
        **_base_seg_fields(v_seg_id, videos[0]["id"]),
        "extra_material_refs": [spd_id_v] if with_speeds else [],
        "target_timerange": {"start": 0, "duration": 10_200_000},
        "source_timerange": {"start": 0, "duration": 10_200_000},
        "speed": None, "volume": 1.0,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0},
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
        "render_index": 0,
    }

    a_seg_id = _hid()
    a_seg = {
        **_base_seg_fields(a_seg_id, audios[0]["id"]),
        "extra_material_refs": [spd_id_a] if with_speeds else [],
        "target_timerange": {"start": 0, "duration": 10_200_000},
        "source_timerange": {"start": 0, "duration": 10_200_000},
        "speed": 1.0, "volume": 10.0,
        "clip": None, "hdr_settings": None, "render_index": 0,
    }

    t_seg_id = _hid()
    t_seg = {
        **_base_seg_fields(t_seg_id, texts[0]["id"]),
        "extra_material_refs": [],
        "target_timerange": {"start": 0, "duration": 3_308_000},
        "source_timerange": None,
        "speed": 1.0, "volume": 1.0,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": -0.215},
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "render_index": 15000,
    }

    return {
        "id": "91E08AC5-22FB-47E2-9AA0-7DC300FAEA2B",
        "duration": duration_us,
        "fps": 30,
        "canvas_config": {"width": 1080, "height": 1920, "ratio": "original"},
        "version": 360000,
        "new_version": "100.0.0",
        "render_index_track_mode_on": True,
        "config": {"adjust_max_index": 1},
        "keyframes": {
            "adjusts": [{"x":1}],   # 非空，验证清空逻辑
            "audios": [], "effects": [], "filters": [],
            "handwrites": [], "stickers": [], "texts": [], "videos": [],
        },
        "keyframe_graph_list": [{"x": 1}],
        "materials": {
            "videos": videos, "audios": audios, "texts": texts,
            "speeds": speeds if with_speeds else [],
            "stickers": [], "effects": [], "transitions": [],
            "material_animations": [],
        },
        "tracks": [
            {"attribute": 0, "flag": 0, "id": _hid(),
             "is_default_name": False, "name": "image_main",
             "type": "video", "segments": [v_seg]},
            {"attribute": 0, "flag": 0, "id": _hid(),
             "is_default_name": True, "name": "",
             "type": "audio", "segments": [a_seg]},
            {"attribute": 0, "flag": 0, "id": _hid(),
             "is_default_name": True, "name": "",
             "type": "text", "segments": [t_seg]},
        ],
    }


def _run(tpl, sub="测试字幕", dur=5_000_000):
    return build_draft_info(
        template_data     = tpl,
        video_abs_path    = "/new/assets/video/clip1.mp4",
        video_duration_us = dur,
        audio_abs_path    = "/new/assets/audio/audio.mp3",
        audio_duration_us = dur,
        subtitle_text     = sub,
        total_duration_us = dur,
    )


# ════════════════════════════════════════════════
# TestSeedExtraction — 种子提取
# ════════════════════════════════════════════════

class TestSeedExtraction(unittest.TestCase):

    def setUp(self):
        self.tpl = make_mock_template()

    def test_find_material_seed_videos(self):
        seed = find_material_seed(self.tpl["materials"], "videos")
        self.assertIsNotNone(seed)
        self.assertIn("id", seed)

    def test_find_material_seed_missing_key(self):
        seed = find_material_seed(self.tpl["materials"], "nonexistent")
        self.assertIsNone(seed)

    def test_find_segment_seed_video(self):
        seed = find_segment_seed(self.tpl["tracks"], "video")
        self.assertIsNotNone(seed)
        self.assertIn("material_id", seed)

    def test_find_segment_seed_audio(self):
        seed = find_segment_seed(self.tpl["tracks"], "audio")
        self.assertIsNotNone(seed)

    def test_find_segment_seed_text(self):
        seed = find_segment_seed(self.tpl["tracks"], "text")
        self.assertIsNotNone(seed)

    def test_find_track_seed_type(self):
        track = find_track_seed(self.tpl["tracks"], "video")
        self.assertEqual(track["type"], "video")

    def test_seed_is_deepcopy(self):
        seed = find_material_seed(self.tpl["materials"], "videos")
        seed["id"] = "MODIFIED"
        # 原模板不受影响
        self.assertNotEqual(self.tpl["materials"]["videos"][0]["id"], "MODIFIED")


# ════════════════════════════════════════════════
# TestSubtitleContent — 字幕 content 更新
# ════════════════════════════════════════════════

class TestSubtitleContent(unittest.TestCase):

    def test_update_text_field(self):
        raw = json.dumps({"styles": [{"range": [0, 3], "size": 12.0}], "text": "旧字幕"})
        result = update_subtitle_content(raw, "新字幕内容")
        obj = json.loads(result)
        self.assertEqual(obj["text"], "新字幕内容")

    def test_update_range(self):
        raw = json.dumps({"styles": [{"range": [0, 3]}], "text": "旧"})
        result = update_subtitle_content(raw, "新的文本ABC")
        obj = json.loads(result)
        self.assertEqual(obj["styles"][0]["range"], [0, len("新的文本ABC")])

    def test_fallback_on_invalid_json(self):
        result = update_subtitle_content("not-json", "测试")
        obj = json.loads(result)
        self.assertEqual(obj["text"], "测试")
        self.assertIn("styles", obj)

    def test_result_is_string(self):
        raw = json.dumps({"styles": [{"range": [0, 1]}], "text": "x"})
        result = update_subtitle_content(raw, "y")
        self.assertIsInstance(result, str)

    def test_preserves_extra_style_fields(self):
        raw = json.dumps({
            "styles": [{"range": [0, 1], "bold": True, "size": 20.0}],
            "text": "x"
        })
        result = update_subtitle_content(raw, "y")
        obj = json.loads(result)
        self.assertEqual(obj["styles"][0]["bold"], True)
        self.assertEqual(obj["styles"][0]["size"], 20.0)


# ════════════════════════════════════════════════
# TestMaterialBuilders — material 构建
# ════════════════════════════════════════════════

class TestMaterialBuilders(unittest.TestCase):

    def setUp(self):
        self.tpl = make_mock_template()
        self.vid_seed = find_material_seed(self.tpl["materials"], "videos")
        self.aud_seed = find_material_seed(self.tpl["materials"], "audios")
        self.txt_seed = find_material_seed(self.tpl["materials"], "texts")

    def test_video_mat_uses_seed_extra_fields(self):
        m = make_video_material(self.vid_seed, hex32(), "/p/v.mp4", 5_000_000, "v.mp4")
        # 种子里的 has_audio 字段应被保留
        self.assertIn("has_audio", m)

    def test_video_mat_id_updated(self):
        new_id = hex32()
        m = make_video_material(self.vid_seed, new_id, "/p/v.mp4", 5_000_000, "v.mp4")
        self.assertEqual(m["id"], new_id)
        self.assertEqual(m["material_id"], new_id)
        self.assertEqual(m["local_material_id"], new_id)

    def test_video_mat_path_updated(self):
        m = make_video_material(self.vid_seed, hex32(), "/new/path/v.mp4", 5_000_000, "v.mp4")
        self.assertEqual(m["path"], "/new/path/v.mp4")

    def test_video_mat_type_is_video(self):
        m = make_video_material(self.vid_seed, hex32(), "/p/v.mp4", 5_000_000, "v.mp4")
        self.assertEqual(m["type"], "video")

    def test_video_mat_duration_updated(self):
        m = make_video_material(self.vid_seed, hex32(), "/p/v.mp4", 7_000_000, "v.mp4")
        self.assertEqual(m["duration"], 7_000_000)

    def test_video_mat_media_path_empty(self):
        m = make_video_material(self.vid_seed, hex32(), "/p/v.mp4", 5_000_000, "v.mp4")
        self.assertEqual(m.get("media_path", ""), "")

    def test_audio_mat_id_fields(self):
        new_id = hex32()
        m = make_audio_material(self.aud_seed, new_id, "/p/a.mp3", 5_000_000, "a.mp3")
        self.assertEqual(m["id"], new_id)
        self.assertEqual(m["local_material_id"], new_id)
        self.assertEqual(m["music_id"], new_id)

    def test_audio_mat_type(self):
        m = make_audio_material(self.aud_seed, hex32(), "/p/a.mp3", 5_000_000, "a.mp3")
        self.assertEqual(m["type"], "extract_music")

    def test_text_mat_type_is_subtitle(self):
        m = make_text_material(self.txt_seed, hex32(), "测试字幕")
        self.assertEqual(m["type"], "subtitle")

    def test_text_mat_content_has_new_text(self):
        m = make_text_material(self.txt_seed, hex32(), "新字幕内容")
        obj = json.loads(m["content"])
        self.assertEqual(obj["text"], "新字幕内容")

    def test_text_mat_no_old_text_in_content(self):
        m = make_text_material(self.txt_seed, hex32(), "新字幕内容")
        obj = json.loads(m["content"])
        self.assertNotIn("原字幕", obj.get("text", ""))

    def test_text_mat_preserves_seed_fields(self):
        m = make_text_material(self.txt_seed, hex32(), "测试")
        self.assertIn("caption_template_info", m)
        self.assertIn("combo_info", m)
        self.assertIn("background_style", m)

    def test_no_seed_video_mat_still_works(self):
        m = make_video_material(None, hex32(), "/p/v.mp4", 5_000_000, "v.mp4")
        self.assertIn("id", m)
        self.assertEqual(m["type"], "video")

    def test_no_seed_audio_mat_still_works(self):
        m = make_audio_material(None, hex32(), "/p/a.mp3", 5_000_000, "a.mp3")
        self.assertEqual(m["type"], "extract_music")

    def test_no_seed_text_mat_still_works(self):
        m = make_text_material(None, hex32(), "测试")
        self.assertEqual(m["type"], "subtitle")
        obj = json.loads(m["content"])
        self.assertEqual(obj["text"], "测试")


# ════════════════════════════════════════════════
# TestSegmentBuilders — segment 构建
# ════════════════════════════════════════════════

class TestSegmentBuilders(unittest.TestCase):

    def setUp(self):
        self.tpl = make_mock_template()
        self.vid_seed = find_segment_seed(self.tpl["tracks"], "video")
        self.aud_seed = find_segment_seed(self.tpl["tracks"], "audio")
        self.txt_seed = find_segment_seed(self.tpl["tracks"], "text")
        self.mat_id   = hex32()

    def test_video_seg_has_clip_transform(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertIn("transform", s.get("clip") or {})

    def test_video_seg_no_clip_translation(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertNotIn("translation", s.get("clip") or {})

    def test_video_seg_uniform_scale_present(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        us = s.get("uniform_scale")
        self.assertIsNotNone(us)
        self.assertTrue(us.get("on"))

    def test_video_seg_speed_null(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertIsNone(s.get("speed"))

    def test_video_seg_keyframe_refs_empty(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertEqual(s.get("keyframe_refs"), [])

    def test_video_seg_target_timerange(self):
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertEqual(s["target_timerange"]["duration"], 5_000_000)
        self.assertEqual(s["target_timerange"]["start"], 0)

    def test_video_seg_extra_refs_passed(self):
        refs = [hex32(), hex32()]
        s = make_video_segment(self.vid_seed, hex32(), self.mat_id, refs, 5_000_000, 5_000_000)
        self.assertEqual(s["extra_material_refs"], refs)

    def test_audio_seg_speed_1(self):
        s = make_audio_segment(self.aud_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertEqual(s.get("speed"), 1.0)

    def test_audio_seg_clip_null(self):
        s = make_audio_segment(self.aud_seed, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertIsNone(s.get("clip"))

    def test_text_seg_source_timerange_null(self):
        s = make_text_segment(self.txt_seed, hex32(), self.mat_id, 5_000_000)
        self.assertIsNone(s.get("source_timerange"))

    def test_text_seg_render_index_ge_15000(self):
        s = make_text_segment(self.txt_seed, hex32(), self.mat_id, 5_000_000)
        self.assertGreaterEqual(s.get("render_index", 0), 15000)

    def test_text_seg_extra_refs_empty(self):
        s = make_text_segment(self.txt_seed, hex32(), self.mat_id, 5_000_000)
        self.assertEqual(s.get("extra_material_refs"), [])

    def test_text_seg_has_clip_transform(self):
        s = make_text_segment(self.txt_seed, hex32(), self.mat_id, 5_000_000)
        self.assertIn("transform", s.get("clip") or {})

    def test_no_seed_video_seg_still_works(self):
        s = make_video_segment(None, hex32(), self.mat_id, [], 5_000_000, 5_000_000)
        self.assertIn("clip", s)
        self.assertIn("transform", s["clip"])

    def test_no_seed_text_seg_still_works(self):
        s = make_text_segment(None, hex32(), self.mat_id, 5_000_000)
        self.assertIsNone(s["source_timerange"])


# ════════════════════════════════════════════════
# TestExtraRefs — extra_material_refs 处理
# ════════════════════════════════════════════════

class TestExtraRefs(unittest.TestCase):

    def setUp(self):
        self.tpl = make_mock_template(with_speeds=True)
        self.vid_seg = find_segment_seed(self.tpl["tracks"], "video")
        self.mats    = self.tpl["materials"]

    def test_clone_returns_new_ids(self):
        old_refs = self.vid_seg.get("extra_material_refs") or []
        new_refs, extra = clone_extra_refs(self.vid_seg, self.mats)
        self.assertEqual(len(new_refs), len(old_refs))
        for old, new in zip(old_refs, new_refs):
            self.assertNotEqual(old, new)

    def test_clone_objects_are_in_extra_mats(self):
        new_refs, extra_mats = clone_extra_refs(self.vid_seg, self.mats)
        all_extra_ids = {
            obj["id"]
            for lst in extra_mats.values()
            for obj in lst
        }
        for ref in new_refs:
            self.assertIn(ref, all_extra_ids)

    def test_no_refs_returns_empty(self):
        seg = {"extra_material_refs": []}
        new_refs, extra_mats = clone_extra_refs(seg, self.mats)
        self.assertEqual(new_refs, [])
        self.assertEqual(extra_mats, {})

    def test_missing_ref_skipped(self):
        seg = {"extra_material_refs": ["nonexistent_id_abc"]}
        new_refs, extra_mats = clone_extra_refs(seg, self.mats)
        self.assertEqual(new_refs, [])


# ════════════════════════════════════════════════
# TestBuildDraftInfo — 核心重建逻辑
# ════════════════════════════════════════════════

class TestBuildDraftInfo(unittest.TestCase):

    def setUp(self):
        self.tpl = make_mock_template()
        self.out = _run(self.tpl, sub="这是我的第一个测试草稿")

    # ── duration ──────────────────────────────────────────
    def test_duration_is_5s(self):
        self.assertEqual(self.out["duration"], 5_000_000)

    def test_no_original_11min_duration(self):
        self.assertNotEqual(self.out["duration"], 712_099_999)

    # ── tracks ────────────────────────────────────────────
    def test_tracks_count_is_3(self):
        self.assertEqual(len(self.out["tracks"]), 3)

    def test_track_types(self):
        types = {t["type"] for t in self.out["tracks"]}
        self.assertEqual(types, {"video", "audio", "text"})

    def test_video_track_has_1_segment(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "video")
        self.assertEqual(len(t["segments"]), 1)

    def test_audio_track_has_1_segment(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "audio")
        self.assertEqual(len(t["segments"]), 1)

    def test_text_track_has_1_segment(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "text")
        self.assertEqual(len(t["segments"]), 1)

    # ── materials ─────────────────────────────────────────
    def test_videos_count_is_1(self):
        self.assertEqual(len(self.out["materials"]["videos"]), 1)

    def test_audios_count_is_1(self):
        self.assertEqual(len(self.out["materials"]["audios"]), 1)

    def test_texts_count_is_1(self):
        self.assertEqual(len(self.out["materials"]["texts"]), 1)

    def test_no_original_30_videos(self):
        self.assertNotEqual(len(self.out["materials"]["videos"]), 30)

    def test_no_original_333_texts(self):
        self.assertNotEqual(len(self.out["materials"]["texts"]), 333)

    # ── video material ────────────────────────────────────
    def test_video_mat_type_is_video(self):
        v = self.out["materials"]["videos"][0]
        self.assertEqual(v["type"], "video")

    def test_video_mat_path_updated(self):
        v = self.out["materials"]["videos"][0]
        self.assertIn("clip1.mp4", v["path"])

    def test_video_mat_ids_consistent(self):
        v = self.out["materials"]["videos"][0]
        self.assertEqual(v["id"], v["material_id"])
        self.assertEqual(v["id"], v["local_material_id"])

    def test_video_mat_seed_extra_field_preserved(self):
        # mock seed 有 has_audio，seed-based 应该保留
        v = self.out["materials"]["videos"][0]
        self.assertIn("has_audio", v)

    # ── audio material ────────────────────────────────────
    def test_audio_mat_path_updated(self):
        a = self.out["materials"]["audios"][0]
        self.assertIn("audio.mp3", a["path"])

    def test_audio_mat_music_id_eq_id(self):
        a = self.out["materials"]["audios"][0]
        self.assertEqual(a["id"], a["music_id"])

    # ── text material ─────────────────────────────────────
    def test_text_type_is_subtitle(self):
        t = self.out["materials"]["texts"][0]
        self.assertEqual(t["type"], "subtitle")

    def test_subtitle_text_correct(self):
        t = self.out["materials"]["texts"][0]
        obj = json.loads(t["content"])
        self.assertEqual(obj["text"], "这是我的第一个测试草稿")

    def test_no_old_subtitle_content(self):
        t = self.out["materials"]["texts"][0]
        obj = json.loads(t["content"])
        self.assertNotIn("原字幕", obj["text"])

    def test_subtitle_words_cleared(self):
        t = self.out["materials"]["texts"][0]
        w = t.get("words") or {}
        self.assertEqual(w.get("text"), [])

    # ── segment fields ────────────────────────────────────
    def test_video_seg_clip_transform(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "video")
        seg = t["segments"][0]
        self.assertIn("transform", seg.get("clip") or {})

    def test_video_seg_speed_null(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "video")
        self.assertIsNone(t["segments"][0].get("speed"))

    def test_audio_seg_speed_1(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "audio")
        self.assertEqual(t["segments"][0].get("speed"), 1.0)

    def test_text_seg_source_timerange_null(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "text")
        self.assertIsNone(t["segments"][0].get("source_timerange"))

    def test_text_seg_render_index_ge_15000(self):
        t = next(t for t in self.out["tracks"] if t["type"] == "text")
        self.assertGreaterEqual(t["segments"][0].get("render_index", 0), 15000)

    # ── extra_material_refs 不悬空 ────────────────────────
    def test_no_dangling_extra_refs(self):
        mats = self.out["materials"]
        all_ids = {
            obj.get("id")
            for lst in mats.values() if isinstance(lst, list)
            for obj in lst
        }
        for tr in self.out["tracks"]:
            for seg in (tr.get("segments") or []):
                for ref in (seg.get("extra_material_refs") or []):
                    self.assertIn(ref, all_ids,
                                  f"extra_material_refs 引用了不存在的 id: {ref}")

    # ── keyframes 全清空 ──────────────────────────────────
    def test_keyframes_all_cleared(self):
        kf = self.out.get("keyframes") or {}
        for k, v in kf.items():
            self.assertEqual(v, [], f"keyframes.{k} 应为 []")

    def test_keyframe_graph_list_cleared(self):
        self.assertEqual(self.out.get("keyframe_graph_list"), [])

    # ── 顶层元信息保留 ────────────────────────────────────
    def test_draft_id_preserved(self):
        self.assertEqual(self.out["id"], self.tpl["id"])

    def test_fps_preserved(self):
        self.assertEqual(self.out["fps"], 30)

    def test_canvas_config_preserved(self):
        cc = self.out["canvas_config"]
        self.assertEqual(cc["width"], 1080)
        self.assertEqual(cc["height"], 1920)

    def test_version_preserved(self):
        self.assertEqual(self.out["version"], 360000)

    # ── segment material_id 引用正确 ──────────────────────
    def test_segment_material_id_matches_material(self):
        mats = self.out["materials"]
        vid_id = mats["videos"][0]["id"]
        aud_id = mats["audios"][0]["id"]
        txt_id = mats["texts"][0]["id"]
        for tr in self.out["tracks"]:
            seg = (tr.get("segments") or [{}])[0]
            if tr["type"] == "video":
                self.assertEqual(seg["material_id"], vid_id)
            elif tr["type"] == "audio":
                self.assertEqual(seg["material_id"], aud_id)
            elif tr["type"] == "text":
                self.assertEqual(seg["material_id"], txt_id)

    # ── ID 格式 ───────────────────────────────────────────
    def test_all_new_ids_are_hex32(self):
        orig_id = self.tpl["id"]   # 大写 UUID，不检查它
        for tr in self.out["tracks"]:
            self.assertRegex(tr["id"], r"^[0-9a-f]{32}$",
                             f"track id 格式错误: {tr['id']}")
            for seg in (tr.get("segments") or []):
                self.assertRegex(seg["id"], r"^[0-9a-f]{32}$",
                                 f"segment id 格式错误: {seg['id']}")
        for key in ["videos", "audios", "texts"]:
            for m in (self.out["materials"].get(key) or []):
                self.assertRegex(m["id"], r"^[0-9a-f]{32}$",
                                 f"material id 格式错误: {m['id']}")


# ════════════════════════════════════════════════
# TestNoSeedFallback — 无种子降级路径
# ════════════════════════════════════════════════

class TestNoSeedFallback(unittest.TestCase):
    """当模板没有 materials/tracks 时，脚本仍能生成基本结构"""

    def test_empty_template_produces_output(self):
        empty = {
            "id": "AAAAAAAA-0000-0000-0000-000000000000",
            "duration": 0, "fps": 30,
            "canvas_config": {"width": 1080, "height": 1920, "ratio": "original"},
            "version": 360000, "new_version": "100.0.0",
            "materials": {"videos": [], "audios": [], "texts": [],
                          "speeds": [], "stickers": [], "effects": [],
                          "transitions": [], "material_animations": []},
            "tracks": [],
            "keyframes": {"adjusts": [], "audios": [], "effects": [], "filters": [],
                          "handwrites": [], "stickers": [], "texts": [], "videos": []},
            "keyframe_graph_list": [],
        }
        out = _run(empty, "降级测试字幕")
        self.assertEqual(len(out["tracks"]), 3)
        self.assertEqual(len(out["materials"]["videos"]), 1)
        self.assertEqual(len(out["materials"]["texts"]), 1)
        obj = json.loads(out["materials"]["texts"][0]["content"])
        self.assertEqual(obj["text"], "降级测试字幕")


# ════════════════════════════════════════════════
# TestCLIValidation — run 入口参数验证
# ════════════════════════════════════════════════

class TestCLIValidation(unittest.TestCase):

    def _make_args(self, template_dir, video, audio, subtitle="CLEAN", duration=5_000_000):
        class Args:
            template = str(template_dir)
            output   = str(Path(template_dir).parent / "output_test")
            video    = str(video)
            audio    = str(audio)
            subtitle_text = subtitle    # not used in main(), but kept for clarity
            duration = duration
            video_duration = None
            audio_duration = None
        return Args()

    def test_exits_when_template_missing(self):
        from create_1v1a1t import main as _main
        import sys as _sys
        with tempfile.TemporaryDirectory() as td:
            fake_tpl = Path(td) / "no_such"
            fake_v   = Path(td) / "v.mp4"; fake_v.touch()
            fake_a   = Path(td) / "a.mp3"; fake_a.touch()
            _sys.argv = ["create_1v1a1t.py",
                         "--template", str(fake_tpl),
                         "--output",   str(Path(td) / "out"),
                         "--video",    str(fake_v),
                         "--audio",    str(fake_a)]
            with self.assertRaises(SystemExit) as cm:
                _main()
            self.assertEqual(cm.exception.code, 1)

    def test_exits_when_video_missing(self):
        from create_1v1a1t import main as _main
        import sys as _sys
        with tempfile.TemporaryDirectory() as td:
            tpl = Path(td) / "tpl"; tpl.mkdir()
            draft = {"id": "X", "duration": 0, "fps": 30,
                     "canvas_config": {}, "version": 0, "new_version": "0",
                     "materials": {}, "tracks": [], "keyframes": {},
                     "keyframe_graph_list": []}
            (tpl / "draft_info.json").write_text(json.dumps(draft))
            fake_a = Path(td) / "a.mp3"; fake_a.touch()
            _sys.argv = ["create_1v1a1t.py",
                         "--template", str(tpl),
                         "--output",   str(Path(td) / "out"),
                         "--video",    str(Path(td) / "no_video.mp4"),
                         "--audio",    str(fake_a)]
            with self.assertRaises(SystemExit) as cm:
                _main()
            self.assertEqual(cm.exception.code, 1)

    def test_exits_when_audio_missing(self):
        from create_1v1a1t import main as _main
        import sys as _sys
        with tempfile.TemporaryDirectory() as td:
            tpl = Path(td) / "tpl"; tpl.mkdir()
            draft = {"id": "X", "duration": 0, "fps": 30,
                     "canvas_config": {}, "version": 0, "new_version": "0",
                     "materials": {}, "tracks": [], "keyframes": {},
                     "keyframe_graph_list": []}
            (tpl / "draft_info.json").write_text(json.dumps(draft))
            fake_v = Path(td) / "v.mp4"; fake_v.touch()
            _sys.argv = ["create_1v1a1t.py",
                         "--template", str(tpl),
                         "--output",   str(Path(td) / "out"),
                         "--video",    str(fake_v),
                         "--audio",    str(Path(td) / "no_audio.mp3")]
            with self.assertRaises(SystemExit) as cm:
                _main()
            self.assertEqual(cm.exception.code, 1)

    def test_exits_when_output_exists(self):
        from create_1v1a1t import main as _main
        import sys as _sys
        with tempfile.TemporaryDirectory() as td:
            tpl = Path(td) / "tpl"; tpl.mkdir()
            draft = {"id": "X", "duration": 0, "fps": 30,
                     "canvas_config": {}, "version": 0, "new_version": "0",
                     "materials": {}, "tracks": [], "keyframes": {},
                     "keyframe_graph_list": []}
            (tpl / "draft_info.json").write_text(json.dumps(draft))
            fake_v = Path(td) / "v.mp4"; fake_v.touch()
            fake_a = Path(td) / "a.mp3"; fake_a.touch()
            out = Path(td) / "out"; out.mkdir()   # 已存在
            _sys.argv = ["create_1v1a1t.py",
                         "--template", str(tpl),
                         "--output",   str(out),
                         "--video",    str(fake_v),
                         "--audio",    str(fake_a)]
            with self.assertRaises(SystemExit) as cm:
                _main()
            self.assertEqual(cm.exception.code, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
