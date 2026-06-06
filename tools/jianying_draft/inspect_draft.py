#!/usr/bin/env python
"""Inspect a Jianying draft folder without modifying it."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def read_text(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig", errors="replace")
    except OSError:
        return None


def load_json(path: Path) -> tuple[object | None, str | None]:
    text = read_text(path)
    if text is None:
        return None, "文件不存在或无法读取"
    try:
        return json.loads(text), None
    except json.JSONDecodeError as exc:
        return None, f"不是可直接解析的 JSON：{exc.msg}"


def find_timeline_dir(draft_dir: Path) -> Path | None:
    timelines_dir = draft_dir / "Timelines"
    project_json, _ = load_json(timelines_dir / "project.json")
    if isinstance(project_json, dict):
        timeline_id = project_json.get("main_timeline_id")
        if isinstance(timeline_id, str) and (timelines_dir / timeline_id).is_dir():
            return timelines_dir / timeline_id

    if timelines_dir.is_dir():
        for child in timelines_dir.iterdir():
            if child.is_dir() and (
                (child / "template.json").exists() or (child / "template.tmp").exists()
            ):
                return child
    return None


def active_timeline_ids(draft_dir: Path) -> set[str]:
    ids: set[str] = set()
    timelines_dir = draft_dir / "Timelines"
    project_json, _ = load_json(timelines_dir / "project.json")
    if isinstance(project_json, dict):
        timeline_id = project_json.get("main_timeline_id")
        if isinstance(timeline_id, str):
            ids.add(timeline_id)

    layout_json, _ = load_json(draft_dir / "timeline_layout.json")
    if isinstance(layout_json, dict):
        active = layout_json.get("activeTimeline")
        if isinstance(active, str):
            ids.add(active)
    return ids


def timeline_dirs(draft_dir: Path) -> list[Path]:
    timelines_dir = draft_dir / "Timelines"
    if not timelines_dir.is_dir():
        return []
    return sorted([child for child in timelines_dir.iterdir() if child.is_dir()], key=lambda p: p.name)


def load_timeline_template(timeline_dir: Path | None) -> tuple[dict | None, Path | None, str | None]:
    if timeline_dir is None:
        return None, None, "没有找到 Timelines 下的主时间线目录"
    for name in ("template.json", "template.tmp"):
        path = timeline_dir / name
        if not path.exists():
            continue
        data, error = load_json(path)
        if isinstance(data, dict):
            return data, path, None
        if error:
            return None, path, error
    return None, None, "主时间线目录里没有 template.json 或 template.tmp"


def parse_timeline_file(path: Path) -> tuple[dict | None, str | None]:
    if not path.exists():
        return None, "missing"
    data, error = load_json(path)
    return data if isinstance(data, dict) else None, error


def count_materials(materials: object) -> dict[str, int]:
    if not isinstance(materials, dict):
        return {}
    counts: dict[str, int] = {}
    for key, value in materials.items():
        counts[key] = len(value) if isinstance(value, list) else 0
    return counts


def resource_path_samples(timeline: dict | None, limit: int = 8) -> list[str]:
    if not isinstance(timeline, dict):
        return []
    samples: list[str] = []
    materials = timeline.get("materials")
    if isinstance(materials, dict):
        for items in materials.values():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                path = item.get("path") or item.get("media_path") or item.get("intensifies_path")
                if isinstance(path, str) and path and path not in samples:
                    samples.append(path)
                    if len(samples) >= limit:
                        return samples
    return samples


def summarize_timeline(draft_dir: Path, timeline_dir: Path) -> dict:
    active_ids = active_timeline_ids(draft_dir)
    timeline, template_path, error = load_timeline_template(timeline_dir)
    tracks = timeline.get("tracks", []) if isinstance(timeline, dict) else []
    materials = timeline.get("materials", {}) if isinstance(timeline, dict) else {}
    material_counts = count_materials(materials)

    content_candidates = []
    for name in ("template.json", "template.tmp", "draft_content.json", "draft_content.json.bak", "template-2.tmp"):
        path = timeline_dir / name
        if not path.exists():
            continue
        candidate, candidate_error = parse_timeline_file(path)
        candidate_tracks = candidate.get("tracks", []) if isinstance(candidate, dict) else []
        candidate_counts = count_materials(candidate.get("materials", {})) if isinstance(candidate, dict) else {}
        content_candidates.append(
            {
                "file": name,
                "path": str(path),
                "parseable": isinstance(candidate, dict),
                "error": candidate_error,
                "duration": candidate.get("duration") if isinstance(candidate, dict) else None,
                "tracks_count": len(candidate_tracks) if isinstance(candidate_tracks, list) else 0,
                "video_materials_count": candidate_counts.get("videos", 0),
                "audio_materials_count": candidate_counts.get("audios", 0),
                "text_materials_count": candidate_counts.get("texts", 0),
                "looks_like_old_template": (
                    candidate_counts.get("videos", 0) == 9
                    and candidate_counts.get("audios", 0) == 9
                    and candidate_counts.get("texts", 0) == 11
                ),
            }
        )

    return {
        "timeline_id": timeline_dir.name,
        "timeline_dir": str(timeline_dir),
        "template_path": str(template_path) if template_path else "",
        "template_error": error,
        "name": timeline.get("name", "") if isinstance(timeline, dict) else "",
        "duration": timeline.get("duration") if isinstance(timeline, dict) else None,
        "tracks_count": len(tracks) if isinstance(tracks, list) else 0,
        "track_types": [track.get("type", "") for track in tracks if isinstance(track, dict)],
        "video_materials_count": material_counts.get("videos", 0),
        "audio_materials_count": material_counts.get("audios", 0),
        "text_materials_count": material_counts.get("texts", 0),
        "is_active": timeline_dir.name in active_ids,
        "active_reason": "project.json/timeline_layout.json" if timeline_dir.name in active_ids else "",
        "content_candidates": content_candidates,
    }


def inspect_all_timelines(draft_dir: str | Path) -> list[dict]:
    draft_path = Path(draft_dir)
    return [summarize_timeline(draft_path, timeline_dir) for timeline_dir in timeline_dirs(draft_path)]


def inspect_draft(draft_dir: str | Path) -> dict:
    draft_path = Path(draft_dir)
    content_path = draft_path / "draft_content.json"
    meta_path = draft_path / "draft_meta_info.json"
    content_data, content_error = load_json(content_path)
    meta_data, meta_error = load_json(meta_path)
    timeline_dir = find_timeline_dir(draft_path)
    timeline, timeline_template_path, timeline_error = load_timeline_template(timeline_dir)

    tracks = timeline.get("tracks", []) if isinstance(timeline, dict) else []
    materials = timeline.get("materials", {}) if isinstance(timeline, dict) else {}
    material_counts = count_materials(materials)

    summary = {
        "draft_dir": str(draft_path),
        "draft_content_found": content_path.exists(),
        "draft_content_parseable": isinstance(content_data, dict),
        "draft_content_error": content_error,
        "draft_meta_info_found": meta_path.exists(),
        "draft_meta_info_parseable": isinstance(meta_data, dict),
        "draft_meta_info_error": meta_error,
        "timeline_dir": str(timeline_dir) if timeline_dir else "",
        "timeline_template_found": timeline_template_path is not None,
        "timeline_template_path": str(timeline_template_path) if timeline_template_path else "",
        "timeline_template_error": timeline_error,
        "draft_name": timeline.get("name", "") if isinstance(timeline, dict) else "",
        "duration": timeline.get("duration") if isinstance(timeline, dict) else None,
        "fps": timeline.get("fps") if isinstance(timeline, dict) else None,
        "tracks_count": len(tracks) if isinstance(tracks, list) else 0,
        "track_types": [track.get("type", "") for track in tracks if isinstance(track, dict)],
        "materials_counts": material_counts,
        "video_materials_count": material_counts.get("videos", 0),
        "audio_materials_count": material_counts.get("audios", 0),
        "text_materials_count": material_counts.get("texts", 0),
        "resource_path_samples": resource_path_samples(timeline),
        "time_unit_guess": "微秒 us（样本 23,833,333 约等于 23.8 秒）",
        "content_top_keys": list(content_data.keys()) if isinstance(content_data, dict) else [],
        "meta_top_keys": list(meta_data.keys()) if isinstance(meta_data, dict) else [],
        "timeline_top_keys": list(timeline.keys()) if isinstance(timeline, dict) else [],
    }
    return summary


def print_summary(summary: dict) -> None:
    print("剪映草稿检查结果")
    print("=" * 40)
    print(f"草稿目录: {summary['draft_dir']}")
    print(f"draft_content.json: {'找到' if summary['draft_content_found'] else '未找到'}")
    print(f"  可解析: {'是' if summary['draft_content_parseable'] else '否'}")
    if summary.get("draft_content_error"):
        print(f"  说明: {summary['draft_content_error']}")
    print(f"draft_meta_info.json: {'找到' if summary['draft_meta_info_found'] else '未找到'}")
    print(f"  可解析: {'是' if summary['draft_meta_info_parseable'] else '否'}")
    if summary.get("draft_meta_info_error"):
        print(f"  说明: {summary['draft_meta_info_error']}")
    print(f"主时间线目录: {summary['timeline_dir'] or '未找到'}")
    print(f"明文时间线模板: {summary['timeline_template_path'] or '未找到'}")
    if summary.get("timeline_template_error"):
        print(f"  说明: {summary['timeline_template_error']}")
    print(f"草稿名称: {summary['draft_name'] or '未知'}")
    print(f"duration: {summary['duration']}")
    print(f"fps: {summary['fps']}")
    print(f"tracks 数量: {summary['tracks_count']}")
    print(f"tracks 类型: {', '.join(summary['track_types']) or '无'}")
    print("materials 类型统计:")
    for key in sorted(summary["materials_counts"]):
        print(f"  - {key}: {summary['materials_counts'][key]}")
    print(f"视频素材数量: {summary['video_materials_count']}")
    print(f"音频素材数量: {summary['audio_materials_count']}")
    print(f"文本/字幕数量: {summary['text_materials_count']}")
    print("资源路径示例:")
    for sample in summary["resource_path_samples"] or ["无"]:
        print(f"  - {sample}")
    print(f"时间单位判断: {summary['time_unit_guess']}")
    print("关键字段摘要:")
    print(f"  draft_content 顶层字段: {', '.join(summary['content_top_keys']) or '不可解析'}")
    print(f"  draft_meta_info 顶层字段: {', '.join(summary['meta_top_keys']) or '不可解析'}")
    print(f"  timeline 模板顶层字段: {', '.join(summary['timeline_top_keys']) or '不可解析'}")


def print_all_timelines(summaries: list[dict]) -> None:
    print("所有 Timelines 摘要")
    print("=" * 40)
    if not summaries:
        print("没有找到 Timelines/<id> 目录")
        return
    for summary in summaries:
        marker = "ACTIVE" if summary["is_active"] else "inactive"
        print(f"[{marker}] {summary['timeline_id']}")
        print(f"  template: {summary['template_path'] or '未找到'}")
        print(f"  name: {summary['name'] or '未知'}")
        print(f"  duration: {summary['duration']}")
        print(f"  tracks: {summary['tracks_count']} ({', '.join(summary['track_types']) or '无'})")
        print(
            "  materials: "
            f"videos={summary['video_materials_count']}, "
            f"audios={summary['audio_materials_count']}, "
            f"texts={summary['text_materials_count']}"
        )
        print(f"  active 判断: {summary['active_reason'] or '未命中 active 指针'}")
        print("  内容候选文件:")
        for candidate in summary["content_candidates"]:
            old_mark = " old-9/9/11" if candidate["looks_like_old_template"] else ""
            print(
                f"    - {candidate['file']}: "
                f"parseable={candidate['parseable']}, "
                f"duration={candidate['duration']}, "
                f"tracks={candidate['tracks_count']}, "
                f"videos={candidate['video_materials_count']}, "
                f"audios={candidate['audio_materials_count']}, "
                f"texts={candidate['text_materials_count']}{old_mark}"
            )


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="只读检查剪映草稿目录")
    parser.add_argument("draft_dir", help="剪映草稿目录")
    parser.add_argument("--all-timelines", action="store_true", help="列出所有 Timelines/<id> 摘要")
    args = parser.parse_args()
    draft_dir = Path(args.draft_dir)
    if not draft_dir.exists():
        print(f"找不到草稿目录：{draft_dir}")
        return 2
    if args.all_timelines:
        print_all_timelines(inspect_all_timelines(draft_dir))
        return 0
    summary = inspect_draft(draft_dir)
    print_summary(summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
