#!/usr/bin/env python3
"""
create_draft_info_test.py — 基于 Storybound 草稿模板，重建 draft_info.json 时间线

策略：
  1. 完整复制模板草稿目录到输出目录（保留 opaque 文件，以便剪映能打开）
  2. 把视频/音频资源复制到 output/assets/video/ 和 output/assets/audio/
  3. 读取 output/draft_info.json（模板的明文时间线）
  4. 提取模板的顶层元信息（canvas_config / fps / version / config / id 等）
  5. 完整清空并重建：tracks / materials / keyframes
  6. 写回 output/draft_info.json
  7. 自动调用 inspect_draft.py 做结构验证

结构来源：
  基于真实 Storybound 草稿包（storybound_draft_structure_pack.zip）分析得出
  详见 docs/jianying-draft-info-analysis.md

用法：
  python tools/jianying_draft/create_draft_info_test.py \\
    --template <storybound_draft_dir> \\
    --output   <new_draft_dir> \\
    --video    video1.mp4 \\
    --video    video2.mp4 \\
    --video    video3.mp4 \\
    --audio    audio1.mp3 \\
    --title    DRAFT_INFO_ONLY_3V_1A_3T_5S_20260607

注意：
  - 视频/音频文件必须实际存在，否则脚本报错退出
  - 路径写绝对路径（剪映要求）
  - 云端无法验证剪映 GUI，需用户本地运行后打开剪映检验
"""

import argparse
import copy
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path


TOTAL_DURATION_US = 5_000_000   # 5 秒（默认测试时长）


# ────────────────────────────────────────────────
# ID 生成（Storybound 格式：32位小写十六进制）
# ────────────────────────────────────────────────

def new_hex_id() -> str:
    """32位小写十六进制，与 Storybound segment/material/track ID 格式一致"""
    return uuid.uuid4().hex  # e.g. 'fefc392cf05b44e39f2048c6ffdb27b9'


def new_uuid() -> str:
    """大写 UUID 带连字符，用于草稿顶层 ID"""
    return str(uuid.uuid4()).upper()


# ────────────────────────────────────────────────
# 时间工具
# ────────────────────────────────────────────────

def sec_to_us(s: float) -> int:
    return int(float(s) * 1_000_000)


def now_s() -> int:
    return int(time.time())


# ────────────────────────────────────────────────
# ffprobe
# ────────────────────────────────────────────────

def _ffprobe_bin() -> str:
    candidates = [
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe",
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe.exe",
        "ffprobe",
    ]
    return next((str(c) for c in candidates if Path(str(c)).exists()), "ffprobe")


def probe_duration_us(path: Path) -> int | None:
    try:
        r = subprocess.run(
            [_ffprobe_bin(), "-v", "error",
             "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=15
        )
        return sec_to_us(float(r.stdout.strip()))
    except Exception:
        return None


def probe_video_dims(path: Path) -> tuple[int, int]:
    try:
        r = subprocess.run(
            [_ffprobe_bin(), "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height",
             "-of", "csv=s=x:p=0", str(path)],
            capture_output=True, text=True, timeout=15
        )
        parts = r.stdout.strip().split("x")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 1080, 1920


# ────────────────────────────────────────────────
# 素材路径辅助（供测试模块导入）
# ────────────────────────────────────────────────

def collect_material_paths_from_data(draft_data: dict) -> list[str]:
    """从 draft_info dict 提取所有素材路径（video + audio）"""
    paths = []
    materials = draft_data.get("materials") or {}
    for mkey in ["videos", "audios", "images"]:
        for item in (materials.get(mkey) or []):
            v = item.get("path") or item.get("file_Path") or ""
            if v and v not in paths:
                paths.append(v)
    return paths


# ────────────────────────────────────────────────
# Video material（type: "video"，基于 Storybound photo 结构简化）
# ────────────────────────────────────────────────

def build_video_material(mat_id: str, abs_path: str, duration_us: int,
                         w: int, h: int, name: str,
                         proto: dict | None = None) -> dict:
    base = {
        "audio_fade": None,
        "category_id": "",
        "category_name": "local",
        "check_flag": 63487,
        "crop": {
            "upper_left_x": 0.0, "upper_left_y": 0.0,
            "upper_right_x": 1.0, "upper_right_y": 0.0,
            "lower_left_x": 0.0, "lower_left_y": 1.0,
            "lower_right_x": 1.0, "lower_right_y": 1.0
        },
        "crop_ratio": "free",
        "crop_scale": 1.0,
        "duration": duration_us,
        "height": h,
        "id": mat_id,
        "local_material_id": mat_id,
        "material_id": mat_id,
        "material_name": name,
        "media_path": "",
        "path": abs_path,
        "remote_url": None,
        "type": "video",
        "width": w
    }
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id, "local_material_id": mat_id, "material_id": mat_id,
            "path": abs_path, "duration": duration_us, "width": w, "height": h,
            "material_name": name, "media_path": "", "type": "video",
        })
        return merged
    return base


# ────────────────────────────────────────────────
# Audio material
# ────────────────────────────────────────────────

def build_audio_material(mat_id: str, abs_path: str, duration_us: int,
                         name: str, proto: dict | None = None) -> dict:
    base = {
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "copyright_limit_type": "none",
        "duration": duration_us,
        "effect_id": "",
        "formula_id": "",
        "id": mat_id,
        "intensifies_path": "",
        "is_ai_clone_tone": False,
        "is_text_edit_overdub": False,
        "is_ugc": False,
        "local_material_id": mat_id,
        "music_id": mat_id,
        "name": Path(name).stem,
        "path": abs_path,
        "remote_url": None,
        "query": "",
        "request_id": "",
        "resource_id": "",
        "search_id": "",
        "source_from": "",
        "source_platform": 0,
        "team_id": "",
        "text_id": "",
        "tone_category_id": "", "tone_category_name": "",
        "tone_effect_id": "", "tone_effect_name": "",
        "tone_platform": "",
        "tone_second_category_id": "", "tone_second_category_name": "",
        "tone_speaker": "", "tone_type": "",
        "type": "extract_music",
        "video_id": "",
        "wave_points": []
    }
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id, "local_material_id": mat_id, "music_id": mat_id,
            "path": abs_path, "duration": duration_us,
            "name": Path(name).stem,
        })
        return merged
    return base


# ────────────────────────────────────────────────
# Subtitle material（type: "subtitle"，非 "text"）
# ────────────────────────────────────────────────

def _make_subtitle_content(text: str) -> str:
    """构建 content 字段内嵌 JSON（基于真实 Storybound 格式）"""
    obj = {
        "styles": [{
            "fill": {
                "alpha": 1.0,
                "content": {
                    "render_type": "solid",
                    "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                }
            },
            "range": [0, len(text)],
            "size": 12.0,
            "bold": False,
            "italic": False,
            "underline": False,
            "strokes": [{
                "content": {"solid": {"alpha": 0.0, "color": [0.0, 0.0, 0.0]}},
                "width": 0.0
            }]
        }],
        "text": text
    }
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def build_subtitle_material(mat_id: str, text: str,
                            proto: dict | None = None) -> dict:
    base = {
        "id": mat_id,
        "content": _make_subtitle_content(text),
        "typesetting": 0,
        "alignment": 1,
        "letter_spacing": 0.0,
        "line_spacing": 0.02,
        "line_feed": 1,
        "line_max_width": 1.0,
        "force_apply_line_max_width": False,
        "check_flag": 31,
        "type": "subtitle",
        "fixed_width": -1,
        "fixed_height": -1,
        "font_category_id": "",
        "font_category_name": "",
        "font_id": "",
        "font_name": "",
        "font_path": "",
        "font_resource_id": "",
        "font_size": 15.0,
        "font_source_platform": 0,
        "font_team_id": "",
        "font_title": "none",
        "font_url": "",
        "fonts": [],
        "background_style": 0,
        "background_color": "#000000",
        "background_alpha": 0.5,
        "background_round_radius": 0.3,
        "background_height": 0.14,
        "background_width": 0.14,
        "background_horizontal_offset": 0.0,
        "background_vertical_offset": 0.0,
        "sub_type": 0,
        "recognize_type": 0,
        "is_rich_text": True,
        "caption_template_info": {
            "category_id": "", "category_name": "", "effect_id": "",
            "is_new": False, "path": "", "request_id": "",
            "resource_id": "", "resource_name": "", "source_platform": 0
        },
        "combo_info": {"text_templates": []},
        "words": {"end_time": [], "start_time": [], "text": []},
        "subtitle_keywords": None
    }
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id,
            "content": _make_subtitle_content(text),
            "words": {"end_time": [], "start_time": [], "text": []},
            "subtitle_keywords": None,
        })
        return merged
    return base


# ────────────────────────────────────────────────
# Speed material（为 video/audio segment 提供速度参数）
# ────────────────────────────────────────────────

def build_speed_material(spd_id: str) -> dict:
    return {
        "curve_speed": None,
        "id": spd_id,
        "mode": 0,
        "speed": None,
        "type": "speed"
    }


# ────────────────────────────────────────────────
# Segment 构建
# ────────────────────────────────────────────────

def _base_segment(seg_id: str, mat_id: str) -> dict:
    """所有 segment 共有的字段"""
    return {
        "enable_adjust": True,
        "enable_color_correct_adjust": False,
        "enable_color_curves": True,
        "enable_color_match_adjust": False,
        "enable_color_wheels": True,
        "enable_lut": True,
        "enable_smart_color_adjust": False,
        "last_nonzero_volume": 1.0,
        "reverse": False,
        "track_attribute": 0,
        "track_render_index": 0,
        "visible": True,
        "id": seg_id,
        "material_id": mat_id,
        "common_keyframes": [],
        "keyframe_refs": [],
    }


def build_video_segment(seg_id: str, mat_id: str, speed_id: str,
                        source_dur: int, target_start: int, target_dur: int) -> dict:
    seg = _base_segment(seg_id, mat_id)
    seg.update({
        "target_timerange": {"start": target_start, "duration": target_dur},
        "source_timerange": {"start": 0, "duration": source_dur},
        "speed": None,       # Storybound photo/video segments 用 null
        "volume": 1.0,
        "extra_material_refs": [speed_id] if speed_id else [],
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0}   # transform，不是 translation！
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
        "render_index": 0,
    })
    return seg


def build_audio_segment(seg_id: str, mat_id: str, speed_id: str,
                        source_dur: int, target_start: int, target_dur: int) -> dict:
    seg = _base_segment(seg_id, mat_id)
    seg.update({
        "target_timerange": {"start": target_start, "duration": target_dur},
        "source_timerange": {"start": 0, "duration": source_dur},
        "speed": 1.0,
        "volume": 1.0,
        "extra_material_refs": [speed_id] if speed_id else [],
        "clip": None,
        "hdr_settings": None,
        "render_index": 0,
    })
    return seg


def build_text_segment(seg_id: str, mat_id: str,
                       target_start: int, target_dur: int,
                       render_index: int = 15000) -> dict:
    seg = _base_segment(seg_id, mat_id)
    seg.update({
        "target_timerange": {"start": target_start, "duration": target_dur},
        "source_timerange": None,    # text segment source_timerange 是 null
        "speed": 1.0,
        "volume": 1.0,
        "extra_material_refs": [],   # 不引用 dangling refs
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": -0.215}  # 靠近顶部
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "render_index": render_index,
    })
    return seg


def build_track(track_id: str, track_type: str, segments: list,
                name: str = "", is_default_name: bool = True) -> dict:
    return {
        "attribute": 0,
        "flag": 0,
        "id": track_id,
        "is_default_name": is_default_name,
        "name": name,
        "type": track_type,
        "segments": segments,
    }


# ────────────────────────────────────────────────
# keyframes 清空
# ────────────────────────────────────────────────

def clear_keyframes(kf: dict | None) -> dict:
    """清空所有 keyframes 子数组，保留 key 结构"""
    if not kf:
        # 使用 Storybound 确认的 keys
        return {k: [] for k in ["adjusts", "audios", "effects", "filters",
                                 "handwrites", "stickers", "texts", "videos"]}
    return {k: [] if isinstance(v, list) else v for k, v in kf.items()}


# ────────────────────────────────────────────────
# materials 清空（保留 keys，清空无关 lists）
# ────────────────────────────────────────────────

def clear_materials_extra(materials: dict) -> dict:
    keep_keys = {"videos", "audios", "texts", "speeds"}
    result = {}
    for k, v in materials.items():
        if k in keep_keys:
            result[k] = v   # 由调用方设置
        elif isinstance(v, list):
            result[k] = []  # 清空：stickers, effects, material_animations, etc.
        else:
            result[k] = v
    return result


# ────────────────────────────────────────────────
# 核心重建函数
# ────────────────────────────────────────────────

def rebuild_draft_info(template_data: dict,
                       video_info: list[dict],   # [{path, dur_us, w, h}]
                       audio_info: list[dict],   # [{path, dur_us}]
                       subtitle_texts: list[str],
                       total_dur_us: int) -> dict:
    """
    保留 template_data 的顶层元信息（canvas_config / fps / version / id / config 等），
    完全重建 tracks / materials / keyframes。

    draft id 保持不变（必须与 Timelines/<id>/ 文件夹名一致）。
    """
    new = copy.deepcopy(template_data)
    materials = template_data.get("materials") or {}

    # 原型提取：用模板的第一个同类 material 作为字段模板
    vid_proto = (materials.get("videos") or [None])[0]
    aud_proto = (materials.get("audios") or [None])[0]
    txt_proto = (materials.get("texts") or [None])[0]

    # ── video materials + speeds ──────────────────────────────────
    n_vid = len(video_info)
    seg_dur_each = total_dur_us // n_vid if n_vid else 0

    vid_mats, vid_seg_plans, speed_mats = [], [], []

    for i, vi in enumerate(video_info):
        mat_id  = new_hex_id()
        spd_id  = new_hex_id()
        abs_path = str(Path(vi["path"]).resolve())
        target_start = i * seg_dur_each
        target_dur   = seg_dur_each if i < n_vid - 1 else (total_dur_us - target_start)
        dur_us  = vi.get("dur_us") or target_dur

        vid_mats.append(build_video_material(
            mat_id, abs_path, dur_us,
            vi.get("w", 1080), vi.get("h", 1920),
            Path(vi["path"]).name, vid_proto
        ))
        speed_mats.append(build_speed_material(spd_id))
        vid_seg_plans.append({
            "mat_id": mat_id, "spd_id": spd_id, "source_dur": dur_us,
            "target_start": target_start, "target_dur": target_dur,
        })

    # ── audio materials + speeds ──────────────────────────────────
    aud_mats, aud_seg_plans = [], []
    for ai in audio_info:
        mat_id   = new_hex_id()
        spd_id   = new_hex_id()
        abs_path = str(Path(ai["path"]).resolve())
        dur_us   = min(ai.get("dur_us") or total_dur_us, total_dur_us)

        aud_mats.append(build_audio_material(
            mat_id, abs_path, dur_us,
            Path(ai["path"]).name, aud_proto
        ))
        speed_mats.append(build_speed_material(spd_id))
        aud_seg_plans.append({
            "mat_id": mat_id, "spd_id": spd_id, "source_dur": dur_us,
            "target_start": 0, "target_dur": dur_us,
        })

    # ── subtitle materials ────────────────────────────────────────
    n_txt = len(subtitle_texts)
    txt_seg_dur = total_dur_us // n_txt if n_txt else 0
    txt_mats, txt_seg_plans = [], []
    for i, text in enumerate(subtitle_texts):
        mat_id = new_hex_id()
        target_start = i * txt_seg_dur
        target_dur   = txt_seg_dur if i < n_txt - 1 else (total_dur_us - target_start)
        txt_mats.append(build_subtitle_material(mat_id, text, txt_proto))
        txt_seg_plans.append({
            "mat_id": mat_id, "target_start": target_start, "target_dur": target_dur,
        })

    # ── segments ─────────────────────────────────────────────────
    vid_segs = [
        build_video_segment(new_hex_id(), p["mat_id"], p["spd_id"],
                            p["source_dur"], p["target_start"], p["target_dur"])
        for p in vid_seg_plans
    ]
    aud_segs = [
        build_audio_segment(new_hex_id(), p["mat_id"], p["spd_id"],
                            p["source_dur"], p["target_start"], p["target_dur"])
        for p in aud_seg_plans
    ]
    txt_segs = [
        build_text_segment(new_hex_id(), p["mat_id"],
                           p["target_start"], p["target_dur"],
                           render_index=15000 + i)
        for i, p in enumerate(txt_seg_plans)
    ]

    # ── tracks ───────────────────────────────────────────────────
    new["tracks"] = [
        build_track(new_hex_id(), "video", vid_segs),
        build_track(new_hex_id(), "audio", aud_segs),
        build_track(new_hex_id(), "text",  txt_segs),
    ]

    # ── materials ─────────────────────────────────────────────────
    new_mats = clear_materials_extra(materials)
    new_mats["videos"] = vid_mats
    new_mats["audios"] = aud_mats
    new_mats["texts"]  = txt_mats
    new_mats["speeds"] = speed_mats
    new["materials"] = new_mats

    # ── keyframes ─────────────────────────────────────────────────
    new["keyframes"]           = clear_keyframes(new.get("keyframes"))
    new["keyframe_graph_list"] = []

    # ── 顶层字段 ──────────────────────────────────────────────────
    new["duration"] = total_dur_us
    # id 保持原值！（必须与 Timelines/<id>/ 一致）

    return new


# ────────────────────────────────────────────────
# 验证
# ────────────────────────────────────────────────

def self_verify(new_content: dict,
                video_info: list, audio_info: list, subtitles: list) -> bool:
    ok = True
    dur = new_content.get("duration")
    if dur != TOTAL_DURATION_US:
        print(f"  [✗] duration={dur}, 期望 {TOTAL_DURATION_US}")
        ok = False
    else:
        print(f"  [✓] duration={TOTAL_DURATION_US}")

    mats = new_content.get("materials") or {}
    for key, expected in [("videos", len(video_info)),
                          ("audios", len(audio_info)),
                          ("texts",  len(subtitles))]:
        actual = len(mats.get(key) or [])
        sym = "✓" if actual == expected else "✗"
        print(f"  [{sym}] materials.{key}={actual}  期望={expected}")
        if actual != expected:
            ok = False

    # 字幕内容
    actual_texts = []
    for item in (mats.get("texts") or []):
        raw = item.get("content") or ""
        try:
            actual_texts.append(json.loads(raw).get("text", ""))
        except Exception:
            actual_texts.append(raw[:30])
    for expected_txt in subtitles:
        if expected_txt in actual_texts:
            print(f"  [✓] 字幕存在: {expected_txt!r}")
        else:
            print(f"  [✗] 字幕缺失: {expected_txt!r}")
            ok = False

    # 无残留旧字幕
    residual = [t for t in actual_texts if "CLEAN" not in t and t]
    if residual:
        print(f"  [✗] 疑似残留旧字幕: {residual[:3]}")
        ok = False
    else:
        print(f"  [✓] 无残留旧字幕")

    # 字幕 type 字段
    bad_type = [t.get("type") for t in (mats.get("texts") or []) if t.get("type") != "subtitle"]
    if bad_type:
        print(f"  [✗] 字幕 type 错误（应为 subtitle）: {bad_type[:3]}")
        ok = False
    else:
        print(f"  [✓] 字幕 type 全为 subtitle")

    # clip.transform 存在
    tracks = new_content.get("tracks") or []
    vid_track = next((t for t in tracks if t.get("type") == "video"), None)
    if vid_track:
        segs = vid_track.get("segments") or []
        if segs:
            clip = (segs[0].get("clip") or {})
            if "transform" in clip:
                print(f"  [✓] video segment clip.transform 存在")
            else:
                print(f"  [✗] video segment clip.transform 缺失（clip.translation 是旧格式）")
                ok = False

    # speeds
    speeds = mats.get("speeds") or []
    expected_speeds = len(video_info) + len(audio_info)
    sym = "✓" if len(speeds) == expected_speeds else "✗"
    print(f"  [{sym}] materials.speeds={len(speeds)}  期望={expected_speeds}")

    if not ok:
        print("\n  [!] 自验发现问题，请检查上面错误项")
    else:
        print("\n  [✓] 自验全部通过")
    return ok


def run_inspect(output_dir: Path):
    script = Path(__file__).parent / "inspect_draft.py"
    if not script.exists():
        print("  [跳过] inspect_draft.py 不在同目录")
        return
    try:
        subprocess.run(
            [sys.executable, str(script), str(output_dir), "--check-media-paths"],
            timeout=30
        )
    except Exception as e:
        print(f"  [警告] inspect_draft.py 调用失败: {e}")


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def run(args):
    template_dir = Path(args.template).resolve()
    output_dir   = Path(args.output).resolve()
    video_paths  = [Path(v).resolve() for v in (args.video or [])]
    audio_paths  = [Path(a).resolve() for a in (args.audio or [])]
    n_vid = len(video_paths)
    subtitles = [f"CLEAN 字幕 {i+1}" for i in range(n_vid or 1)]

    # ── 参数验证 ──────────────────────────────────────────────────
    if not template_dir.exists():
        print(f"[错误] 模板目录不存在: {template_dir}")
        sys.exit(1)
    if not (template_dir / "draft_info.json").exists():
        print(f"[错误] 模板目录里没有 draft_info.json: {template_dir}")
        sys.exit(1)
    for p in video_paths + audio_paths:
        if not p.exists():
            print(f"[错误] 文件不存在: {p}")
            print("       请传入真实存在的视频/音频文件，不能生成假草稿")
            sys.exit(1)
    if len(video_paths) < 1:
        print("[错误] 至少需要 1 个视频文件（--video）")
        sys.exit(1)
    if len(audio_paths) < 1:
        print("[错误] 至少需要 1 个音频文件（--audio）")
        sys.exit(1)

    print(f"\n[1/7] 读取模板 draft_info.json ...")
    template_data = json.loads((template_dir / "draft_info.json").read_text(encoding="utf-8"))
    orig_mats = template_data.get("materials") or {}
    print(f"      原 duration   : {template_data.get('duration')}")
    print(f"      原 videos     : {len(orig_mats.get('videos') or [])}")
    print(f"      原 audios     : {len(orig_mats.get('audios') or [])}")
    print(f"      原 texts      : {len(orig_mats.get('texts') or [])}")

    print(f"\n[2/7] 复制模板到输出目录 ...")
    if output_dir.exists():
        print(f"      目标目录已存在，先删除: {output_dir}")
        shutil.rmtree(output_dir)
    shutil.copytree(str(template_dir), str(output_dir))
    print(f"      复制完成: {output_dir}")

    print(f"\n[3/7] 创建 assets 目录并复制素材 ...")
    vid_dir = output_dir / "assets" / "video"
    aud_dir = output_dir / "assets" / "audio"
    vid_dir.mkdir(parents=True, exist_ok=True)
    aud_dir.mkdir(parents=True, exist_ok=True)

    video_info = []
    for vp in video_paths:
        dst = vid_dir / vp.name
        shutil.copy2(str(vp), str(dst))
        dur_us = probe_duration_us(dst)
        w, h   = probe_video_dims(dst)
        if dur_us is None:
            dur_us = TOTAL_DURATION_US // len(video_paths)
            print(f"      视频 → {dst.name}  (ffprobe 不可用，占位 {dur_us}µs)")
        else:
            print(f"      视频 → {dst.name}  {dur_us}µs  {w}×{h}")
        video_info.append({"path": str(dst), "dur_us": dur_us, "w": w, "h": h})

    audio_info = []
    for ap in audio_paths:
        dst = aud_dir / ap.name
        shutil.copy2(str(ap), str(dst))
        dur_us = probe_duration_us(dst)
        if dur_us is None:
            dur_us = TOTAL_DURATION_US
            print(f"      音频 → {dst.name}  (ffprobe 不可用，占位 {dur_us}µs)")
        else:
            print(f"      音频 → {dst.name}  {dur_us}µs")
        audio_info.append({"path": str(dst), "dur_us": dur_us})

    print(f"\n[4/7] 重建 draft_info.json ...")
    print(f"      视频数: {len(video_info)}  音频数: {len(audio_info)}")
    print(f"      字幕: {subtitles}")
    print(f"      总时长: {TOTAL_DURATION_US}µs (5s)")

    new_content = rebuild_draft_info(
        template_data  = template_data,
        video_info     = video_info,
        audio_info     = audio_info,
        subtitle_texts = subtitles,
        total_dur_us   = TOTAL_DURATION_US,
    )

    print(f"\n[5/7] 写回 draft_info.json ...")
    out_json = output_dir / "draft_info.json"
    out_json.write_text(json.dumps(new_content, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      {out_json}  ({out_json.stat().st_size/1024:.1f}KB)")

    print(f"\n[6/7] 结构自验 ...")
    self_verify(new_content, video_info, audio_info, subtitles)

    print(f"\n[7/7] inspect_draft.py 完整检查 ...")
    run_inspect(output_dir)

    print(f"\n✓ 草稿生成完成")
    print(f"  输出目录: {output_dir}")
    print()
    print("下一步（本地操作）:")
    print(f"  1. 把草稿目录复制到剪映草稿根目录：")
    print(f"     Windows: %LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\")
    print(f"     或剪映设置里看草稿保存路径")
    print(f"  2. 打开剪映专业版，在草稿列表找到该草稿")
    print(f"  3. 检查：时长 5s / video {len(video_info)} 段 / audio 1 段 / 字幕 {len(subtitles)} 条")
    print(f"  4. 若 Media Not Found：检查 assets/video 和 assets/audio 路径是否一致")
    print(f"\n[注意] 云端无剪映 GUI，脚本层结构检查通过，需用户本地打开剪映验证")


def main():
    parser = argparse.ArgumentParser(
        description="基于 Storybound 草稿模板重建 draft_info.json 时间线",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--template", required=True,
                        help="Storybound 样本草稿目录（含 draft_info.json）")
    parser.add_argument("--output",   required=True,
                        help="新草稿输出目录")
    parser.add_argument("--video",    action="append", default=[],
                        help="视频文件路径（可多次指定）")
    parser.add_argument("--audio",    action="append", default=[],
                        help="音频文件路径（可多次指定）")
    parser.add_argument("--title",    default="",
                        help="草稿名称（预留，draft_meta_info.json 是 opaque 无法直接写入）")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
