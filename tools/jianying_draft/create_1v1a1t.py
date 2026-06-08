#!/usr/bin/env python3
"""
create_1v1a1t.py - generate a minimal Jianying draft with 1 video, 1 audio,
and 1 subtitle by copying a Storybound-style template and rewriting only the
copied draft_info.json.

This script intentionally does not decode or rewrite draft_content.json,
template-2.tmp, draft_meta_info.json, or Timelines/* files.
"""

import argparse
import copy
import json
import shutil
import sys
import uuid
from pathlib import Path


REQUIRED_TEMPLATE_ENTRIES = [
    "draft_info.json",
    "draft_content.json",
    "draft_meta_info.json",
    "template-2.tmp",
    "timeline_layout.json",
    "Timelines",
]


def new_hex_id() -> str:
    return uuid.uuid4().hex


def is_relative_to(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def require_file(path: Path, label: str) -> None:
    if not path.exists() or not path.is_file():
        raise SystemExit(f"[错误] {label} 不存在: {path}")


def validate_template(template_dir: Path) -> None:
    if not template_dir.exists() or not template_dir.is_dir():
        raise SystemExit(f"[错误] 模板目录不存在: {template_dir}")

    missing = [name for name in REQUIRED_TEMPLATE_ENTRIES if not (template_dir / name).exists()]
    if missing:
        raise SystemExit("[错误] 模板目录缺少:\n" + "\n".join(f"  - {name}" for name in missing))

    try:
        json.loads((template_dir / "draft_info.json").read_text(encoding="utf-8"))
    except Exception as exc:
        raise SystemExit(f"[错误] 模板 draft_info.json 不可解析: {exc}") from exc


def prepare_output(template_dir: Path, output_dir: Path) -> None:
    if template_dir == output_dir:
        raise SystemExit("[错误] output 不能等于 template")
    if is_relative_to(template_dir, output_dir):
        raise SystemExit("[错误] output 不能是 template 的父目录，避免误删模板")
    if output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.copytree(template_dir, output_dir)


def copy_asset(source: Path, dest_dir: Path, dest_name: str) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / dest_name
    shutil.copy2(source, dest)
    return dest.resolve()


def subtitle_content(text: str) -> str:
    content = {
        "styles": [
            {
                "fill": {
                    "alpha": 1.0,
                    "content": {
                        "render_type": "solid",
                        "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]},
                    },
                },
                "range": [0, len(text)],
                "size": 12.0,
                "bold": False,
                "italic": False,
                "underline": False,
                "strokes": [
                    {
                        "content": {
                            "solid": {"alpha": 0.0, "color": [0.0, 0.0, 0.0]}
                        },
                        "width": 0.0,
                    }
                ],
            }
        ],
        "text": text,
    }
    return json.dumps(content, ensure_ascii=False, separators=(",", ":"))


def base_materials(template_materials: dict) -> dict:
    result = copy.deepcopy(template_materials)
    for key, value in list(result.items()):
        if isinstance(value, list):
            result[key] = []
    return result


def build_video_material(mat_id: str, path: Path, duration: int) -> dict:
    return {
        "audio_fade": None,
        "category_id": "",
        "category_name": "local",
        "check_flag": 63487,
        "crop": {
            "upper_left_x": 0.0,
            "upper_left_y": 0.0,
            "upper_right_x": 1.0,
            "upper_right_y": 0.0,
            "lower_left_x": 0.0,
            "lower_left_y": 1.0,
            "lower_right_x": 1.0,
            "lower_right_y": 1.0,
        },
        "crop_ratio": "free",
        "crop_scale": 1.0,
        "duration": duration,
        "height": 1920,
        "id": mat_id,
        "local_material_id": mat_id,
        "material_id": mat_id,
        "material_name": path.name,
        "media_path": "",
        "path": str(path),
        "remote_url": None,
        "type": "video",
        "width": 1080,
    }


def build_audio_material(mat_id: str, path: Path, duration: int) -> dict:
    return {
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "copyright_limit_type": "none",
        "duration": duration,
        "effect_id": "",
        "formula_id": "",
        "id": mat_id,
        "intensifies_path": "",
        "is_ai_clone_tone": False,
        "is_text_edit_overdub": False,
        "is_ugc": False,
        "local_material_id": mat_id,
        "music_id": mat_id,
        "name": path.stem,
        "path": str(path),
        "remote_url": None,
        "query": "",
        "request_id": "",
        "resource_id": "",
        "search_id": "",
        "source_from": "",
        "source_platform": 0,
        "team_id": "",
        "text_id": "",
        "type": "extract_music",
        "wave_points": [],
    }


def build_text_material(mat_id: str, text: str) -> dict:
    return {
        "id": mat_id,
        "content": subtitle_content(text),
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
            "category_id": "",
            "category_name": "",
            "effect_id": "",
            "is_new": False,
            "path": "",
            "request_id": "",
            "resource_id": "",
            "resource_name": "",
            "source_platform": 0,
        },
        "combo_info": {"text_templates": []},
        "words": {"end_time": [], "start_time": [], "text": []},
        "subtitle_keywords": None,
    }


def common_segment(seg_id: str, mat_id: str) -> dict:
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
        "extra_material_refs": [],
    }


def clip_transform() -> dict:
    return {
        "alpha": 1.0,
        "flip": {"horizontal": False, "vertical": False},
        "rotation": 0.0,
        "scale": {"x": 1.0, "y": 1.0},
        "transform": {"x": 0.0, "y": 0.0},
    }


def uniform_scale() -> dict:
    return {"on": True, "value": 1.0}


def build_video_segment(mat_id: str, timeline_duration: int, source_duration: int) -> dict:
    seg = common_segment(new_hex_id(), mat_id)
    seg.update(
        {
            "target_timerange": {"start": 0, "duration": timeline_duration},
            "source_timerange": {"start": 0, "duration": min(source_duration, timeline_duration)},
            "speed": None,
            "volume": 1.0,
            "clip": clip_transform(),
            "uniform_scale": uniform_scale(),
            "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
            "render_index": 0,
        }
    )
    return seg


def build_audio_segment(mat_id: str, timeline_duration: int, source_duration: int) -> dict:
    seg = common_segment(new_hex_id(), mat_id)
    seg.update(
        {
            "target_timerange": {"start": 0, "duration": timeline_duration},
            "source_timerange": {"start": 0, "duration": min(source_duration, timeline_duration)},
            "speed": 1.0,
            "volume": 1.0,
            "clip": None,
            "uniform_scale": uniform_scale(),
            "hdr_settings": None,
            "render_index": 0,
        }
    )
    return seg


def build_text_segment(mat_id: str, timeline_duration: int) -> dict:
    seg = common_segment(new_hex_id(), mat_id)
    seg.update(
        {
            "target_timerange": {"start": 0, "duration": timeline_duration},
            "source_timerange": None,
            "speed": 1.0,
            "volume": 1.0,
            "clip": clip_transform(),
            "uniform_scale": uniform_scale(),
            "render_index": 15000,
        }
    )
    return seg


def build_track(track_type: str, segments: list[dict]) -> dict:
    return {
        "attribute": 0,
        "flag": 0,
        "id": new_hex_id(),
        "is_default_name": True,
        "name": "",
        "type": track_type,
        "segments": segments,
    }


def rebuild_draft_info(
    template_data: dict,
    video_path: Path,
    audio_path: Path,
    subtitle: str,
    duration: int,
    video_duration: int,
    audio_duration: int,
) -> dict:
    data = copy.deepcopy(template_data)
    materials = base_materials(data.get("materials") or {})

    video_id = new_hex_id()
    audio_id = new_hex_id()
    text_id = new_hex_id()

    materials["videos"] = [build_video_material(video_id, video_path, video_duration)]
    materials["audios"] = [build_audio_material(audio_id, audio_path, audio_duration)]
    materials["texts"] = [build_text_material(text_id, subtitle)]
    data["materials"] = materials

    data["tracks"] = [
        build_track("video", [build_video_segment(video_id, duration, video_duration)]),
        build_track("audio", [build_audio_segment(audio_id, duration, audio_duration)]),
        build_track("text", [build_text_segment(text_id, duration)]),
    ]
    data["duration"] = duration
    data["fps"] = 30
    data["keyframes"] = {
        "adjusts": [],
        "audios": [],
        "effects": [],
        "filters": [],
        "handwrites": [],
        "stickers": [],
        "texts": [],
        "videos": [],
    }
    data["keyframe_graph_list"] = []
    return data


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"必须是整数: {value}") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError(f"必须大于 0: {value}")
    return parsed


def run(args) -> dict:
    template_dir = Path(args.template).resolve()
    output_dir = Path(args.output).resolve()
    source_video = Path(args.video).resolve()
    source_audio = Path(args.audio).resolve()

    validate_template(template_dir)
    require_file(source_video, "视频文件")
    require_file(source_audio, "音频文件")

    prepare_output(template_dir, output_dir)

    video_out = copy_asset(source_video, output_dir / "assets" / "video", "clip1.mp4")
    audio_out = copy_asset(source_audio, output_dir / "assets" / "audio", "audio.mp3")

    draft_info_path = output_dir / "draft_info.json"
    template_data = json.loads(draft_info_path.read_text(encoding="utf-8"))
    video_duration = args.video_duration or args.duration
    audio_duration = args.audio_duration or args.duration

    new_data = rebuild_draft_info(
        template_data=template_data,
        video_path=video_out,
        audio_path=audio_out,
        subtitle=args.subtitle,
        duration=args.duration,
        video_duration=video_duration,
        audio_duration=audio_duration,
    )
    draft_info_path.write_text(
        json.dumps(new_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "template": str(template_dir),
        "output": str(output_dir),
        "video": str(video_out),
        "audio": str(audio_out),
        "duration": args.duration,
        "subtitle": args.subtitle,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a minimal 1V/1A/1T Jianying draft from a Storybound draft_info template."
    )
    parser.add_argument("--template", required=True, help="模板草稿目录")
    parser.add_argument("--output", required=True, help="输出草稿目录")
    parser.add_argument("--video", required=True, help="输入 mp4 路径")
    parser.add_argument("--audio", required=True, help="输入 mp3 路径")
    parser.add_argument("--subtitle", required=True, help="字幕文本")
    parser.add_argument("--duration", required=True, type=positive_int, help="时间线总时长，微秒")
    parser.add_argument("--video-duration", type=positive_int, default=None, help="视频素材时长，微秒")
    parser.add_argument("--audio-duration", type=positive_int, default=None, help="音频素材时长，微秒")
    args = parser.parse_args()

    result = run(args)
    print("✓ TEST 1V1A1T draft generated")
    print(f"  template : {result['template']}")
    print(f"  output   : {result['output']}")
    print(f"  video    : {result['video']}")
    print(f"  audio    : {result['audio']}")
    print(f"  duration : {result['duration']}")
    print(f"  subtitle : {result['subtitle']}")
    print("[注意] GUI 是否成功必须由用户本地打开剪映验证")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[错误] {exc}")
        sys.exit(1)
