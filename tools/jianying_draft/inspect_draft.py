#!/usr/bin/env python3
"""
inspect_draft.py — 分析剪映草稿目录结构

支持：
  - root/draft_info.json    (JianyingPro 5.x Storybound 草稿，优先)
  - root/draft_content.json (JianyingPro 传统草稿，回退)

用法：
  python inspect_draft.py <草稿目录> [--check-media-paths]

选项：
  --check-media-paths   检查所有素材路径是否真实存在于文件系统
"""

import sys
import json
import argparse
from pathlib import Path


SEP = "=" * 64


def sep(title=""):
    print("\n" + SEP)
    if title:
        print(f"  {title}")
        print(SEP)


def us_to_readable(us):
    try:
        s = int(us) / 1_000_000
        m = int(s) // 60
        sec = s - m * 60
        if m:
            return f"{m}m{sec:.2f}s  ({int(us)} µs)"
        return f"{s:.3f}s  ({int(us)} µs)"
    except Exception:
        return str(us)


def guess_time_unit(val):
    try:
        v = int(val)
        if v > 10_000_000:
            return "µs (微秒)"
        elif v > 10_000:
            return "ms (毫秒) ?"
        else:
            return "s (秒) ?"
    except Exception:
        return "unknown"


def load_main_json(draft_dir: Path):
    """优先读 draft_info.json，回退到 draft_content.json"""
    for fname in ["draft_info.json", "draft_content.json"]:
        p = draft_dir / fname
        if p.exists():
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                return data, fname
            except json.JSONDecodeError as e:
                print(f"[警告] {fname} JSON 解析失败: {e}")
    return None, None


def collect_material_paths(materials: dict) -> list[str]:
    paths = []
    for mkey in ["videos", "audios", "images"]:
        for item in (materials.get(mkey) or []):
            for pk in ["path", "file_Path", "media_path"]:
                v = item.get(pk)
                if v and isinstance(v, str) and v.strip() and v not in paths:
                    paths.append(v)
    return paths


def count_tracks(tracks: list, track_type: str):
    return sum(1 for t in tracks if t.get("type") == track_type)


def count_segments(tracks: list, track_type: str):
    return sum(
        len(t.get("segments") or [])
        for t in tracks
        if t.get("type") == track_type
    )


def extract_texts(materials: dict, limit=10) -> list[str]:
    texts_out = []
    for item in (materials.get("texts") or []):
        raw = item.get("content") or item.get("base_content") or ""
        text = ""
        if raw:
            try:
                obj = json.loads(raw)
                text = obj.get("text", "")
            except Exception:
                text = raw[:80]
        if not text:
            text = item.get("name", "")
        if text:
            texts_out.append(text)
        if len(texts_out) >= limit:
            break
    return texts_out


def inspect(draft_dir: Path, check_media: bool):
    sep("剪映草稿检查")
    print(f"草稿目录: {draft_dir.resolve()}")

    # ── 目录文件列表 ──────────────────────────────────────────────
    print("\n[ 目录文件列表 ]")
    for f in sorted(draft_dir.iterdir()):
        size = f.stat().st_size if f.is_file() else 0
        tag  = "DIR " if f.is_dir() else "FILE"
        kb   = f"{size/1024:.1f}KB" if f.is_file() else ""
        print(f"  {tag}  {f.name:<50}  {kb:>10}")

    # ── 主 JSON ──────────────────────────────────────────────────
    data, fname = load_main_json(draft_dir)
    if data is None:
        print("\n[错误] 未找到可解析的 draft_info.json 或 draft_content.json")
        sys.exit(2)

    sep(f"主文件: {fname}")
    print(f"[1]  存在且可解析: ✓")

    # duration
    dur = data.get("duration")
    print(f"[2]  duration      : {dur}  →  {us_to_readable(dur)}")
    if dur is not None:
        print(f"     时间单位推断  : {guess_time_unit(dur)}")

    # canvas_config
    cc = data.get("canvas_config") or {}
    print(f"[3]  canvas_config : {cc.get('width')}×{cc.get('height')}  ratio={cc.get('ratio')}")

    # fps
    fps = data.get("fps")
    print(f"[4]  fps           : {fps}")

    # version
    print(f"[5]  version       : {data.get('version')}")
    print(f"     new_version   : {data.get('new_version')}")
    print(f"     id            : {data.get('id')}")

    # platform
    plat = data.get("platform") or data.get("last_modified_platform") or {}
    print(f"[6]  platform      : app_version={plat.get('app_version')}  os={plat.get('os')}")

    # ── tracks ───────────────────────────────────────────────────
    sep("Tracks 统计")
    tracks = data.get("tracks") or []
    print(f"[7]  tracks 总数   : {len(tracks)}")
    for ttype in ["video", "audio", "text", "sticker", "effect"]:
        tc = count_tracks(tracks, ttype)
        sc = count_segments(tracks, ttype)
        if tc or ttype in ("video", "audio", "text"):
            print(f"     {ttype:<10} tracks={tc}   segments={sc}")

    # track 明细
    print("\n  Track 明细:")
    for i, t in enumerate(tracks):
        segs = t.get("segments") or []
        print(f"    [{i}] type={t.get('type')!r:<8}  segments={len(segs)}  id={t.get('id','?')[:8]}...")

    # ── materials ────────────────────────────────────────────────
    sep("Materials 统计")
    materials = data.get("materials") or {}
    for mkey in ["videos", "audios", "texts", "stickers", "effects", "transitions"]:
        items = materials.get(mkey) or []
        print(f"[8]  materials.{mkey:<12}: {len(items)}")

    # ── 字幕内容预览 ─────────────────────────────────────────────
    sep("字幕预览（前 10 条）")
    texts = extract_texts(materials, limit=10)
    if texts:
        for i, t in enumerate(texts):
            print(f"  [{i+1:2}] {t!r}")
    else:
        print("  (无字幕)")

    # ── 路径检查 ─────────────────────────────────────────────────
    all_paths = collect_material_paths(materials)
    sep("素材路径统计")
    print(f"[9]  素材路径总数 : {len(all_paths)}")

    if check_media:
        missing = [p for p in all_paths if not Path(p).exists()]
        present = len(all_paths) - len(missing)
        print(f"[10] 路径存在    : {present}")
        print(f"[11] 路径缺失    : {len(missing)}")
        if missing:
            print(f"\n  ⚠ 缺失路径前 20 条 (剪映 GUI 可能会显示 Media Not Found):")
            for p in missing[:20]:
                print(f"    ✗ {p}")
            if len(missing) > 20:
                print(f"    ... (共 {len(missing)} 条缺失)")
        else:
            print("  ✓ 所有素材路径均存在")
    else:
        print("  (使用 --check-media-paths 检查路径存在性)")
        print("\n  路径样本（前 5 条）:")
        for p in all_paths[:5]:
            print(f"    {p}")

    # ── keyframes ────────────────────────────────────────────────
    sep("Keyframes")
    kf = data.get("keyframes") or {}
    total_kf = sum(len(v) for v in kf.values() if isinstance(v, list))
    kfgl = data.get("keyframe_graph_list") or []
    print(f"  keyframes 子数组总 item 数: {total_kf}")
    print(f"  keyframe_graph_list 数量 : {len(kfgl)}")
    for k, v in kf.items():
        if isinstance(v, list) and v:
            print(f"    keyframes.{k}: {len(v)} items")

    sep("检查完成")


def main():
    parser = argparse.ArgumentParser(
        description="分析剪映草稿目录结构（支持 draft_info.json 和 draft_content.json）"
    )
    parser.add_argument("draft_dir", help="草稿目录路径")
    parser.add_argument(
        "--check-media-paths", action="store_true",
        help="检查所有素材路径是否存在于文件系统"
    )
    args = parser.parse_args()

    dp = Path(args.draft_dir)
    if not dp.exists():
        print(f"[错误] 路径不存在: {dp}")
        sys.exit(1)
    if not dp.is_dir():
        print(f"[错误] 路径不是目录: {dp}")
        sys.exit(1)

    inspect(dp, args.check_media_paths)


if __name__ == "__main__":
    main()
