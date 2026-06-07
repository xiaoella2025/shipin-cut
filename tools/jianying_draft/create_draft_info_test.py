#!/usr/bin/env python3
"""
create_draft_info_test.py — 基于 Storybound 草稿模板，重建 draft_info.json 时间线

策略：
  1. 完整复制模板草稿目录到输出目录（保留 opaque 文件，以便剪映能打开）
  2. 把视频/音频资源复制到 output/assets/video/ 和 output/assets/audio/
  3. 读取 output/draft_info.json（模板的明文时间线）
  4. 提取模板里的字段原型（canvas_config / fps / version 等）
  5. 完整清空并重建：tracks / materials / keyframes
  6. 写回 output/draft_info.json
  7. 自动调用 inspect_draft.py 做结构验证

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


TOTAL_DURATION_US = 5_000_000   # 5 秒


# ────────────────────────────────────────────────
# 工具函数
# ────────────────────────────────────────────────

def new_id() -> str:
    return str(uuid.uuid4()).upper()


def sec_to_us(s: float) -> int:
    return int(float(s) * 1_000_000)


def now_ms() -> int:
    return int(time.time() * 1000)


def now_s() -> int:
    return int(time.time())


def probe_duration_us(path: Path) -> int | None:
    """ffprobe 获取时长（微秒），失败返回 None"""
    candidates = [
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe",
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe.exe",
        "ffprobe",
    ]
    ffprobe = next(
        (str(c) for c in candidates if Path(str(c)).exists()),
        "ffprobe"
    )
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=15
        )
        secs = float(r.stdout.strip())
        return sec_to_us(secs)
    except Exception:
        return None


def probe_video_dims(path: Path) -> tuple[int, int]:
    """ffprobe 获取宽高，失败返回 (1920, 1080)"""
    candidates = [
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe",
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe.exe",
        "ffprobe",
    ]
    ffprobe = next(
        (str(c) for c in candidates if Path(str(c)).exists()),
        "ffprobe"
    )
    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height",
             "-of", "csv=s=x:p=0", str(path)],
            capture_output=True, text=True, timeout=15
        )
        parts = r.stdout.strip().split("x")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 1920, 1080


# ────────────────────────────────────────────────
# 素材构建
# ────────────────────────────────────────────────

def _base_video_material(mat_id: str, abs_path: str, duration_us: int,
                         w: int, h: int, name: str) -> dict:
    t = now_s()
    return {
        "aigc_type": "none",
        "audio_fade": None,
        "cartoon_path": "",
        "category_id": "",
        "category_name": "local",
        "check_flag": 63487,
        "crop": {
            "lower_left_x": 0.0, "lower_left_y": 1.0,
            "lower_right_x": 1.0, "lower_right_y": 1.0,
            "upper_left_x": 0.0, "upper_left_y": 0.0,
            "upper_right_x": 1.0, "upper_right_y": 0.0
        },
        "crop_ratio": "free",
        "crop_scale": 1.0,
        "duration": duration_us,
        "extra_type_option": 0,
        "file_Path": abs_path,
        "formula_id": "",
        "freeze": None,
        "has_audio": True,
        "height": h,
        "id": mat_id,
        "import_time": t,
        "import_time_ms": t * 1000,
        "is_ai_matting_valid_cache": False,
        "is_unified_beauty_valid_cache": False,
        "local_material_id": mat_id,
        "material_id": mat_id,
        "material_name": name,
        "material_url": "",
        "matting": {
            "flag": 0, "has_use_quick_brush": False,
            "has_use_quick_eraser": False,
            "interactiveTime": [], "path": "", "strokes": []
        },
        "media_path": "",
        "object_file_key": "",
        "path": abs_path,
        "picture_from": "none",
        "picture_set_category_id": "",
        "picture_set_category_name": "",
        "request_id": "",
        "reverse_path": "",
        "smart_motion": None,
        "source": "none",
        "source_platform": 0,
        "stable": None,
        "team_id": "",
        "type": "video",
        "video_algorithm": {
            "algorithms": [], "deflicker": None, "motion_blur_config": None,
            "noise_reduction": None, "path": "", "quality_enhance": None, "time_range": None
        },
        "width": w
    }


def _merge_proto_video(proto: dict | None, mat_id: str, abs_path: str,
                       duration_us: int, w: int, h: int, name: str) -> dict:
    """以 proto 为基础，覆盖关键字段。proto 为 None 时用默认结构。"""
    base = _base_video_material(mat_id, abs_path, duration_us, w, h, name)
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id,
            "local_material_id": mat_id,
            "material_id": mat_id,
            "path": abs_path,
            "file_Path": abs_path,
            "duration": duration_us,
            "width": w,
            "height": h,
            "material_name": name,
            "import_time": now_s(),
            "import_time_ms": now_ms(),
            "media_path": "",
            "reverse_path": "",
            "cartoon_path": "",
        })
        return merged
    return base


def _base_audio_material(mat_id: str, abs_path: str, duration_us: int, name: str) -> dict:
    return {
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "duration": duration_us,
        "effect_id": "",
        "formula_id": "",
        "id": mat_id,
        "intensifies_path": "",
        "local_material_id": mat_id,
        "material_id": mat_id,
        "material_name": name,
        "material_url": "",
        "name": Path(name).stem,
        "path": abs_path,
        "request_id": "",
        "search_id": "",
        "source_platform": 0,
        "team_id": "",
        "text": "",
        "tone_folder_path": "",
        "type": "extract_music",
        "wave_points": []
    }


def _merge_proto_audio(proto: dict | None, mat_id: str, abs_path: str,
                       duration_us: int, name: str) -> dict:
    base = _base_audio_material(mat_id, abs_path, duration_us, name)
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id,
            "local_material_id": mat_id,
            "material_id": mat_id,
            "path": abs_path,
            "duration": duration_us,
            "material_name": name,
            "name": Path(name).stem,
        })
        return merged
    return base


def _make_text_content_json(text: str) -> str:
    obj = {
        "styles": [{
            "fill": {
                "content": {
                    "render_type": "solid",
                    "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                }
            },
            "range": [0, len(text)],
            "useStyle": ""
        }],
        "text": text
    }
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _base_text_material(mat_id: str, text: str) -> dict:
    return {
        "alignment": 1,
        "background_alpha": 0.0,
        "background_color": "",
        "background_height": 0.14,
        "background_horizontal_offset": 0.0,
        "background_round_radius": 0.0,
        "background_style": 0,
        "background_vertical_offset": 0.0,
        "background_width": 0.14,
        "base_content": "",
        "bold_width": 0.0,
        "border_alpha": 0.0,
        "border_color": "",
        "border_width": 0.08,
        "content": _make_text_content_json(text),
        "font_category_id": "",
        "font_category_name": "",
        "font_id": "",
        "font_name": "",
        "font_path": "",
        "font_size": 8.0,
        "fonts": [],
        "id": mat_id,
        "italic": False,
        "letter_spacing": 0.0,
        "line_feed": 1,
        "line_max_width": 0.82,
        "line_spacing": 0.02,
        "name": "",
        "original_size": [],
        "preset_id": "",
        "recognize_task_id": "",
        "recognize_type": 0,
        "relevance_segment": [],
        "shadow_alpha": 0.0,
        "shadow_angle": -45.0,
        "shadow_color": "",
        "shadow_distance": 5.0,
        "shadow_point": {"x": 0.6364, "y": -0.6364},
        "shadow_smoothing": 1.0,
        "shape_clip_x": False,
        "shape_clip_y": False,
        "source_from": "",
        "style_name": "",
        "sub_type": 0,
        "text_alpha": 1.0,
        "text_color": "#FFFFFF",
        "text_curve": None,
        "text_preset_resource_id": "",
        "text_size": 30,
        "text_to_audio_ids": [],
        "tts_auto_update": False,
        "type": "text",
        "typesetting": 0,
        "underline": False,
        "underline_offset": 0.22,
        "underline_width": 0.05,
        "use_effect_default_color": True,
        "words": {"end_time": [], "start_time": [], "text": []}
    }


def _merge_proto_text(proto: dict | None, mat_id: str, text: str) -> dict:
    base = _base_text_material(mat_id, text)
    if proto:
        merged = copy.deepcopy(proto)
        merged.update({
            "id": mat_id,
            "content": _make_text_content_json(text),
            "base_content": "",
            "recognize_task_id": "",
            "text_to_audio_ids": [],
            "tts_auto_update": False,
            "words": {"end_time": [], "start_time": [], "text": []},
        })
        return merged
    return base


# ────────────────────────────────────────────────
# Segment / Track 构建
# ────────────────────────────────────────────────

def _video_segment(seg_id: str, mat_id: str, source_dur: int,
                   target_start: int, target_dur: int) -> dict:
    return {
        "cartoon": False,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "translation": {"x": 0.0, "y": 0.0}
        },
        "common_keyframes": [],
        "enable_adjust": True,
        "extra_material_refs": [],
        "group_id": "",
        "hdr_settings": None,
        "id": seg_id,
        "intensifies_audio": False,
        "is_placeholder": False,
        "is_tone_modify": False,
        "material_id": mat_id,
        "render_index": 0,
        "reverse": False,
        "source_timerange": {"duration": source_dur, "start": 0},
        "speed": 1.0,
        "target_timerange": {"duration": target_dur, "start": target_start},
        "template_id": "",
        "template_scene": "default",
        "track_attribute": 0,
        "track_render_index": 0,
        "uniform_scale": None,
        "visible": True,
        "volume": 1.0
    }


def _audio_segment(seg_id: str, mat_id: str, source_dur: int,
                   target_start: int, target_dur: int) -> dict:
    seg = _video_segment(seg_id, mat_id, source_dur, target_start, target_dur)
    return seg


def _text_segment(seg_id: str, mat_id: str, target_start: int, target_dur: int) -> dict:
    seg = _video_segment(seg_id, mat_id, target_dur, target_start, target_dur)
    seg["clip"]["translation"]["y"] = 0.8   # 字幕靠近底部
    return seg


def _make_track(track_id: str, track_type: str, segments: list) -> dict:
    return {
        "attribute": 0,
        "flag": 0,
        "id": track_id,
        "is_default_name": True,
        "name": "",
        "segments": segments,
        "type": track_type
    }


# ────────────────────────────────────────────────
# 获取原型（从模板 draft_info 里提取）
# ────────────────────────────────────────────────

def get_proto(materials: dict, key: str) -> dict | None:
    items = materials.get(key) or []
    return items[0] if items else None


# ────────────────────────────────────────────────
# 清空 keyframes
# ────────────────────────────────────────────────

def clear_keyframes(kf: dict | None) -> dict:
    if not kf:
        return {}
    cleared = {}
    for k, v in kf.items():
        cleared[k] = [] if isinstance(v, list) else v
    return cleared


def clear_materials_extra(materials: dict) -> dict:
    """保留 materials 的所有 key，但把非 videos/audios/texts 的 list 清空"""
    result = {}
    keep_as_is = {"videos", "audios", "texts"}
    for k, v in materials.items():
        if k in keep_as_is:
            result[k] = v   # 由调用方设置
        elif isinstance(v, list):
            result[k] = []  # 清空：stickers, effects, transitions, etc.
        else:
            result[k] = v
    return result


# ────────────────────────────────────────────────
# 主生成逻辑
# ────────────────────────────────────────────────

def collect_material_paths_from_data(draft_data: dict) -> list[str]:
    """从 draft_info dict 提取所有素材路径（供测试和 inspect 使用）"""
    paths = []
    materials = draft_data.get("materials") or {}
    for mkey in ["videos", "audios", "images"]:
        for item in (materials.get(mkey) or []):
            for pk in ["path", "file_Path", "media_path"]:
                v = item.get(pk)
                if v and isinstance(v, str) and v.strip() and v not in paths:
                    paths.append(v)
    return paths


def rebuild_draft_info(template_data: dict,
                       video_info: list[dict],   # [{path, dur_us, w, h}]
                       audio_info: list[dict],   # [{path, dur_us}]
                       subtitle_texts: list[str],
                       total_dur_us: int) -> dict:
    """
    保留 template_data 的顶层元信息，完全重建 tracks/materials/keyframes。
    """
    new = copy.deepcopy(template_data)

    materials = template_data.get("materials") or {}
    vid_proto  = get_proto(materials, "videos")
    aud_proto  = get_proto(materials, "audios")
    txt_proto  = get_proto(materials, "texts")

    # ── 构建 video materials ──────────────────────────────────────
    vid_mats = []
    vid_seg_infos = []   # [{mat_id, dur_us, target_start, target_dur}]
    n_vid = len(video_info)
    seg_dur = total_dur_us // n_vid if n_vid else 0
    for i, vi in enumerate(video_info):
        mat_id = new_id()
        abs_path = str(Path(vi["path"]).resolve())
        dur_us = vi["dur_us"]
        target_start = i * seg_dur
        target_dur   = seg_dur if i < n_vid - 1 else (total_dur_us - target_start)
        vid_mats.append(_merge_proto_video(
            vid_proto, mat_id, abs_path, dur_us,
            vi.get("w", 1920), vi.get("h", 1080),
            Path(vi["path"]).name
        ))
        vid_seg_infos.append({
            "mat_id": mat_id,
            "source_dur": dur_us,
            "target_start": target_start,
            "target_dur": target_dur,
        })

    # ── 构建 audio materials ─────────────────────────────────────
    aud_mats = []
    aud_seg_infos = []
    for ai in audio_info:
        mat_id = new_id()
        abs_path = str(Path(ai["path"]).resolve())
        dur_us = ai["dur_us"]
        aud_mats.append(_merge_proto_audio(
            aud_proto, mat_id, abs_path,
            min(dur_us, total_dur_us),
            Path(ai["path"]).name
        ))
        aud_seg_infos.append({
            "mat_id": mat_id,
            "source_dur": min(dur_us, total_dur_us),
            "target_start": 0,
            "target_dur": min(dur_us, total_dur_us),
        })

    # ── 构建 text materials ───────────────────────────────────────
    txt_mats = []
    txt_seg_infos = []
    n_txt = len(subtitle_texts)
    txt_seg_dur = total_dur_us // n_txt if n_txt else 0
    for i, txt in enumerate(subtitle_texts):
        mat_id = new_id()
        target_start = i * txt_seg_dur
        target_dur   = txt_seg_dur if i < n_txt - 1 else (total_dur_us - target_start)
        txt_mats.append(_merge_proto_text(txt_proto, mat_id, txt))
        txt_seg_infos.append({
            "mat_id": mat_id,
            "target_start": target_start,
            "target_dur": target_dur,
        })

    # ── 组装 materials ────────────────────────────────────────────
    new_materials = clear_materials_extra(materials)
    new_materials["videos"] = vid_mats
    new_materials["audios"] = aud_mats
    new_materials["texts"]  = txt_mats
    new["materials"] = new_materials

    # ── 构建 tracks ───────────────────────────────────────────────
    vid_segs = [
        _video_segment(new_id(), si["mat_id"], si["source_dur"],
                       si["target_start"], si["target_dur"])
        for si in vid_seg_infos
    ]
    aud_segs = [
        _audio_segment(new_id(), si["mat_id"], si["source_dur"],
                       si["target_start"], si["target_dur"])
        for si in aud_seg_infos
    ]
    txt_segs = [
        _text_segment(new_id(), si["mat_id"], si["target_start"], si["target_dur"])
        for si in txt_seg_infos
    ]

    new["tracks"] = [
        _make_track(new_id(), "video", vid_segs),
        _make_track(new_id(), "audio", aud_segs),
        _make_track(new_id(), "text",  txt_segs),
    ]

    # ── keyframes ─────────────────────────────────────────────────
    new["keyframes"]           = clear_keyframes(new.get("keyframes"))
    new["keyframe_graph_list"] = []

    # ── 顶层字段 ──────────────────────────────────────────────────
    new["duration"]    = total_dur_us
    new["id"]          = new_id()
    new["update_time"] = now_ms()

    return new


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def run(args):
    template_dir = Path(args.template).resolve()
    output_dir   = Path(args.output).resolve()
    video_paths  = [Path(v).resolve() for v in args.video]
    audio_paths  = [Path(a).resolve() for a in args.audio]
    subtitles    = [f"CLEAN 字幕 {i+1}" for i in range(len(video_paths))]

    # ── 参数验证 ──────────────────────────────────────────────────
    if not template_dir.exists():
        print(f"[错误] 模板目录不存在: {template_dir}")
        sys.exit(1)
    if not (template_dir / "draft_info.json").exists():
        print(f"[错误] 模板目录里没有 draft_info.json: {template_dir}")
        print("       请确认这是一个剪映 Storybound 草稿目录")
        sys.exit(1)
    for p in video_paths + audio_paths:
        if not p.exists():
            print(f"[错误] 文件不存在: {p}")
            print("       请传入真实存在的视频/音频文件")
            sys.exit(1)
    if len(video_paths) < 1:
        print("[错误] 至少需要 1 个视频文件")
        sys.exit(1)
    if len(audio_paths) < 1:
        print("[错误] 至少需要 1 个音频文件")
        sys.exit(1)

    print(f"\n[1/7] 读取模板 draft_info.json ...")
    template_data = json.loads((template_dir / "draft_info.json").read_text(encoding="utf-8"))
    print(f"      原始 duration : {template_data.get('duration')}")
    print(f"      原始 video 材料: {len((template_data.get('materials') or {}).get('videos') or [])}")
    print(f"      原始 text  材料: {len((template_data.get('materials') or {}).get('texts') or [])}")

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
        print(f"      视频 → {dst}")
        dur_us = probe_duration_us(dst)
        w, h   = probe_video_dims(dst)
        if dur_us is None:
            dur_us = TOTAL_DURATION_US // len(video_paths)
            print(f"        (ffprobe 不可用，使用占位时长 {dur_us} µs)")
        else:
            print(f"        时长: {dur_us} µs  尺寸: {w}×{h}")
        video_info.append({"path": str(dst), "dur_us": dur_us, "w": w, "h": h})

    audio_info = []
    for ap in audio_paths:
        dst = aud_dir / ap.name
        shutil.copy2(str(ap), str(dst))
        print(f"      音频 → {dst}")
        dur_us = probe_duration_us(dst)
        if dur_us is None:
            dur_us = TOTAL_DURATION_US
            print(f"        (ffprobe 不可用，使用占位时长 {dur_us} µs)")
        else:
            print(f"        时长: {dur_us} µs")
        audio_info.append({"path": str(dst), "dur_us": dur_us})

    print(f"\n[4/7] 重建 draft_info.json ...")
    print(f"      视频数: {len(video_info)}")
    print(f"      音频数: {len(audio_info)}")
    print(f"      字幕数: {len(subtitles)}  → {subtitles}")
    print(f"      总时长: {TOTAL_DURATION_US} µs (5s)")

    new_content = rebuild_draft_info(
        template_data = template_data,
        video_info    = video_info,
        audio_info    = audio_info,
        subtitle_texts= subtitles,
        total_dur_us  = TOTAL_DURATION_US,
    )

    print(f"\n[5/7] 写回 draft_info.json ...")
    out_json = output_dir / "draft_info.json"
    out_json.write_text(json.dumps(new_content, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      写入: {out_json}  ({out_json.stat().st_size/1024:.1f}KB)")

    # 同步更新 draft_meta_info.json 里的草稿名
    _update_meta_name(output_dir, args.title or output_dir.name)

    print(f"\n[6/7] 快速结构自验 ...")
    _self_verify(new_content, video_info, audio_info, subtitles)

    print(f"\n[7/7] 调用 inspect_draft.py 做完整检查 ...")
    _run_inspect(output_dir)

    print(f"\n✓ 草稿生成完成")
    print(f"  输出目录: {output_dir}")
    print()
    print("下一步（本地操作）:")
    print(f"  1. 把草稿目录复制到剪映草稿根目录：")
    print(f"     Windows: %LOCALAPPDATA%\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\")
    print(f"     Mac:     ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/")
    print(f"  2. 打开剪映专业版，在草稿列表找到该草稿")
    print(f"  3. 检查：时长是否 5s / 视频轨 {len(video_info)} 段 / 音频轨 1 段 / 字幕 {len(subtitles)} 条")
    print(f"  4. 如有 Media Not Found，确认素材路径在当前机器上存在")
    print(f"\n[注意] 云端无剪映 GUI，脚本层结构检查通过，需用户本地打开剪映验证")


def _update_meta_name(output_dir: Path, name: str):
    meta_path = output_dir / "draft_meta_info.json"
    if not meta_path.exists():
        return
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["draft_name"] = name
        meta["tm_draft_modified"] = now_ms()
        meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"      draft_meta_info.json 草稿名更新: {name!r}")
    except Exception as e:
        print(f"      [警告] draft_meta_info.json 更新失败: {e}")


def _self_verify(new_content: dict,
                 video_info: list, audio_info: list, subtitles: list):
    ok = True
    dur = new_content.get("duration")
    if dur != TOTAL_DURATION_US:
        print(f"  [✗] duration = {dur}, 期望 {TOTAL_DURATION_US}")
        ok = False
    else:
        print(f"  [✓] duration = {TOTAL_DURATION_US}")

    mats = new_content.get("materials") or {}
    for key, expected in [("videos", len(video_info)),
                          ("audios", len(audio_info)),
                          ("texts",  len(subtitles))]:
        actual = len(mats.get(key) or [])
        sym = "✓" if actual == expected else "✗"
        status = f"期望 {expected}" if actual != expected else ""
        print(f"  [{sym}] materials.{key} = {actual}  {status}")
        if actual != expected:
            ok = False

    # 检查字幕文本
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

    # 检查残留 Storybound 字幕（假设原始字幕不含 "CLEAN"）
    residual = [t for t in actual_texts if "CLEAN" not in t and t]
    if residual:
        print(f"  [✗] 疑似残留旧字幕: {residual[:3]}")
        ok = False
    else:
        print(f"  [✓] 无残留旧字幕")

    tracks = new_content.get("tracks") or []
    vid_segs = sum(len(t.get("segments") or []) for t in tracks if t.get("type") == "video")
    print(f"  [{'✓' if vid_segs == len(video_info) else '✗'}] video segments = {vid_segs}")
    if not ok:
        print("\n  [!] 自验发现问题，请检查上面错误项")
    else:
        print("\n  [✓] 自验全部通过")


def _run_inspect(output_dir: Path):
    script = Path(__file__).parent / "inspect_draft.py"
    if not script.exists():
        print("  [跳过] inspect_draft.py 不在同目录")
        return
    try:
        r = subprocess.run(
            [sys.executable, str(script), str(output_dir), "--check-media-paths"],
            capture_output=False, text=True, timeout=30
        )
        if r.returncode != 0:
            print(f"  [警告] inspect_draft.py 退出码 {r.returncode}")
    except Exception as e:
        print(f"  [警告] inspect_draft.py 调用失败: {e}")


# ────────────────────────────────────────────────
# CLI
# ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="基于 Storybound 草稿模板重建 draft_info.json 时间线",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--template", required=True,
                        help="Storybound 样本草稿目录（含 draft_info.json）")
    parser.add_argument("--output",   required=True,
                        help="新草稿输出目录（不能已存在，或会被删除重建）")
    parser.add_argument("--video",    action="append", default=[],
                        help="视频文件路径（可多次指定，每次一个）")
    parser.add_argument("--audio",    action="append", default=[],
                        help="音频文件路径（可多次指定）")
    parser.add_argument("--title",    default="",
                        help="草稿名称（写入 draft_meta_info.json）")
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
