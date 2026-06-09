#!/usr/bin/env python3
"""
template_slot_replace_draft.py - copy an existing Jianying draft template and
replace only existing material slots in root/draft_info.json.

This script deliberately does not rebuild the timeline. It preserves tracks,
segments, IDs, draft_content.json, template-2.tmp, draft_meta_info.json, and the
Timelines directory as copied from the template.
"""

import argparse
import json
import shutil
import sys
from pathlib import Path


REQUIRED_TEMPLATE_ENTRIES = [
    "draft_info.json",
    "draft_content.json",
    "draft_meta_info.json",
    "template-2.tmp",
    "timeline_layout.json",
    "Timelines",
]


def _is_relative_to(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def _read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def validate_template_dir(template_dir: Path) -> None:
    if not template_dir.exists() or not template_dir.is_dir():
        raise SystemExit(f"[错误] 模板目录不存在或不是目录: {template_dir}")

    missing = [name for name in REQUIRED_TEMPLATE_ENTRIES if not (template_dir / name).exists()]
    if missing:
        raise SystemExit(
            "[错误] 模板目录缺少必需文件/目录:\n"
            + "\n".join(f"  - {name}" for name in missing)
        )

    try:
        _read_json(template_dir / "draft_info.json")
    except Exception as exc:
        raise SystemExit(f"[错误] draft_info.json 不可解析: {exc}") from exc


def validate_media_paths(paths: list[Path], label: str, suffixes: tuple[str, ...]) -> None:
    if not paths:
        raise SystemExit(f"[错误] 至少需要 1 个 {label} 文件")

    for path in paths:
        if not path.exists() or not path.is_file():
            raise SystemExit(f"[错误] {label} 文件不存在: {path}")
        if path.suffix.lower() not in suffixes:
            raise SystemExit(f"[错误] {label} 文件扩展名不符合预期: {path}")


def prepare_output_dir(template_dir: Path, output_dir: Path) -> None:
    if template_dir == output_dir:
        raise SystemExit("[错误] output 不能与 template 相同，避免覆盖模板")
    if _is_relative_to(template_dir, output_dir):
        raise SystemExit("[错误] output 不能是 template 的父目录，避免误删模板")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    shutil.copytree(template_dir, output_dir)


def _unique_dest(dest_dir: Path, source: Path, index: int, prefix: str, used: set[str]) -> Path:
    name = source.name
    if name in used:
        name = f"{prefix}{index}{source.suffix.lower()}"
    used.add(name)
    return dest_dir / name


def copy_media_files(paths: list[Path], dest_dir: Path, prefix: str) -> list[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    used: set[str] = set()

    for index, source in enumerate(paths, start=1):
        dest = _unique_dest(dest_dir, source, index, prefix, used)
        shutil.copy2(source, dest)
        copied.append(dest.resolve())

    return copied


def _path_exists(value: str) -> bool:
    try:
        return bool(value) and Path(value).exists()
    except Exception:
        return False


def _set_material_path_and_name(material: dict, replacement: Path) -> None:
    replacement_str = str(replacement)
    stem = replacement.stem
    name = replacement.name

    material["path"] = replacement_str
    if "file_Path" in material:
        material["file_Path"] = replacement_str

    for key in ("name", "material_name", "file_name", "display_name"):
        if key in material:
            material[key] = name if key != "name" else stem


def replace_media_slots(materials: dict, key: str, copied_paths: list[Path]) -> dict:
    slots = materials.get(key) or []
    if len(slots) < len(copied_paths):
        raise SystemExit(
            f"[错误] 模板 materials.{key} 槽位不足: "
            f"{len(slots)} < {len(copied_paths)}"
        )

    primary_replaced = 0
    missing_filled = 0

    for index, replacement in enumerate(copied_paths):
        _set_material_path_and_name(slots[index], replacement)
        primary_replaced += 1

    # A structure-pack template has no real media. Fill only missing remaining
    # slots by cycling the provided test assets, without adding/removing slots.
    for index in range(len(copied_paths), len(slots)):
        old_path = slots[index].get("path") or slots[index].get("file_Path") or ""
        if not _path_exists(old_path):
            replacement = copied_paths[index % len(copied_paths)]
            _set_material_path_and_name(slots[index], replacement)
            missing_filled += 1

    return {
        "slots": len(slots),
        "primary_replaced": primary_replaced,
        "missing_filled": missing_filled,
    }


def _update_style_ranges(obj: dict, text: str) -> None:
    styles = obj.get("styles")
    if not isinstance(styles, list):
        return
    for style in styles:
        if isinstance(style, dict) and isinstance(style.get("range"), list):
            style["range"] = [0, len(text)]


def _json_text_content(raw: str, text: str) -> str | None:
    try:
        obj = json.loads(raw)
    except Exception:
        return None
    if not isinstance(obj, dict):
        return None
    obj["text"] = text
    _update_style_ranges(obj, text)
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def replace_text_slot(material: dict, text: str) -> None:
    changed = False

    for key in ("content", "base_content"):
        raw = material.get(key)
        if isinstance(raw, str) and raw:
            updated = _json_text_content(raw, text)
            material[key] = updated if updated is not None else text
            changed = True

    for key in ("text", "name", "recognize_text", "render_text", "display_text"):
        if key in material and isinstance(material.get(key), str):
            material[key] = text
            changed = True

    if not changed:
        material["content"] = json.dumps({"text": text}, ensure_ascii=False, separators=(",", ":"))


def replace_subtitle_slots(materials: dict, subtitles: list[str]) -> dict:
    slots = materials.get("texts") or []
    if len(slots) < len(subtitles):
        raise SystemExit(
            f"[错误] 模板 materials.texts 槽位不足: "
            f"{len(slots)} < {len(subtitles)}"
        )

    for index, text in enumerate(subtitles):
        replace_text_slot(slots[index], text)

    return {"slots": len(slots), "primary_replaced": len(subtitles)}


def collect_material_paths_from_data(draft_data: dict) -> list[str]:
    paths: list[str] = []
    materials = draft_data.get("materials") or {}
    for key in ("videos", "audios", "images"):
        for item in materials.get(key) or []:
            for path_key in ("path", "file_Path"):
                value = item.get(path_key)
                if value and isinstance(value, str) and value not in paths:
                    paths.append(value)
    return paths


def run(args) -> dict:
    template_dir = Path(args.template).resolve()
    output_dir = Path(args.output).resolve()
    video_paths = [Path(value).resolve() for value in args.video]
    audio_paths = [Path(value).resolve() for value in args.audio]
    subtitles = list(args.subtitle)

    validate_template_dir(template_dir)
    validate_media_paths(video_paths, "mp4", (".mp4",))
    validate_media_paths(audio_paths, "mp3", (".mp3",))
    if not subtitles:
        raise SystemExit("[错误] 至少需要 1 条 --subtitle")

    prepare_output_dir(template_dir, output_dir)

    video_copies = copy_media_files(video_paths, output_dir / "assets" / "video", "clip")
    audio_copies = copy_media_files(audio_paths, output_dir / "assets" / "audio", "audio")

    draft_info_path = output_dir / "draft_info.json"
    draft_data = _read_json(draft_info_path)
    materials = draft_data.get("materials")
    if not isinstance(materials, dict):
        raise SystemExit("[错误] draft_info.json 缺少 materials 对象")

    video_stats = replace_media_slots(materials, "videos", video_copies)
    audio_stats = replace_media_slots(materials, "audios", audio_copies)
    text_stats = replace_subtitle_slots(materials, subtitles)

    _write_json(draft_info_path, draft_data)

    paths = collect_material_paths_from_data(draft_data)
    missing = [value for value in paths if not _path_exists(value)]

    result = {
        "template": str(template_dir),
        "output": str(output_dir),
        "video_copies": [str(path) for path in video_copies],
        "audio_copies": [str(path) for path in audio_copies],
        "video_stats": video_stats,
        "audio_stats": audio_stats,
        "text_stats": text_stats,
        "material_paths": len(paths),
        "missing_paths": len(missing),
    }
    return result


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Copy a Jianying draft template and replace existing media/text slots only."
    )
    parser.add_argument("--template", required=True, help="模板草稿目录")
    parser.add_argument("--output", required=True, help="输出草稿目录")
    parser.add_argument("--video", action="append", default=[], help="mp4 文件路径，可多次指定")
    parser.add_argument("--audio", action="append", default=[], help="mp3 文件路径，可多次指定")
    parser.add_argument("--subtitle", action="append", default=[], help="字幕文本，可多次指定")
    args = parser.parse_args()

    result = run(args)
    print("\n✓ 槽位替换草稿生成完成")
    print(f"  template : {result['template']}")
    print(f"  output   : {result['output']}")
    print(f"  videos   : primary={result['video_stats']['primary_replaced']} "
          f"filled_missing={result['video_stats']['missing_filled']} "
          f"slots={result['video_stats']['slots']}")
    print(f"  audios   : primary={result['audio_stats']['primary_replaced']} "
          f"filled_missing={result['audio_stats']['missing_filled']} "
          f"slots={result['audio_stats']['slots']}")
    print(f"  texts    : primary={result['text_stats']['primary_replaced']} "
          f"slots={result['text_stats']['slots']}")
    print(f"  paths    : total={result['material_paths']} missing={result['missing_paths']}")
    print("\n[注意] 这里只验证草稿文件结构；剪映 GUI 是否生效需要用户本地打开确认。")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        print(f"[错误] {exc}")
        sys.exit(1)
