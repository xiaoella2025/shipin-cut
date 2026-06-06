#!/usr/bin/env python3
"""
inspect_draft.py — 分析剪映草稿目录结构

用法:
    python inspect_draft.py <草稿目录路径>

输出:
    - 草稿版本字段
    - tracks 结构摘要
    - materials 结构摘要
    - 时间单位推断
    - 资源路径规则
"""

import sys
import json
import os
from pathlib import Path


def fmt_us(us):
    """微秒 → 可读时间"""
    try:
        s = int(us) / 1_000_000
        return f"{s:.3f}s ({int(us)} µs)"
    except Exception:
        return str(us)


def fmt_ms(ms):
    """毫秒 → 可读时间"""
    try:
        s = int(ms) / 1000
        return f"{s:.3f}s ({int(ms)} ms)"
    except Exception:
        return str(ms)


def guess_time_unit(val):
    """猜测时间单位：根据数值范围判断是微秒还是毫秒"""
    if val is None:
        return "unknown"
    try:
        v = int(val)
        if v > 1_000_000_000:
            return "microseconds (µs) — 值很大，>1e9，推测微秒"
        elif v > 1_000_000:
            return "microseconds (µs) — 值 >1e6，推测微秒"
        elif v > 1_000:
            return "milliseconds (ms) — 值 >1e3，推测毫秒"
        elif v > 0:
            return "seconds (s) — 值很小，推测秒"
        else:
            return f"unknown (value={v})"
    except Exception:
        return "unknown"


def sep(title=""):
    print("\n" + "=" * 60)
    if title:
        print(f"  {title}")
        print("=" * 60)


def analyze_draft(draft_dir: Path):
    sep("剪映草稿分析")
    print(f"草稿目录: {draft_dir}")

    # 列出目录内容
    print("\n[ 目录文件列表 ]")
    files = sorted(draft_dir.iterdir())
    for f in files:
        size = f.stat().st_size if f.is_file() else 0
        ftype = "DIR" if f.is_dir() else "FILE"
        print(f"  {ftype}  {f.name:<50}  {size:>10} bytes")

    # ── draft_meta_info.json ──────────────────────────────────────
    meta_path = draft_dir / "draft_meta_info.json"
    if meta_path.exists():
        sep("draft_meta_info.json")
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        print(json.dumps(meta, ensure_ascii=False, indent=2))
    else:
        print("\n[警告] draft_meta_info.json 不存在")

    # ── draft_content.json ────────────────────────────────────────
    content_path = draft_dir / "draft_content.json"
    if not content_path.exists():
        print("\n[错误] draft_content.json 不存在，无法继续分析")
        return

    sep("draft_content.json — 顶层字段")
    content = json.loads(content_path.read_text(encoding="utf-8"))

    # 顶层 key 列表
    print("顶层 keys:", list(content.keys()))

    # 版本字段
    print(f"\nversion        : {content.get('version')}")
    print(f"id             : {content.get('id')}")
    print(f"duration       : {content.get('duration')}  → {guess_time_unit(content.get('duration'))}")
    print(f"color_space    : {content.get('color_space')}")
    print(f"source         : {content.get('source')}")

    # platform
    platform = content.get("platform") or content.get("last_modified_platform") or {}
    print(f"\nplatform:")
    print(f"  app_id       : {platform.get('app_id')}")
    print(f"  app_version  : {platform.get('app_version')}")
    print(f"  os           : {platform.get('os')}")

    # canvas_config
    canvas = content.get("canvas_config") or {}
    print(f"\ncanvas_config:")
    print(f"  width        : {canvas.get('width')}")
    print(f"  height       : {canvas.get('height')}")
    print(f"  ratio        : {canvas.get('ratio')}")

    # ── tracks ───────────────────────────────────────────────────
    sep("tracks 结构")
    tracks = content.get("tracks") or []
    print(f"track 数量: {len(tracks)}")

    time_samples = []

    for i, track in enumerate(tracks):
        ttype = track.get("type", "?")
        tname = track.get("name", "")
        segs  = track.get("segments") or []
        print(f"\n  [Track {i}] type={ttype!r}  name={tname!r}  segments={len(segs)}")
        for j, seg in enumerate(segs):
            src  = seg.get("source_timerange") or {}
            tgt  = seg.get("target_timerange") or {}
            spd  = seg.get("speed", 1.0)
            mat  = seg.get("material_id", "?")
            vis  = seg.get("visible", True)
            print(f"    [Seg {j}] material_id={mat}")
            print(f"            source_timerange : start={src.get('start')} dur={src.get('duration')}")
            print(f"            target_timerange : start={tgt.get('start')} dur={tgt.get('duration')}")
            print(f"            speed={spd}  visible={vis}")
            for v in [src.get("duration"), tgt.get("duration")]:
                if v is not None:
                    time_samples.append(v)
            clip = seg.get("clip") or {}
            if clip:
                print(f"            clip: scale={clip.get('scale')}  rot={clip.get('rotation')}  trans={clip.get('translation')}")
            extra = seg.get("extra_material_refs") or []
            if extra:
                print(f"            extra_material_refs: {extra}")

    # 时间单位推断
    sep("时间单位推断")
    if time_samples:
        sample = time_samples[0]
        unit = guess_time_unit(sample)
        print(f"采样时长值: {time_samples[:5]}")
        print(f"推断: {unit}")

        if int(sample) > 1_000_000:
            print("结论: 时间单位是 微秒 (µs)，1秒 = 1,000,000")
            print(f"  → 换算: {fmt_us(sample)}")
        elif int(sample) > 1_000:
            print("结论: 时间单位是 毫秒 (ms)，1秒 = 1,000")
            print(f"  → 换算: {fmt_ms(sample)}")
    else:
        print("未找到时间样本，无法推断")

    # ── materials ────────────────────────────────────────────────
    sep("materials 结构")
    materials = content.get("materials") or {}
    print(f"materials keys: {list(materials.keys())}")

    for mkey in ["videos", "audios", "texts", "stickers", "effects", "transitions", "beats"]:
        items = materials.get(mkey) or []
        if not items:
            continue
        print(f"\n  [{mkey}] 数量={len(items)}")
        for k, item in enumerate(items):
            print(f"\n    [{mkey}][{k}] id={item.get('id')}")
            # 视频/音频资源路径
            for path_key in ["path", "file_Path", "media_path", "local_material_id"]:
                val = item.get(path_key)
                if val:
                    print(f"      {path_key}: {val!r}")
                    _analyze_path(val)
            # 时长
            dur = item.get("duration")
            if dur is not None:
                print(f"      duration: {dur}  → {guess_time_unit(dur)}")
            # 尺寸
            for dim in ["width", "height"]:
                if item.get(dim):
                    print(f"      {dim}: {item[dim]}")
            # 文字内容
            if mkey == "texts":
                _print_text_material(item)
            # 打印全部字段（折叠大值）
            print(f"      全部 keys: {list(item.keys())}")

    # ── 资源路径规则 ─────────────────────────────────────────────
    sep("资源路径规则总结")
    all_paths = _collect_paths(materials)
    if all_paths:
        abs_count = sum(1 for p in all_paths if os.path.isabs(p))
        rel_count = len(all_paths) - abs_count
        print(f"发现路径数: {len(all_paths)}")
        print(f"  绝对路径: {abs_count}")
        print(f"  相对路径: {rel_count}")
        print("\n路径样本:")
        for p in all_paths[:8]:
            print(f"  {p!r}")
        # 检查路径是否存在
        print("\n路径存在性检查:")
        for p in all_paths[:4]:
            exists = Path(p).exists()
            print(f"  {'✓' if exists else '✗'} {p!r}")
    else:
        print("未找到资源路径")

    sep("分析完成")


def _analyze_path(p):
    if not p:
        return
    pp = Path(p)
    print(f"        → 是绝对路径: {pp.is_absolute()}")
    print(f"        → 文件存在: {pp.exists()}")
    print(f"        → 扩展名: {pp.suffix}")


def _print_text_material(item):
    content_raw = item.get("content") or item.get("base_content") or ""
    if not content_raw:
        return
    print(f"      content (raw): {content_raw[:200]}")
    try:
        c = json.loads(content_raw)
        text = c.get("text", "")
        print(f"      → text: {text!r}")
    except Exception:
        pass
    print(f"      text_size: {item.get('text_size')}")
    print(f"      text_color: {item.get('text_color')}")
    print(f"      alignment: {item.get('alignment')}")
    print(f"      font_name: {item.get('font_name')}")


def _collect_paths(materials):
    paths = []
    for mkey in ["videos", "audios"]:
        for item in (materials.get(mkey) or []):
            for pk in ["path", "file_Path", "media_path"]:
                v = item.get(pk)
                if v and isinstance(v, str) and v.strip():
                    paths.append(v)
    return paths


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python inspect_draft.py <草稿目录路径>")
        print("示例: python inspect_draft.py 'C:/Users/xxx/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/test-project'")
        sys.exit(1)

    draft_path = Path(sys.argv[1])
    if not draft_path.exists():
        print(f"[错误] 路径不存在: {draft_path}")
        sys.exit(1)
    if not draft_path.is_dir():
        print(f"[错误] 路径不是目录: {draft_path}")
        sys.exit(1)

    analyze_draft(draft_path)
