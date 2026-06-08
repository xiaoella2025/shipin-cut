#!/usr/bin/env python3
"""
create_1v1a1t.py — 基于 Storybound 模板种子对象，生成最小剪映草稿（1视频+1音频+1字幕）

核心策略（seed-based）：
  不手写简化 material/segment 对象，而是：
  1. 从模板 draft_info.json 中提取真实种子对象（第一个 video/audio/text material 及对应 segment）
  2. deepcopy 种子，只更新必要字段（id / path / content / timerange）
  3. 处理 extra_material_refs：同步复制被引用的 speed/material_animation 对象
  4. 只替换 materials.videos / audios / texts / 被引用的附属材料
  5. 保留 draft_content.json / template-2.tmp / draft_meta_info.json 不动

GUI 失效原因分析：
  手写简化对象省略了剪映 GUI 需要的隐藏字段（如 has_audio、渲染缓存字段等）
  → deepcopy 种子保留所有原字段，只改最小必要集合

用法（Windows PowerShell）：
  python tools/jianying_draft/create_1v1a1t.py `
    --template "F:\\shipin-cut\\storybound_reference_template\\storybound_draft_structure_pack" `
    --output   "C:\\Users\\Admin\\...\\TEST_1V1A1T_FIX" `
    --video    "F:\\clips\\clip1.mp4" `
    --audio    "F:\\clips\\audio.mp3" `
    --subtitle "这是我的第一个测试草稿" `
    --duration 5000000

注意：
  video/audio 必须真实存在；draft id 保持模板原值（匹配 Timelines/<id>/）
"""

import argparse
import copy
import json
import shutil
import sys
import uuid
from pathlib import Path


# ────────────────────────────────────────────────
# ID 工具
# ────────────────────────────────────────────────

def hex32() -> str:
    """32位小写十六进制，Storybound segment/material/track 格式"""
    return uuid.uuid4().hex


# ────────────────────────────────────────────────
# 种子提取
# ────────────────────────────────────────────────

def find_material_seed(materials: dict, key: str) -> dict | None:
    """从 materials[key] 取第一个对象（不存在返回 None）"""
    lst = materials.get(key) or []
    return copy.deepcopy(lst[0]) if lst else None


def find_track_seed(tracks: list, track_type: str) -> dict | None:
    """找第一条 type == track_type 的 track"""
    for t in tracks:
        if t.get("type") == track_type:
            return copy.deepcopy(t)
    return None


def find_segment_seed(tracks: list, track_type: str) -> dict | None:
    """找第一条 type == track_type 的 track 中第一个 segment"""
    for t in tracks:
        if t.get("type") == track_type:
            segs = t.get("segments") or []
            if segs:
                return copy.deepcopy(segs[0])
    return None


def find_refs_in_materials(materials: dict, ref_ids: list[str]) -> dict:
    """
    在 materials 所有数组中查找 id 在 ref_ids 里的对象。
    返回 {old_id: deepcopy(obj)}
    """
    found = {}
    for key, lst in materials.items():
        if not isinstance(lst, list):
            continue
        for obj in lst:
            oid = obj.get("id", "")
            if oid in ref_ids and oid not in found:
                found[oid] = copy.deepcopy(obj)
    return found


# ────────────────────────────────────────────────
# 字幕 content 更新
# ────────────────────────────────────────────────

def update_subtitle_content(raw_content: str, new_text: str) -> str:
    """
    解析 seed content JSON，只改 text 字段和 styles[0].range。
    解析失败则构造最小 content。
    """
    try:
        obj = json.loads(raw_content)
        obj["text"] = new_text
        if "styles" in obj and obj["styles"]:
            obj["styles"][0]["range"] = [0, len(new_text)]
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    except Exception:
        # 回退：构造最小 content
        fallback = {
            "styles": [{
                "fill": {
                    "alpha": 1.0,
                    "content": {
                        "render_type": "solid",
                        "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                    }
                },
                "range": [0, len(new_text)],
                "size": 12.0,
                "bold": False,
                "italic": False,
                "underline": False,
                "strokes": [{
                    "content": {"solid": {"alpha": 0.0, "color": [0.0, 0.0, 0.0]}},
                    "width": 0.0
                }]
            }],
            "text": new_text
        }
        return json.dumps(fallback, ensure_ascii=False, separators=(",", ":"))


# ────────────────────────────────────────────────
# Material 更新（deepcopy seed → 只改必要字段）
# ────────────────────────────────────────────────

def make_video_material(seed: dict | None, new_id: str,
                        abs_path: str, duration_us: int,
                        filename: str) -> dict:
    if seed is None:
        # 无种子：构造最小对象（降级）
        return {
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
            "duration": duration_us,
            "height": 1920,
            "id": new_id, "local_material_id": new_id,
            "material_id": new_id, "material_name": filename,
            "media_path": "", "path": abs_path,
            "remote_url": None, "type": "video", "width": 1080,
        }
    m = copy.deepcopy(seed)
    m["id"]               = new_id
    m["material_id"]      = new_id
    m["local_material_id"] = new_id
    m["path"]             = abs_path
    m["media_path"]       = ""     # Storybound 惯例：media_path 为空
    m["material_name"]    = filename
    if "name" in m:
        m["name"] = filename
    m["duration"]         = duration_us
    m["type"]             = "video"
    m["remote_url"]       = None
    return m


def make_audio_material(seed: dict | None, new_id: str,
                        abs_path: str, duration_us: int,
                        filename: str) -> dict:
    if seed is None:
        return {
            "app_id": 0,
            "category_id": "", "category_name": "local",
            "check_flag": 1, "copyright_limit_type": "none",
            "duration": duration_us, "effect_id": "", "formula_id": "",
            "id": new_id, "intensifies_path": "",
            "is_ai_clone_tone": False, "is_text_edit_overdub": False,
            "is_ugc": False, "local_material_id": new_id, "music_id": new_id,
            "name": Path(filename).stem, "path": abs_path,
            "query": "", "remote_url": None, "request_id": "",
            "resource_id": "", "search_id": "", "source_from": "",
            "source_platform": 0, "team_id": "", "text_id": "",
            "tone_category_id": "", "tone_category_name": "",
            "tone_effect_id": "", "tone_effect_name": "",
            "tone_platform": "", "tone_second_category_id": "",
            "tone_second_category_name": "", "tone_speaker": "",
            "tone_type": "", "type": "extract_music",
            "video_id": "", "wave_points": [],
        }
    m = copy.deepcopy(seed)
    m["id"]               = new_id
    m["local_material_id"] = new_id
    m["music_id"]         = new_id
    m["path"]             = abs_path
    m["name"]             = Path(filename).stem
    if "material_name" in m:
        m["material_name"] = filename
    m["duration"]         = duration_us
    m["type"]             = "extract_music"
    m["remote_url"]       = None
    return m


def make_text_material(seed: dict | None, new_id: str, text: str) -> dict:
    if seed is None:
        content = update_subtitle_content("{}", text)
        return {
            "id": new_id, "type": "subtitle",
            "content": content,
            "alignment": 1, "check_flag": 31,
            "is_rich_text": True, "letter_spacing": 0.0,
            "line_feed": 1, "line_max_width": 1.0,
            "line_spacing": 0.02, "typesetting": 0,
            "fixed_width": -1, "fixed_height": -1,
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
        }
    m = copy.deepcopy(seed)
    m["id"]      = new_id
    m["type"]    = "subtitle"
    # content 字段
    raw = m.get("content") or "{}"
    m["content"] = update_subtitle_content(raw, text)
    # 同步明确文本字段（有则更新，没有不加）
    if "name" in m:
        m["name"] = text[:20]
    # words.text 若有，清空（不生成字词时间戳）
    if "words" in m and isinstance(m["words"], dict):
        m["words"] = {"end_time": [], "start_time": [], "text": []}
    if "subtitle_keywords" in m:
        m["subtitle_keywords"] = None
    return m


# ────────────────────────────────────────────────
# Segment 更新（deepcopy seed → 只改必要字段）
# ────────────────────────────────────────────────

def make_video_segment(seed: dict | None, new_id: str, mat_id: str,
                       extra_refs: list[str],
                       target_dur: int, source_dur: int) -> dict:
    if seed is None:
        return {
            "enable_adjust": True, "enable_color_correct_adjust": False,
            "enable_color_curves": True, "enable_color_match_adjust": False,
            "enable_color_wheels": True, "enable_lut": True,
            "enable_smart_color_adjust": False,
            "last_nonzero_volume": 1.0, "reverse": False,
            "track_attribute": 0, "track_render_index": 0, "visible": True,
            "id": new_id, "material_id": mat_id,
            "common_keyframes": [], "keyframe_refs": [],
            "extra_material_refs": extra_refs,
            "target_timerange": {"start": 0, "duration": target_dur},
            "source_timerange": {"start": 0, "duration": source_dur},
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
    s = copy.deepcopy(seed)
    s["id"]          = new_id
    s["material_id"] = mat_id
    s["extra_material_refs"] = extra_refs
    s["target_timerange"] = {"start": 0, "duration": target_dur}
    s["source_timerange"] = {"start": 0, "duration": source_dur}
    if "keyframe_refs" in s:
        s["keyframe_refs"] = []
    if "common_keyframes" in s:
        s["common_keyframes"] = []
    # clip.transform 必须存在
    clip = s.get("clip") or {}
    if clip and "transform" not in clip and "translation" in clip:
        clip["transform"] = clip.pop("translation")
    if "uniform_scale" not in s:
        s["uniform_scale"] = {"on": True, "value": 1.0}
    s["volume"] = 1.0
    return s


def make_audio_segment(seed: dict | None, new_id: str, mat_id: str,
                       extra_refs: list[str],
                       target_dur: int, source_dur: int) -> dict:
    if seed is None:
        return {
            "enable_adjust": True, "enable_color_correct_adjust": False,
            "enable_color_curves": True, "enable_color_match_adjust": False,
            "enable_color_wheels": True, "enable_lut": True,
            "enable_smart_color_adjust": False,
            "last_nonzero_volume": 1.0, "reverse": False,
            "track_attribute": 0, "track_render_index": 0, "visible": True,
            "id": new_id, "material_id": mat_id,
            "common_keyframes": [], "keyframe_refs": [],
            "extra_material_refs": extra_refs,
            "target_timerange": {"start": 0, "duration": target_dur},
            "source_timerange": {"start": 0, "duration": source_dur},
            "speed": 1.0, "volume": 1.0,
            "clip": None, "hdr_settings": None, "render_index": 0,
        }
    s = copy.deepcopy(seed)
    s["id"]          = new_id
    s["material_id"] = mat_id
    s["extra_material_refs"] = extra_refs
    s["target_timerange"] = {"start": 0, "duration": target_dur}
    s["source_timerange"] = {"start": 0, "duration": source_dur}
    if "keyframe_refs" in s:
        s["keyframe_refs"] = []
    if "common_keyframes" in s:
        s["common_keyframes"] = []
    s["volume"] = 1.0
    return s


def make_text_segment(seed: dict | None, new_id: str, mat_id: str,
                      target_dur: int) -> dict:
    if seed is None:
        return {
            "enable_adjust": True, "enable_color_correct_adjust": False,
            "enable_color_curves": True, "enable_color_match_adjust": False,
            "enable_color_wheels": True, "enable_lut": True,
            "enable_smart_color_adjust": False,
            "last_nonzero_volume": 1.0, "reverse": False,
            "track_attribute": 0, "track_render_index": 0, "visible": True,
            "id": new_id, "material_id": mat_id,
            "common_keyframes": [], "keyframe_refs": [],
            "extra_material_refs": [],
            "target_timerange": {"start": 0, "duration": target_dur},
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
    s = copy.deepcopy(seed)
    s["id"]          = new_id
    s["material_id"] = mat_id
    s["extra_material_refs"] = []   # text segment 不引用 speed
    s["target_timerange"] = {"start": 0, "duration": target_dur}
    s["source_timerange"] = None    # text segment 必须为 null
    if "keyframe_refs" in s:
        s["keyframe_refs"] = []
    if "common_keyframes" in s:
        s["common_keyframes"] = []
    if "render_index" in s:
        s["render_index"] = max(s["render_index"], 15000)
    else:
        s["render_index"] = 15000
    # clip.transform 必须存在
    clip = s.get("clip") or {}
    if clip and "transform" not in clip and "translation" in clip:
        clip["transform"] = clip.pop("translation")
    if "uniform_scale" not in s:
        s["uniform_scale"] = {"on": True, "value": 1.0}
    s["speed"] = 1.0
    s["volume"] = 1.0
    return s


def make_track(seed: dict | None, new_id: str,
               track_type: str, segments: list) -> dict:
    if seed is None:
        return {
            "attribute": 0, "flag": 0, "id": new_id,
            "is_default_name": True, "name": "",
            "type": track_type, "segments": segments,
        }
    t = copy.deepcopy(seed)
    t["id"]       = new_id
    t["segments"] = segments
    t["type"]     = track_type
    return t


# ────────────────────────────────────────────────
# extra_material_refs 处理（同步 speed/animation 对象）
# ────────────────────────────────────────────────

def clone_extra_refs(seed_seg: dict | None,
                     template_materials: dict) -> tuple[list[str], dict]:
    """
    从 seed segment 的 extra_material_refs 中找到被引用的 material 对象，
    deepcopy 并分配新 id。

    返回:
      new_refs  — 新 id 列表（用于替换 segment.extra_material_refs）
      extra_mats — {材料数组 key: [新材料对象]} （需合并到 output materials）
    """
    if seed_seg is None:
        return [], {}

    old_refs = seed_seg.get("extra_material_refs") or []
    if not old_refs:
        return [], {}

    # 找到被引用的对象（按 id 匹配任意 materials 数组）
    ref_seeds = find_refs_in_materials(template_materials, old_refs)

    new_refs: list[str] = []
    extra_mats: dict[str, list] = {}

    for old_id in old_refs:
        obj = ref_seeds.get(old_id)
        if obj is None:
            # 引用对象在模板里不存在，跳过（不引用不存在的 id）
            continue
        new_id = hex32()
        obj["id"] = new_id
        new_refs.append(new_id)
        # 确定它在哪个数组
        mat_key = _find_mat_key(template_materials, old_id)
        if mat_key:
            extra_mats.setdefault(mat_key, []).append(obj)

    return new_refs, extra_mats


def _find_mat_key(materials: dict, target_id: str) -> str | None:
    for key, lst in materials.items():
        if not isinstance(lst, list):
            continue
        for obj in lst:
            if obj.get("id") == target_id:
                return key
    return None


# ────────────────────────────────────────────────
# 核心重建（seed-based）
# ────────────────────────────────────────────────

def build_draft_info(
    template_data: dict,
    video_abs_path: str,
    video_duration_us: int,
    audio_abs_path: str,
    audio_duration_us: int,
    subtitle_text: str,
    total_duration_us: int,
) -> dict:
    """
    基于模板种子重建 draft_info.json。

    策略：
    - 保留顶层元信息（canvas_config / fps / version / id / config 等）
    - deepcopy 种子 material / segment / track，只改必要字段
    - 处理 extra_material_refs，同步复制被引用的 speed 对象
    - draft id 保持原值（匹配 Timelines/<id>/）
    """
    new = copy.deepcopy(template_data)
    mats   = template_data.get("materials") or {}
    tracks = template_data.get("tracks") or []

    # ── 提取种子 ─────────────────────────────────────────────────
    vid_mat_seed = find_material_seed(mats, "videos")
    aud_mat_seed = find_material_seed(mats, "audios")
    txt_mat_seed = find_material_seed(mats, "texts")
    vid_seg_seed = find_segment_seed(tracks, "video")
    aud_seg_seed = find_segment_seed(tracks, "audio")
    txt_seg_seed = find_segment_seed(tracks, "text")
    vid_trk_seed = find_track_seed(tracks, "video")
    aud_trk_seed = find_track_seed(tracks, "audio")
    txt_trk_seed = find_track_seed(tracks, "text")

    # ── 分配新 ID ────────────────────────────────────────────────
    vid_mat_id = hex32()
    aud_mat_id = hex32()
    txt_mat_id = hex32()

    # ── video extra_material_refs（speed 等）────────────────────
    vid_extra_refs, vid_extra_mats = clone_extra_refs(vid_seg_seed, mats)
    aud_extra_refs, aud_extra_mats = clone_extra_refs(aud_seg_seed, mats)

    # ── 构建新 materials ─────────────────────────────────────────
    vid_mat = make_video_material(
        vid_mat_seed, vid_mat_id,
        video_abs_path, video_duration_us,
        Path(video_abs_path).name
    )
    aud_mat = make_audio_material(
        aud_mat_seed, aud_mat_id,
        audio_abs_path, audio_duration_us,
        Path(audio_abs_path).name
    )
    txt_mat = make_text_material(txt_mat_seed, txt_mat_id, subtitle_text)

    # ── 构建新 segments ──────────────────────────────────────────
    vid_seg = make_video_segment(
        vid_seg_seed, hex32(), vid_mat_id,
        vid_extra_refs, total_duration_us,
        min(video_duration_us, total_duration_us)
    )
    aud_seg = make_audio_segment(
        aud_seg_seed, hex32(), aud_mat_id,
        aud_extra_refs, total_duration_us,
        min(audio_duration_us, total_duration_us)
    )
    txt_seg = make_text_segment(
        txt_seg_seed, hex32(), txt_mat_id, total_duration_us
    )

    # ── 构建新 tracks ────────────────────────────────────────────
    new["tracks"] = [
        make_track(vid_trk_seed, hex32(), "video", [vid_seg]),
        make_track(aud_trk_seed, hex32(), "audio", [aud_seg]),
        make_track(txt_trk_seed, hex32(), "text",  [txt_seg]),
    ]

    # ── 组装 materials ───────────────────────────────────────────
    # 从模板 materials 出发：替换 videos/audios/texts，清空其余 list 字段
    new_mats: dict = {}
    for k, v in mats.items():
        if isinstance(v, list):
            new_mats[k] = []     # 默认全清空
        else:
            new_mats[k] = v

    new_mats["videos"] = [vid_mat]
    new_mats["audios"] = [aud_mat]
    new_mats["texts"]  = [txt_mat]

    # 合并 extra_material_refs 引用的对象（speed / material_animations 等）
    # 注意：不能用 {**a, **b} 合并，同名 key 会覆盖；要逐条 extend
    for extra in [vid_extra_mats, aud_extra_mats]:
        for key, objs in extra.items():
            new_mats.setdefault(key, []).extend(objs)

    new["materials"] = new_mats

    # ── keyframes 全清空 ─────────────────────────────────────────
    orig_kf = template_data.get("keyframes") or {}
    new["keyframes"] = {k: [] for k in (orig_kf or
                        {"adjusts":[], "audios":[], "effects":[], "filters":[],
                         "handwrites":[], "stickers":[], "texts":[], "videos":[]})}
    new["keyframe_graph_list"] = []

    # ── 顶层（duration；id 保持原值）────────────────────────────
    new["duration"] = total_duration_us

    return new


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="生成最小剪映草稿（1视频+1音频+1字幕，seed-based）"
    )
    parser.add_argument("--template",  required=True,
                        help="Storybound 模板草稿目录（含 draft_info.json）")
    parser.add_argument("--output",    required=True,
                        help="输出草稿目录（不能已存在）")
    parser.add_argument("--video",     required=True,
                        help="视频文件绝对路径（.mp4）")
    parser.add_argument("--audio",     required=True,
                        help="音频文件绝对路径（.mp3/.wav）")
    parser.add_argument("--subtitle",  default="CLEAN 字幕 1",
                        help="字幕文本（默认：CLEAN 字幕 1）")
    parser.add_argument("--duration",  type=int, default=5_000_000,
                        help="总时长（微秒，默认 5000000 = 5秒）")
    parser.add_argument("--video-duration", type=int, default=None,
                        help="视频素材时长（微秒，默认与 --duration 相同）")
    parser.add_argument("--audio-duration", type=int, default=None,
                        help="音频素材时长（微秒，默认与 --duration 相同）")
    args = parser.parse_args()

    template_dir = Path(args.template).resolve()
    output_dir   = Path(args.output).resolve()
    video_path   = Path(args.video).resolve()
    audio_path   = Path(args.audio).resolve()
    total_us     = args.duration
    video_us     = args.video_duration or total_us
    audio_us     = args.audio_duration or total_us

    # ── 参数验证 ─────────────────────────────────────────────────
    if not template_dir.exists():
        print(f"[错误] 模板目录不存在: {template_dir}")
        sys.exit(1)
    draft_info_src = template_dir / "draft_info.json"
    if not draft_info_src.exists():
        print(f"[错误] 模板目录没有 draft_info.json: {template_dir}")
        sys.exit(1)
    if not video_path.exists():
        print(f"[错误] 视频文件不存在: {video_path}")
        sys.exit(1)
    if not audio_path.exists():
        print(f"[错误] 音频文件不存在: {audio_path}")
        sys.exit(1)
    if output_dir.exists():
        print(f"[错误] 输出目录已存在，请先删除或换名: {output_dir}")
        sys.exit(1)

    print(f"\n[1/5] 复制模板到输出目录...")
    shutil.copytree(str(template_dir), str(output_dir))
    print(f"      完成: {output_dir}")

    print(f"\n[2/5] 复制素材...")
    vid_dir = output_dir / "assets" / "video"
    aud_dir = output_dir / "assets" / "audio"
    vid_dir.mkdir(parents=True, exist_ok=True)
    aud_dir.mkdir(parents=True, exist_ok=True)
    vid_dst = vid_dir / video_path.name
    aud_dst = aud_dir / audio_path.name
    shutil.copy2(str(video_path), str(vid_dst))
    shutil.copy2(str(audio_path), str(aud_dst))
    print(f"      视频 → {vid_dst}")
    print(f"      音频 → {aud_dst}")

    print(f"\n[3/5] 读取模板 draft_info.json...")
    template_data = json.loads(
        (output_dir / "draft_info.json").read_text(encoding="utf-8")
    )
    m = template_data.get("materials") or {}
    t = template_data.get("tracks") or []
    print(f"      模板 duration : {template_data.get('duration')}µs")
    print(f"      模板 id       : {template_data.get('id')}")
    print(f"      模板 videos   : {len(m.get('videos') or [])}")
    print(f"      模板 audios   : {len(m.get('audios') or [])}")
    print(f"      模板 texts    : {len(m.get('texts') or [])}")
    print(f"      模板 tracks   : {len(t)}")

    print(f"\n[4/5] 重建 draft_info.json（seed-based）...")
    new_data = build_draft_info(
        template_data    = template_data,
        video_abs_path   = str(vid_dst),
        video_duration_us = video_us,
        audio_abs_path   = str(aud_dst),
        audio_duration_us = audio_us,
        subtitle_text    = args.subtitle,
        total_duration_us = total_us,
    )
    out_json = output_dir / "draft_info.json"
    out_json.write_text(
        json.dumps(new_data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    print(f"      写入: {out_json}  ({out_json.stat().st_size/1024:.1f} KB)")

    print(f"\n[5/5] 结构自验:")
    tracks = new_data.get("tracks") or []
    mats   = new_data.get("materials") or {}
    print(f"      duration         : {new_data.get('duration')}µs = {total_us/1e6:.1f}s")
    print(f"      tracks           : {len(tracks)}")
    for tr in tracks:
        segs = tr.get("segments") or []
        print(f"        [{tr.get('type'):<6}] segments={len(segs)}")
    for key in ["videos", "audios", "texts", "speeds"]:
        lst = mats.get(key) or []
        print(f"      materials.{key:<10}: {len(lst)}")

    # 字幕文本验证
    txt_items = mats.get("texts") or []
    for i, t in enumerate(txt_items):
        raw = t.get("content") or ""
        try:
            text = json.loads(raw).get("text", "?")
        except Exception:
            text = raw[:40]
        print(f"      字幕 [{i+1}]          : {text!r}")

    # 路径存在验证
    for key in ["videos", "audios"]:
        for item in (mats.get(key) or []):
            p = item.get("path", "")
            ok = "✓" if Path(p).exists() else "✗ 不存在"
            print(f"      {key[:-1]} path       : {ok}  {p}")

    kf = new_data.get("keyframes") or {}
    all_empty = all(v == [] for v in kf.values() if isinstance(v, list))
    print(f"      keyframes        : {'全清空 ✓' if all_empty else '未清空 ✗'}")

    # 检查 extra_material_refs 不引用不存在 id
    all_mat_ids = {
        obj.get("id")
        for lst in mats.values() if isinstance(lst, list)
        for obj in lst
    }
    dangling = []
    for tr in tracks:
        for seg in (tr.get("segments") or []):
            for ref in (seg.get("extra_material_refs") or []):
                if ref not in all_mat_ids:
                    dangling.append(ref)
    if dangling:
        print(f"      extra_refs 悬空  : ✗ {dangling[:3]}（需排查）")
    else:
        print(f"      extra_refs 悬空  : ✓ 无悬空引用")

    print(f"""
================================================================
输出: {output_dir}

⚠ 云端不能验证剪映 GUI。请本地完成：

  1. 打开剪映专业版
  2. 草稿列表找到: {output_dir.name}
  3. 验证:
     - 时间线总时长 ≈ {total_us/1e6:.1f} 秒
     - 1 个视频片段能播放画面
     - 1 个音频片段能听见声音
     - 字幕显示: {args.subtitle!r}
     - 无 Media Not Found
================================================================
""")


if __name__ == "__main__":
    main()
