#!/usr/bin/env python3
"""
create_minimal_draft.py — 生成剪映可打开的最小草稿

用法:
    python create_minimal_draft.py \
        --video /path/to/video.mp4 \
        --audio /path/to/audio.mp3 \
        --subtitle "你好世界" \
        --subtitle-start 0 \
        --subtitle-end 3 \
        --output /path/to/output_draft_dir \
        [--width 1080] [--height 1920]

注意:
    - 此脚本生成的草稿结构基于 inspect_draft.py 分析真实草稿后的结果
    - 时间单位: 微秒 (µs)，1秒 = 1,000,000
    - 视频路径使用绝对路径（剪映要求）
    - 运行前请先用 inspect_draft.py 验证真实草稿格式

第一版功能:
    - 1 个视频轨 (video track)
    - 1 个音频轨 (audio track，使用独立音频文件)
    - 1 条字幕 (text track)
    - 自动复制资源文件到草稿目录
    - 生成 draft_content.json + draft_meta_info.json
"""

import argparse
import json
import os
import shutil
import sys
import time
import uuid
from pathlib import Path


# ────────────────────────────────────────────────
# 工具函数
# ────────────────────────────────────────────────

def new_id():
    return str(uuid.uuid4()).upper()


def sec_to_us(seconds: float) -> int:
    """秒 → 微秒"""
    return int(float(seconds) * 1_000_000)


def probe_video_duration(path: Path) -> float:
    """用 ffprobe 获取视频时长（秒）。ffprobe 不可用时返回 None。"""
    import subprocess
    ffprobe_candidates = [
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe",
        Path(__file__).parent.parent.parent / "local-tools" / "ffmpeg" / "ffprobe.exe",
        "ffprobe",
    ]
    ffprobe = None
    for c in ffprobe_candidates:
        if Path(str(c)).exists() or c == "ffprobe":
            ffprobe = str(c)
            break

    try:
        r = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=10
        )
        return float(r.stdout.strip())
    except Exception:
        return None


# ────────────────────────────────────────────────
# 草稿生成
# ────────────────────────────────────────────────

def build_draft_meta(draft_name: str, draft_id: str) -> dict:
    """draft_meta_info.json 内容"""
    now_ms = int(time.time() * 1000)
    return {
        "cloud_package_completed_time": "",
        "draft_cloud_capcut_purchase_info": "",
        "draft_cloud_last_action_download": False,
        "draft_cloud_materials": [],
        "draft_cloud_purchase_info": "",
        "draft_cloud_template_id": "",
        "draft_cloud_tutorial_info": "",
        "draft_cloud_videocut_purchase_info": "",
        "draft_cover": "",
        "draft_deeplink_url": "",
        "draft_enterprise_info": {
            "draft_enterprise_extra": "",
            "draft_enterprise_id": "",
            "draft_enterprise_name": "",
            "enterprise_material": []
        },
        "draft_fold_path": "",
        "draft_id": draft_id,
        "draft_is_ai_shorts": False,
        "draft_is_invisible": False,
        "draft_materials": [],
        "draft_name": draft_name,
        "draft_new_version": "",
        "draft_removable_storage_device": "",
        "draft_root_path": "",
        "draft_segment_extra_info": [],
        "draft_timeline_materials_size_": 0,
        "draft_type": "",
        "tm_draft_cloud_completed": "",
        "tm_draft_cloud_modified": 0,
        "tm_draft_create": now_ms,
        "tm_draft_modified": now_ms,
        "tm_draft_removed": 0,
        "tm_duration": 0
    }


def build_video_material(vid_id: str, video_path: Path, duration_us: int, width: int, height: int) -> dict:
    """materials.videos 的一条记录"""
    abs_path = str(video_path.resolve())
    now = int(time.time())
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
        "height": height,
        "id": vid_id,
        "import_time": now,
        "import_time_ms": now * 1000,
        "is_ai_matting_valid_cache": False,
        "is_unified_beauty_valid_cache": False,
        "local_material_id": vid_id,
        "material_id": vid_id,
        "material_name": video_path.name,
        "material_url": "",
        "matting": {
            "flag": 0,
            "has_use_quick_brush": False,
            "has_use_quick_eraser": False,
            "interactiveTime": [],
            "path": "",
            "strokes": []
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
            "algorithms": [],
            "deflicker": None,
            "motion_blur_config": None,
            "noise_reduction": None,
            "path": "",
            "quality_enhance": None,
            "time_range": None
        },
        "width": width
    }


def build_audio_material(aud_id: str, audio_path: Path, duration_us: int) -> dict:
    """materials.audios 的一条记录"""
    abs_path = str(audio_path.resolve())
    now = int(time.time())
    return {
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "duration": duration_us,
        "effect_id": "",
        "formula_id": "",
        "id": aud_id,
        "intensifies_path": "",
        "local_material_id": aud_id,
        "material_id": aud_id,
        "material_name": audio_path.name,
        "material_url": "",
        "name": audio_path.stem,
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


def build_text_material(txt_id: str, text: str) -> dict:
    """materials.texts 的一条记录"""
    text_len = len(text)
    content_obj = {
        "styles": [
            {
                "fill": {
                    "content": {
                        "render_type": "solid",
                        "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                    }
                },
                "range": [0, text_len],
                "useStyle": ""
            }
        ],
        "text": text
    }
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
        "content": json.dumps(content_obj, ensure_ascii=False),
        "font_category_id": "",
        "font_category_name": "",
        "font_id": "",
        "font_name": "",
        "font_path": "",
        "font_size": 8.0,
        "fonts": [],
        "id": txt_id,
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


def build_video_segment(seg_id: str, mat_id: str, source_start: int, source_dur: int,
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
        "source_timerange": {"duration": source_dur, "start": source_start},
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


def build_audio_segment(seg_id: str, mat_id: str, source_start: int, source_dur: int,
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
        "source_timerange": {"duration": source_dur, "start": source_start},
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


def build_text_segment(seg_id: str, mat_id: str, target_start: int, target_dur: int) -> dict:
    return {
        "cartoon": False,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "translation": {"x": 0.0, "y": 0.3}   # 字幕放在下方
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
        "source_timerange": {"duration": target_dur, "start": 0},
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


def build_track(track_id: str, track_type: str, segments: list) -> dict:
    return {
        "attribute": 0,
        "flag": 0,
        "id": track_id,
        "is_default_name": True,
        "name": "",
        "segments": segments,
        "type": track_type
    }


def build_draft_content(draft_id: str, video_dur_us: int, audio_dur_us: int,
                        video_path: Path, audio_path: Path,
                        subtitle_text: str, sub_start_s: float, sub_end_s: float,
                        width: int, height: int) -> dict:

    # IDs
    vid_mat_id  = new_id()
    aud_mat_id  = new_id()
    txt_mat_id  = new_id()
    vid_seg_id  = new_id()
    aud_seg_id  = new_id()
    txt_seg_id  = new_id()
    vid_trk_id  = new_id()
    aud_trk_id  = new_id()
    txt_trk_id  = new_id()

    total_dur_us = max(video_dur_us, audio_dur_us)

    sub_start_us = sec_to_us(sub_start_s)
    sub_end_us   = sec_to_us(sub_end_s)
    sub_dur_us   = sub_end_us - sub_start_us

    # materials
    vid_mat  = build_video_material(vid_mat_id, video_path, video_dur_us, width, height)
    aud_mat  = build_audio_material(aud_mat_id, audio_path, audio_dur_us)
    txt_mat  = build_text_material(txt_mat_id, subtitle_text)

    # segments
    vid_seg  = build_video_segment(vid_seg_id, vid_mat_id, 0, video_dur_us, 0, video_dur_us)
    aud_seg  = build_audio_segment(aud_seg_id, aud_mat_id, 0, audio_dur_us, 0, audio_dur_us)
    txt_seg  = build_text_segment(txt_seg_id, txt_mat_id, sub_start_us, sub_dur_us)

    # tracks
    vid_trk  = build_track(vid_trk_id, "video", [vid_seg])
    aud_trk  = build_track(aud_trk_id, "audio", [aud_seg])
    txt_trk  = build_track(txt_trk_id, "text",  [txt_seg])

    now_ms = int(time.time() * 1000)

    return {
        "canvas_config": {"height": height, "ratio": "original", "width": width},
        "color_space": 0,
        "cover": "",
        "duration": total_dur_us,
        "extra_info": None,
        "id": draft_id,
        "keyframe_graph_list": [],
        "keyframes": {"adjusts": []},
        "last_modified_platform": {
            "app_id": 359289478,
            "app_version": "5.0.0",
            "device_id": "",
            "hard_disk_id": "",
            "mac_address": "",
            "os": "windows",
            "os_version": "10.0.0"
        },
        "materials": {
            "audio_balances": [],
            "audio_effects": [],
            "audio_fades": [],
            "audio_track_indexes": [],
            "audios": [aud_mat],
            "beats": [],
            "canvases": [],
            "chromas": [],
            "color_curves": [],
            "color_wheels": [],
            "digital_humans": [],
            "drafts": [],
            "dynamo_resource": [],
            "effect_supports": [],
            "effects": [],
            "flowers": [],
            "green_screens": [],
            "handwrites": [],
            "hsl": [],
            "images": [],
            "log_color_wheels": [],
            "loudnesses": [],
            "manual_deformations": [],
            "masks": [],
            "material_animations": [],
            "multi_language_refs": [],
            "placeholders": [],
            "plugin_effects": [],
            "primary_color_wheels": [],
            "realtime_denoises": [],
            "shapes": [],
            "smart_crops": [],
            "smart_relights": [],
            "sound_channel_mappings": [],
            "speeds": [],
            "stickers": [],
            "tail_leaders": [],
            "text_templates": [],
            "texts": [txt_mat],
            "time_marks": [],
            "transitions": [],
            "video_effects": [],
            "video_trackings": [],
            "videos": [vid_mat],
            "vocal_beautifys": [],
            "vocal_separations": []
        },
        "mutable_config": None,
        "new_version": "100.0.0",
        "platform": {
            "app_id": 359289478,
            "app_version": "5.0.0",
            "device_id": "",
            "hard_disk_id": "",
            "mac_address": "",
            "os": "windows",
            "os_version": "10.0.0"
        },
        "relationships": [],
        "render_index_track_mode_on": False,
        "retouch_cover": "",
        "source": "default",
        "static_cover_image_path": "",
        "time_marks": None,
        "tracks": [vid_trk, aud_trk, txt_trk],
        "update_time": now_ms,
        "version": 360000
    }


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def create_draft(args):
    video_path = Path(args.video).resolve()
    audio_path = Path(args.audio).resolve()
    out_dir    = Path(args.output).resolve()

    if not video_path.exists():
        print(f"[错误] 视频文件不存在: {video_path}")
        sys.exit(1)
    if not audio_path.exists():
        print(f"[错误] 音频文件不存在: {audio_path}")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/5] 探测视频时长...")
    vid_dur = probe_video_duration(video_path)
    if vid_dur is None:
        vid_dur = float(args.video_duration or 10.0)
        print(f"      ffprobe 不可用，使用默认时长: {vid_dur}s")
    else:
        print(f"      视频时长: {vid_dur:.3f}s")

    print(f"[2/5] 探测音频时长...")
    aud_dur = probe_video_duration(audio_path)
    if aud_dur is None:
        aud_dur = float(args.audio_duration or vid_dur)
        print(f"      ffprobe 不可用，使用默认时长: {aud_dur}s")
    else:
        print(f"      音频时长: {aud_dur:.3f}s")

    print(f"[3/5] 复制资源文件到草稿目录...")
    dst_video = out_dir / video_path.name
    dst_audio = out_dir / audio_path.name
    if not dst_video.exists() or dst_video.stat().st_size != video_path.stat().st_size:
        shutil.copy2(str(video_path), str(dst_video))
        print(f"      复制视频: {dst_video}")
    else:
        print(f"      视频已存在，跳过: {dst_video}")
    if not dst_audio.exists() or dst_audio.stat().st_size != audio_path.stat().st_size:
        shutil.copy2(str(audio_path), str(dst_audio))
        print(f"      复制音频: {dst_audio}")
    else:
        print(f"      音频已存在，跳过: {dst_audio}")

    draft_id = new_id()
    vid_dur_us = sec_to_us(vid_dur)
    aud_dur_us = sec_to_us(aud_dur)

    print(f"[4/5] 生成 draft_content.json...")
    content = build_draft_content(
        draft_id    = draft_id,
        video_dur_us= vid_dur_us,
        audio_dur_us= aud_dur_us,
        video_path  = dst_video,
        audio_path  = dst_audio,
        subtitle_text = args.subtitle,
        sub_start_s = float(args.subtitle_start),
        sub_end_s   = float(args.subtitle_end),
        width       = int(args.width),
        height      = int(args.height),
    )
    content_path = out_dir / "draft_content.json"
    content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      写入: {content_path}")

    print(f"[5/5] 生成 draft_meta_info.json...")
    meta = build_draft_meta(args.name or out_dir.name, draft_id)
    meta_path = out_dir / "draft_meta_info.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"      写入: {meta_path}")

    print("\n✓ 草稿生成完成")
    print(f"  草稿目录: {out_dir}")
    print(f"  draft_id: {draft_id}")
    print(f"  视频时长: {vid_dur:.3f}s ({vid_dur_us} µs)")
    print(f"  音频时长: {aud_dur:.3f}s ({aud_dur_us} µs)")
    print(f"  字幕: {args.subtitle!r}  [{args.subtitle_start}s → {args.subtitle_end}s]")
    print(f"  分辨率: {args.width}x{args.height}")
    print()
    print("下一步:")
    print("  1. 把草稿目录复制到剪映草稿根目录")
    print("     Windows: C:\\Users\\<用户名>\\AppData\\Local\\JianyingPro\\User Data\\Projects\\com.lveditor.draft\\")
    print("     Mac:     ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/")
    print("  2. 打开剪映专业版，查看草稿列表")
    print("  3. 如果草稿不显示，尝试: 设置→草稿→刷新")
    print()
    print("[注意] 此草稿基于推测的格式结构生成。")
    print("       请先用 inspect_draft.py 分析真实草稿，再根据分析结果修正此脚本。")


def main():
    parser = argparse.ArgumentParser(
        description="生成剪映可打开的最小草稿",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--video",          required=True,  help="视频文件路径 (.mp4)")
    parser.add_argument("--audio",          required=True,  help="音频文件路径 (.mp3/.aac)")
    parser.add_argument("--subtitle",       default="字幕测试",  help="字幕文字")
    parser.add_argument("--subtitle-start", default="0",    help="字幕开始时间（秒）")
    parser.add_argument("--subtitle-end",   default="3",    help="字幕结束时间（秒）")
    parser.add_argument("--output",         required=True,  help="输出草稿目录路径")
    parser.add_argument("--name",           default="",     help="草稿名称（默认用目录名）")
    parser.add_argument("--width",          default=1080,   help="视频宽度（默认1080）")
    parser.add_argument("--height",         default=1920,   help="视频高度（默认1920）")
    parser.add_argument("--video-duration", default=None,   help="视频时长（秒，ffprobe不可用时使用）")
    parser.add_argument("--audio-duration", default=None,   help="音频时长（秒，ffprobe不可用时使用）")

    args = parser.parse_args()
    create_draft(args)


if __name__ == "__main__":
    main()
