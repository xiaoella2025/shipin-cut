#!/usr/bin/env python
"""Create a Jianying draft from a shipin-cut composition JSON file."""

from __future__ import annotations

import argparse
import copy
import json
import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

THIS_DIR = Path(__file__).resolve().parent
if str(THIS_DIR) not in sys.path:
    sys.path.insert(0, str(THIS_DIR))

from create_minimal_draft import (  # noqa: E402
    default_materials,
    find_timeline_dir,
    first_material,
    first_segment,
    first_track,
    load_rich_template,
    load_timeline_base,
    make_audio_material,
    make_segment,
    make_text_material,
    make_track,
    make_video_material,
    new_id,
    now_us,
    read_json,
    update_project_json,
    update_timeline_layout,
    write_json,
)


def as_path(value: object, field: str) -> Path:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field} 必须是非空路径字符串")
    return Path(value)


def as_int(value: object, field: str, default: int | None = None) -> int:
    if value is None and default is not None:
        return default
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field} 必须是数字，单位微秒")
    value = round(value)
    if value < 0:
        raise ValueError(f"{field} 不能是负数")
    return value


def load_comp_input(path: str | Path) -> dict:
    input_path = Path(path)
    try:
        data = read_json(input_path)
    except json.JSONDecodeError as exc:
        raise ValueError(f"输入 JSON 解析失败：{exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("输入 JSON 顶层必须是对象")
    return data


def validate_comp(data: dict) -> tuple[Path, Path, list[dict], dict | None, list[dict]]:
    template_dir = as_path(data.get("templateDraftDir"), "templateDraftDir")
    output_dir = as_path(data.get("outputDraftDir"), "outputDraftDir")
    if not template_dir.is_dir():
        raise ValueError(f"模板草稿目录不存在：{template_dir}")

    segments = data.get("segments")
    if not isinstance(segments, list) or not segments:
        raise ValueError("segments 必须是非空数组")
    for index, segment in enumerate(segments):
        if not isinstance(segment, dict):
            raise ValueError(f"segments[{index}] 必须是对象")
        source = as_path(segment.get("sourceVideo"), f"segments[{index}].sourceVideo")
        if not source.is_file():
            raise ValueError(f"视频文件不存在：{source}")
        as_int(segment.get("sourceStartUs"), f"segments[{index}].sourceStartUs", 0)
        as_int(segment.get("sourceDurationUs"), f"segments[{index}].sourceDurationUs")
        as_int(segment.get("timelineStartUs"), f"segments[{index}].timelineStartUs", 0)
        as_int(segment.get("timelineDurationUs"), f"segments[{index}].timelineDurationUs")

    voice = data.get("voice")
    if voice is not None:
        if not isinstance(voice, dict):
            raise ValueError("voice 必须是对象")
        voice_path = as_path(voice.get("path"), "voice.path")
        if not voice_path.is_file():
            raise ValueError(f"音频文件不存在：{voice_path}")
        as_int(voice.get("timelineStartUs"), "voice.timelineStartUs", 0)
        as_int(voice.get("durationUs"), "voice.durationUs")

    subtitles = data.get("subtitles", [])
    if not isinstance(subtitles, list):
        raise ValueError("subtitles 必须是数组")
    for index, subtitle in enumerate(subtitles):
        if not isinstance(subtitle, dict):
            raise ValueError(f"subtitles[{index}] 必须是对象")
        if not isinstance(subtitle.get("text", ""), str):
            raise ValueError(f"subtitles[{index}].text 必须是字符串")
        as_int(subtitle.get("startUs"), f"subtitles[{index}].startUs", 0)
        as_int(subtitle.get("durationUs"), f"subtitles[{index}].durationUs")

    return template_dir, output_dir, segments, voice, subtitles


def unique_media_name(source: Path, used_names: set[str]) -> str:
    name = source.name
    if name not in used_names:
        used_names.add(name)
        return name
    stem = source.stem
    suffix = source.suffix
    index = 2
    while True:
        candidate = f"{stem}_{index}{suffix}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
        index += 1


def copy_one_media(output_timeline_dir: Path, kind: str, source: Path, target_name: str) -> Path:
    target = output_timeline_dir / "materials" / kind / target_name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return target


def apply_canvas(timeline: dict, canvas: object) -> None:
    if not isinstance(canvas, dict):
        return
    config = copy.deepcopy(timeline.get("canvas_config") or {})
    for key in ("ratio", "width", "height"):
        if key in canvas:
            config[key] = canvas[key]
    timeline["canvas_config"] = config
    if "fps" in canvas:
        timeline["fps"] = canvas["fps"]


def timeline_duration_us(segments: list[dict], voice: dict | None, subtitles: list[dict]) -> int:
    ends = []
    for segment in segments:
        start = as_int(segment.get("timelineStartUs"), "segment.timelineStartUs", 0)
        duration = as_int(segment.get("timelineDurationUs"), "segment.timelineDurationUs")
        ends.append(start + duration)
    if voice:
        ends.append(
            as_int(voice.get("timelineStartUs"), "voice.timelineStartUs", 0)
            + as_int(voice.get("durationUs"), "voice.durationUs")
        )
    for subtitle in subtitles:
        ends.append(
            as_int(subtitle.get("startUs"), "subtitle.startUs", 0)
            + as_int(subtitle.get("durationUs"), "subtitle.durationUs")
        )
    return max(ends) if ends else 0


def set_segment_ranges(
    segment: dict,
    source_start_us: int,
    source_duration_us: int,
    timeline_start_us: int,
    timeline_duration_us_value: int,
    speed: float,
) -> dict:
    segment["source_timerange"] = {"start": source_start_us, "duration": source_duration_us}
    segment["target_timerange"] = {
        "start": timeline_start_us,
        "duration": timeline_duration_us_value,
    }
    segment["speed"] = speed
    return segment


def create_comp_draft_from_data(data: dict, overwrite: bool = False) -> SimpleNamespace:
    template_dir, output_dir, segments, voice, subtitles = validate_comp(data)
    if output_dir.exists():
        if not overwrite:
            raise ValueError(f"输出目录已存在，如需覆盖请加 --overwrite：{output_dir}")
        shutil.rmtree(output_dir)

    shutil.copytree(template_dir, output_dir)
    source_timeline_dir = find_timeline_dir(template_dir)
    output_timeline_dir = output_dir / "Timelines" / source_timeline_dir.name
    base = load_timeline_base(source_timeline_dir)
    rich = load_rich_template(source_timeline_dir)
    title = output_dir.name
    duration = timeline_duration_us(segments, voice, subtitles)
    stamp = now_us()

    timeline = copy.deepcopy(base)
    timeline["id"] = new_id()
    timeline["name"] = title
    timeline["duration"] = duration
    timeline["create_time"] = stamp
    timeline["update_time"] = stamp
    timeline["fps"] = timeline.get("fps", 30)
    apply_canvas(timeline, data.get("canvas"))
    timeline["materials"] = default_materials(base, rich)

    used_video_names: set[str] = set()
    video_segments = []
    video_materials = []
    for index, segment_data in enumerate(segments):
        source = as_path(segment_data.get("sourceVideo"), f"segments[{index}].sourceVideo")
        target_name = unique_media_name(source, used_video_names)
        copy_one_media(output_timeline_dir, "video", source, target_name)
        source_for_material = source.with_name(target_name)
        material_id = new_id()
        source_duration = as_int(segment_data.get("sourceDurationUs"), f"segments[{index}].sourceDurationUs")
        timeline_duration = as_int(segment_data.get("timelineDurationUs"), f"segments[{index}].timelineDurationUs")
        video_materials.append(
            make_video_material(first_material(rich, "videos"), source_for_material, material_id, source_duration)
        )
        video_segment = make_segment(first_segment(rich, "video"), material_id, timeline_duration, index)
        speed = segment_data.get("speed", 1.0)
        if not isinstance(speed, (int, float)) or speed <= 0:
            speed = 1.0
        video_segments.append(
            set_segment_ranges(
                video_segment,
                as_int(segment_data.get("sourceStartUs"), f"segments[{index}].sourceStartUs", 0),
                source_duration,
                as_int(segment_data.get("timelineStartUs"), f"segments[{index}].timelineStartUs", 0),
                timeline_duration,
                float(speed),
            )
        )

    timeline["materials"]["videos"] = video_materials
    tracks = [make_track(first_track(rich, "video"), "video", video_segments[0], 0)]
    tracks[0]["segments"] = video_segments

    if voice:
        voice_path = as_path(voice.get("path"), "voice.path")
        audio_name = unique_media_name(voice_path, set())
        copy_one_media(output_timeline_dir, "audio", voice_path, audio_name)
        audio_material_source = voice_path.with_name(audio_name)
        audio_id = new_id()
        audio_duration = as_int(voice.get("durationUs"), "voice.durationUs")
        timeline["materials"]["audios"] = [
            make_audio_material(first_material(rich, "audios"), audio_material_source, audio_id, audio_duration)
        ]
        audio_segment = make_segment(first_segment(rich, "audio"), audio_id, audio_duration, 1)
        audio_segment["target_timerange"] = {
            "start": as_int(voice.get("timelineStartUs"), "voice.timelineStartUs", 0),
            "duration": audio_duration,
        }
        audio_segment["source_timerange"] = {"start": 0, "duration": audio_duration}
        tracks.append(make_track(first_track(rich, "audio"), "audio", audio_segment, 1))
    else:
        timeline["materials"]["audios"] = []

    text_segments = []
    text_materials = []
    for index, subtitle in enumerate(subtitles):
        text = subtitle.get("text", "")
        text_id = new_id()
        subtitle_duration = as_int(subtitle.get("durationUs"), f"subtitles[{index}].durationUs")
        text_materials.append(
            make_text_material(first_material(rich, "texts"), text, text_id, subtitle_duration)
        )
        text_segment = make_segment(first_segment(rich, "text"), text_id, subtitle_duration, 2)
        text_segment["target_timerange"] = {
            "start": as_int(subtitle.get("startUs"), f"subtitles[{index}].startUs", 0),
            "duration": subtitle_duration,
        }
        text_segment["source_timerange"] = {"start": 0, "duration": subtitle_duration}
        text_segments.append(text_segment)

    timeline["materials"]["texts"] = text_materials
    if text_segments:
        text_track = make_track(first_track(rich, "text"), "text", text_segments[0], 2)
        text_track["segments"] = text_segments
        tracks.append(text_track)

    timeline["tracks"] = tracks

    write_timeline_content_files(output_dir, output_timeline_dir, timeline)
    update_project_json(output_dir, title)
    update_timeline_layout(output_dir, source_timeline_dir.name, title)

    return SimpleNamespace(
        output_dir=output_dir,
        timeline_id=source_timeline_dir.name,
        timeline_template=output_timeline_dir / "template.json",
        duration_us=duration,
        video_segments=len(video_segments),
        subtitle_segments=len(text_segments),
    )


def write_timeline_content_files(output_dir: Path, output_timeline_dir: Path, timeline: dict) -> None:
    timeline_files = (
        "template.tmp",
        "template.json",
        "draft_content.json",
        "draft_content.json.bak",
        "template-2.tmp",
    )
    for name in timeline_files:
        path = output_timeline_dir / name
        if path.exists() or name in {"template.tmp", "template.json"}:
            write_json(path, timeline)

    root_files = ("draft_content.json", "draft_content.json.bak", "template-2.tmp")
    for name in root_files:
        path = output_dir / name
        if path.exists():
            write_json(path, timeline)


def create_comp_draft(input_path: str | Path, overwrite: bool = False) -> SimpleNamespace:
    return create_comp_draft_from_data(load_comp_input(input_path), overwrite=overwrite)


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="从 shipin-cut 成品 JSON 生成剪映草稿")
    parser.add_argument("--input", required=True, help="current_comp_for_jianying.json 路径")
    parser.add_argument("--overwrite", action="store_true", help="覆盖已存在输出目录")
    args = parser.parse_args()

    try:
        result = create_comp_draft(args.input, overwrite=args.overwrite)
    except Exception as exc:
        print(f"生成失败：{exc}")
        return 2

    print("已生成剪映成品草稿")
    print(f"输出目录: {result.output_dir}")
    print(f"时间线: {result.timeline_id}")
    print(f"duration(us): {result.duration_us}")
    print(f"视频片段数: {result.video_segments}")
    print(f"字幕数: {result.subtitle_segments}")
    print(f"明文模板: {result.timeline_template}")
    print("说明: speed 字段已写入 segment.speed；复杂变速素材暂未生成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
