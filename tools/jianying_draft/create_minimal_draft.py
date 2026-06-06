#!/usr/bin/env python
"""Create a minimal Jianying draft by copying a real draft template."""

from __future__ import annotations

import argparse
import copy
import json
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from types import SimpleNamespace


DEFAULT_SUBTITLE = "这是从 shipin-cut 导出的测试字幕"
DEFAULT_DURATION_US = 5_000_000


def new_id() -> str:
    return str(uuid.uuid4()).upper()


def now_us() -> int:
    return int(time.time() * 1_000_000)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def find_timeline_dir(draft_dir: Path) -> Path:
    project_path = draft_dir / "Timelines" / "project.json"
    if project_path.exists():
        try:
            project = read_json(project_path)
            timeline_id = project.get("main_timeline_id")
            if isinstance(timeline_id, str) and (draft_dir / "Timelines" / timeline_id).is_dir():
                return draft_dir / "Timelines" / timeline_id
        except (json.JSONDecodeError, OSError):
            pass

    timelines_dir = draft_dir / "Timelines"
    if timelines_dir.is_dir():
        for child in timelines_dir.iterdir():
            if child.is_dir() and (
                (child / "template.tmp").exists() or (child / "template.json").exists()
            ):
                return child
    raise ValueError("模板里没有找到可用的 Timelines 主时间线目录")


def load_timeline_base(timeline_dir: Path) -> dict:
    for name in ("template.tmp", "template.json"):
        path = timeline_dir / name
        if path.exists():
            try:
                return read_json(path)
            except json.JSONDecodeError:
                continue
    raise ValueError("主时间线目录里没有可解析的 template.tmp/template.json")


def load_rich_template(timeline_dir: Path) -> dict:
    path = timeline_dir / "template.json"
    if path.exists():
        try:
            return read_json(path)
        except json.JSONDecodeError:
            pass
    return load_timeline_base(timeline_dir)


def first_material(timeline: dict, material_type: str) -> dict:
    items = timeline.get("materials", {}).get(material_type, [])
    if isinstance(items, list) and items:
        return copy.deepcopy(items[0])
    return {}


def first_segment(timeline: dict, track_type: str) -> dict:
    for track in timeline.get("tracks", []):
        if isinstance(track, dict) and track.get("type") == track_type:
            segments = track.get("segments", [])
            if isinstance(segments, list) and segments:
                return copy.deepcopy(segments[0])
    return {}


def first_track(timeline: dict, track_type: str) -> dict:
    for track in timeline.get("tracks", []):
        if isinstance(track, dict) and track.get("type") == track_type:
            return copy.deepcopy(track)
    return {"id": new_id(), "type": track_type, "segments": [], "attribute": 0, "flag": 0}


def default_materials(base: dict, rich: dict) -> dict:
    keys = set()
    for source in (base, rich):
        materials = source.get("materials")
        if isinstance(materials, dict):
            keys.update(materials.keys())
    keys.update(["videos", "audios", "texts", "speeds", "sound_channel_mappings"])
    return {key: [] for key in sorted(keys)}


def relative_media_path(kind: str, source: Path) -> str:
    return f"materials/{kind}/{source.name}"


def make_video_material(template: dict, video_path: Path, material_id: str, duration_us: int) -> dict:
    item = copy.deepcopy(template) if template else {}
    item.update(
        {
            "id": material_id,
            "type": "video",
            "path": relative_media_path("video", video_path),
            "material_name": video_path.name,
            "duration": duration_us,
            "has_audio": item.get("has_audio", False),
            "source": item.get("source", 0),
            "category_name": item.get("category_name", "local"),
            "local_material_id": str(uuid.uuid4()),
            "width": item.get("width", 720),
            "height": item.get("height", 1280),
        }
    )
    return item


def make_audio_material(template: dict, audio_path: Path, material_id: str, duration_us: int) -> dict:
    item = copy.deepcopy(template) if template else {}
    item.update(
        {
            "id": material_id,
            "type": item.get("type", "extract_music"),
            "path": relative_media_path("audio", audio_path),
            "name": audio_path.name,
            "duration": duration_us,
            "local_material_id": str(uuid.uuid4()),
            "resource_id": str(uuid.uuid4()),
            "music_id": str(uuid.uuid4()),
            "category_name": item.get("category_name", "local"),
        }
    )
    return item


def split_words(text: str, duration_us: int) -> dict:
    chars = list(text)
    if not chars:
        chars = [""]
    duration_ms = max(1, round(duration_us / 1000))
    step = max(1, duration_ms // len(chars))
    starts = [min(index * step, duration_ms) for index in range(len(chars))]
    ends = [min((index + 1) * step, duration_ms) for index in range(len(chars))]
    ends[-1] = duration_ms
    return {"start_time": starts, "end_time": ends, "text": chars}


def make_text_content(template: dict, subtitle: str) -> str:
    raw = template.get("content", "") if isinstance(template, dict) else ""
    try:
        content = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        content = {}
    styles = content.get("styles")
    if not isinstance(styles, list) or not styles:
        styles = [
            {
                "fill": {"content": {"render_type": "solid", "solid": {"color": [1, 1, 1]}}},
                "range": [0, len(subtitle)],
                "size": template.get("font_size", 15) if isinstance(template, dict) else 15,
            }
        ]
    else:
        for style in styles:
            if isinstance(style, dict):
                style["range"] = [0, len(subtitle)]
    return json.dumps({"text": subtitle, "styles": styles}, ensure_ascii=False, separators=(",", ":"))


def make_text_material(template: dict, subtitle: str, material_id: str, duration_us: int) -> dict:
    item = copy.deepcopy(template) if template else {}
    item.update(
        {
            "id": material_id,
            "type": "subtitle",
            "content": make_text_content(item, subtitle),
            "recognize_text": subtitle,
            "words": split_words(subtitle, duration_us),
            "current_words": {"start_time": [], "end_time": [], "text": []},
            "text_size": item.get("text_size", 30),
            "font_size": item.get("font_size", 15),
            "text_color": item.get("text_color", "#ffffff"),
            "check_flag": item.get("check_flag", 15),
        }
    )
    return item


def make_segment(template: dict, material_id: str, duration_us: int, render_index: int) -> dict:
    segment = copy.deepcopy(template) if template else {}
    segment.update(
        {
            "id": new_id(),
            "material_id": material_id,
            "target_timerange": {"start": 0, "duration": duration_us},
            "source_timerange": {"start": 0, "duration": duration_us},
            "render_timerange": {"start": 0, "duration": 0},
            "extra_material_refs": [],
            "speed": 1,
            "visible": True,
            "volume": segment.get("volume", 1),
            "render_index": render_index,
            "track_render_index": render_index,
        }
    )
    return segment


def make_track(template: dict, track_type: str, segment: dict, render_index: int) -> dict:
    track = copy.deepcopy(template) if template else {}
    track.update(
        {
            "id": new_id(),
            "type": track_type,
            "segments": [segment],
            "attribute": track.get("attribute", 0),
            "flag": 1 if track_type == "text" else track.get("flag", 0),
            "render_index": render_index,
        }
    )
    return track


def probe_duration_us(media_path: Path) -> int | None:
    try:
        completed = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(media_path),
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    try:
        seconds = float(completed.stdout.strip())
    except ValueError:
        return None
    return max(1, round(seconds * 1_000_000))


def determine_duration_us(video_path: Path, audio_path: Path, duration_us: int | None) -> int:
    if duration_us is not None:
        return duration_us
    probed = probe_duration_us(video_path) or probe_duration_us(audio_path)
    return probed or DEFAULT_DURATION_US


def copy_media(output_timeline_dir: Path, video_path: Path, audio_path: Path) -> None:
    video_target = output_timeline_dir / "materials" / "video" / video_path.name
    audio_target = output_timeline_dir / "materials" / "audio" / audio_path.name
    video_target.parent.mkdir(parents=True, exist_ok=True)
    audio_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(video_path, video_target)
    shutil.copy2(audio_path, audio_target)


def update_project_json(output_dir: Path, title: str) -> None:
    project_path = output_dir / "Timelines" / "project.json"
    if not project_path.exists():
        return
    try:
        project = read_json(project_path)
    except json.JSONDecodeError:
        return
    stamp = now_us()
    project["id"] = new_id()
    project["create_time"] = stamp
    project["update_time"] = stamp
    for timeline in project.get("timelines", []):
        if isinstance(timeline, dict):
            timeline["name"] = title
            timeline["create_time"] = stamp
            timeline["update_time"] = stamp
    write_json(project_path, project)


def create_minimal_draft(
    template_dir: str | Path,
    output_dir: str | Path,
    video_path: str | Path,
    audio_path: str | Path,
    title: str,
    subtitle: str = DEFAULT_SUBTITLE,
    duration_us: int | None = None,
    overwrite: bool = False,
) -> SimpleNamespace:
    template_dir = Path(template_dir)
    output_dir = Path(output_dir)
    video_path = Path(video_path)
    audio_path = Path(audio_path)

    if not template_dir.is_dir():
        raise ValueError(f"模板草稿目录不存在：{template_dir}")
    if not video_path.is_file():
        raise ValueError(f"视频文件不存在：{video_path}")
    if not audio_path.is_file():
        raise ValueError(f"音频文件不存在：{audio_path}")
    if output_dir.exists():
        if not overwrite:
            raise ValueError(f"输出目录已存在，如需覆盖请加 --overwrite：{output_dir}")
        shutil.rmtree(output_dir)

    shutil.copytree(template_dir, output_dir)

    source_timeline_dir = find_timeline_dir(template_dir)
    output_timeline_dir = output_dir / "Timelines" / source_timeline_dir.name
    base = load_timeline_base(source_timeline_dir)
    rich = load_rich_template(source_timeline_dir)
    duration = determine_duration_us(video_path, audio_path, duration_us)
    stamp = now_us()

    video_id = new_id()
    audio_id = new_id()
    text_id = new_id()
    timeline = copy.deepcopy(base)
    timeline["id"] = new_id()
    timeline["name"] = title
    timeline["duration"] = duration
    timeline["create_time"] = stamp
    timeline["update_time"] = stamp
    timeline["fps"] = timeline.get("fps", 30)
    timeline["canvas_config"] = timeline.get("canvas_config") or {
        "height": 1280,
        "ratio": "9:16",
        "width": 720,
    }
    timeline["materials"] = default_materials(base, rich)
    timeline["materials"]["videos"] = [
        make_video_material(first_material(rich, "videos"), video_path, video_id, duration)
    ]
    timeline["materials"]["audios"] = [
        make_audio_material(first_material(rich, "audios"), audio_path, audio_id, duration)
    ]
    timeline["materials"]["texts"] = [
        make_text_material(first_material(rich, "texts"), subtitle, text_id, duration)
    ]

    video_segment = make_segment(first_segment(rich, "video"), video_id, duration, 0)
    audio_segment = make_segment(first_segment(rich, "audio"), audio_id, duration, 1)
    text_segment = make_segment(first_segment(rich, "text"), text_id, duration, 2)
    timeline["tracks"] = [
        make_track(first_track(rich, "video"), "video", video_segment, 0),
        make_track(first_track(rich, "audio"), "audio", audio_segment, 1),
        make_track(first_track(rich, "text"), "text", text_segment, 2),
    ]

    copy_media(output_timeline_dir, video_path, audio_path)
    for name in ("template.tmp", "template.json"):
        path = output_timeline_dir / name
        if path.exists():
            write_json(path, timeline)
    update_project_json(output_dir, title)

    return SimpleNamespace(
        output_dir=output_dir,
        timeline_id=source_timeline_dir.name,
        timeline_template=output_timeline_dir / "template.json",
        duration_us=duration,
    )


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="基于真实样本生成最小剪映草稿")
    parser.add_argument("--template", required=True, help="真实剪映草稿样本目录")
    parser.add_argument("--output", required=True, help="新草稿输出目录")
    parser.add_argument("--video", required=True, help="要写入草稿的视频文件")
    parser.add_argument("--audio", required=True, help="要写入草稿的音频文件")
    parser.add_argument("--title", default="测试导出草稿", help="草稿标题")
    parser.add_argument("--subtitle", default=DEFAULT_SUBTITLE, help="测试字幕内容")
    parser.add_argument("--duration-seconds", type=float, help="手动指定时长，单位秒")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在输出目录")
    args = parser.parse_args()

    duration_us = round(args.duration_seconds * 1_000_000) if args.duration_seconds else None
    try:
        result = create_minimal_draft(
            template_dir=args.template,
            output_dir=args.output,
            video_path=args.video,
            audio_path=args.audio,
            title=args.title,
            subtitle=args.subtitle,
            duration_us=duration_us,
            overwrite=args.overwrite,
        )
    except Exception as exc:
        print(f"生成失败：{exc}")
        return 2

    print("已生成剪映草稿")
    print(f"输出目录: {result.output_dir}")
    print(f"时间线: {result.timeline_id}")
    print(f"duration(us): {result.duration_us}")
    print(f"明文模板: {result.timeline_template}")
    print("说明: 根目录 draft_content.json / draft_meta_info.json 如为加密内容，会原样复制保留。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
