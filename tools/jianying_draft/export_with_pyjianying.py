#!/usr/bin/env python3
"""
export_with_pyjianying.py - 使用 pyJianYingDraft 将视频/字幕导出为剪映草稿

用法:
  python export_with_pyjianying.py --video <mp4_path> [--srt <srt_path>] [--name <draft_name>] [--drafts-dir <dir>] [--expected-subs N]

原子生成：先在临时草稿目录构建并校验，全部成功后再改名为正式草稿；
任意一步失败立即删除临时目录并以非零退出码返回，绝不在剪映里留下损坏草稿。
"""

import argparse
import datetime
import json
import os
import random
import re
import shutil
import sys
import time

# ─── 参数解析 ────────────────────────────────────────────

parser = argparse.ArgumentParser(description="使用 pyJianYingDraft 导出剪映草稿")
parser.add_argument("--video", required=True, help="输入 MP4 视频路径（必填）")
parser.add_argument("--srt", help="输入 SRT 字幕路径（可选）")
parser.add_argument("--name", help="草稿名称（可选，默认自动生成）")
parser.add_argument("--expected-subs", type=int, default=-1,
                    help="期望写入的字幕条数（>=0 时强制校验，写入数不足即失败）")
parser.add_argument("--subtitle-mode", choices=["subtitle", "text"], default="subtitle",
                    help="字幕材料模式：subtitle=剪映字幕体系；text=普通文本片段 fallback")
parser.add_argument(
    "--drafts-dir",
    default="C:/Users/Admin/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/",
    help="剪映草稿目录（默认剪映默认目录）"
)
args = parser.parse_args()

video_path = os.path.abspath(args.video)
srt_path = os.path.abspath(args.srt) if args.srt else None
expected_subs = args.expected_subs

# 生成正式草稿名
if args.name:
    final_name = args.name
else:
    now = datetime.datetime.now()
    final_name = f"MIXCUT_EXPORT_{now.strftime('%Y%m%d_%H%M%S')}"

drafts_dir = os.path.abspath(args.drafts_dir)

# ─── 依赖检查 ────────────────────────────────────────────

try:
    from pyJianYingDraft import (
        DraftFolder, VideoMaterial, VideoSegment,
        TextSegment, TrackType, Timerange
    )
except ImportError as e:
    print(f"[错误] 缺少 pyJianYingDraft: {e}")
    print("请先安装: pip install pyJianYingDraft")
    sys.exit(1)

# ─── 前置校验：输入文件必须存在 ───────────────────────────

if not os.path.exists(video_path):
    print(f"[错误] 视频文件不存在: {video_path}")
    sys.exit(1)
if srt_path and not os.path.exists(srt_path):
    print(f"[错误] SRT 文件不存在: {srt_path}")
    sys.exit(1)

# ─── SRT 解析 ────────────────────────────────────────────

def parse_srt(p):
    """解析 SRT 文件，返回 [(start_us, end_us, text), ...]"""
    cues = []
    with open(p, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    blocks = re.split(r'\n\s*\n', content.strip())
    for block in blocks:
        lines = block.strip().split('\n')
        if len(lines) < 3:
            continue
        try:
            time_line = lines[1]
            text = '\n'.join(lines[2:])
        except IndexError:
            continue
        m = re.match(
            r'(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})',
            time_line
        )
        if not m:
            continue
        h, mi, s, ms, h2, mi2, s2, ms2 = m.groups()
        start_us = (int(h)*3600 + int(mi)*60 + int(s)) * 1000000 + int(ms) * 1000
        end_us   = (int(h2)*3600 + int(mi2)*60 + int(s2)) * 1000000 + int(ms2) * 1000
        cues.append((start_us, end_us, text.strip()))
    return cues


def _subtitle_content_from_text_material(material):
    """Reuse pyJianYingDraft text content but normalize it to Jianying subtitle content."""
    raw = material.get("content") or "{}"
    try:
        content = json.loads(raw)
    except Exception:
        content = {"text": material.get("name") or raw}
    text = content.get("text") or material.get("name") or ""
    styles = content.get("styles") if isinstance(content.get("styles"), list) else []
    if not styles:
        styles = [{
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
            "strokes": [{
                "content": {"solid": {"alpha": 0.0, "color": [0.0, 0.0, 0.0]}},
                "width": 0.0,
            }],
        }]
    for style in styles:
        if isinstance(style, dict):
            style["range"] = [0, len(text)]
            style.setdefault("size", 12.0)
            style.setdefault("bold", False)
            style.setdefault("italic", False)
            style.setdefault("underline", False)
            style.setdefault("strokes", [])
    return json.dumps({"styles": styles, "text": text}, ensure_ascii=False, separators=(",", ":"))


def _as_subtitle_material(material):
    """Convert a pyJianYingDraft text material into Jianying's subtitle material shape."""
    subtitle = dict(material)
    subtitle.pop("global_alpha", None)
    subtitle.update({
        "content": _subtitle_content_from_text_material(material),
        "typesetting": material.get("typesetting", 0),
        "alignment": material.get("alignment", 1),
        "letter_spacing": material.get("letter_spacing", 0.0),
        "line_spacing": material.get("line_spacing", 0.02),
        "line_feed": material.get("line_feed", 1),
        "line_max_width": material.get("line_max_width", 1.0),
        "force_apply_line_max_width": material.get("force_apply_line_max_width", False),
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
    })
    return subtitle


def upgrade_text_materials_to_subtitles(draft_content, expected_count):
    """Upgrade generated SRT text materials to Jianying subtitle materials."""
    if expected_count <= 0:
        return 0
    text_materials = draft_content.get("materials", {}).get("texts") or []
    if len(text_materials) < expected_count:
        raise ValueError(f"字幕材料不足：materials.texts={len(text_materials)}，期望 {expected_count}")
    upgraded = []
    for index, material in enumerate(text_materials):
        if index < expected_count:
            upgraded.append(_as_subtitle_material(material))
        else:
            upgraded.append(material)
    draft_content["materials"]["texts"] = upgraded
    return expected_count

# ─── 受保护草稿（禁止覆盖正式名）─────────────────────────

PROTECTED_DRAFTS = ["PYJIANYING_TEST_1V1T", "MIXCUT_EMPTY_TEMPLATE"]
if final_name in PROTECTED_DRAFTS or "storybound" in final_name.lower():
    print(f"[错误] 禁止使用受保护草稿名: {final_name}")
    sys.exit(1)

final_dir = os.path.join(drafts_dir, final_name)

# ─── 临时草稿名（原子生成的关键）──────────────────────────

ts_tag = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
temp_name = f"MIXCUT_TMP_{ts_tag}_{random.randint(1000, 9999)}"
temp_dir = os.path.join(drafts_dir, temp_name)


def cleanup_temp():
    """删除临时草稿目录，确保失败时不在剪映里留下半成品。"""
    if os.path.isdir(temp_dir):
        try:
            shutil.rmtree(temp_dir)
            print(f"[清理] 已删除临时草稿目录: {temp_name}")
        except Exception as ce:
            print(f"[清理] 删除临时草稿目录失败（请手动删除 {temp_dir}）: {ce}")


def fail(msg):
    """打印错误、清理临时目录、以非零退出码返回。"""
    print(f"[错误] {msg}")
    cleanup_temp()
    sys.exit(1)


# ═══ 在临时目录中原子构建草稿 ═══════════════════════════════
try:
    print(f"[1/6] 创建临时草稿目录: {temp_name}")
    df = DraftFolder(drafts_dir)
    sf = df.create_draft(temp_name, width=1920, height=1080, fps=30, allow_replace=True)
    print(f"  临时目录 + draft_meta_info.json 已创建")

    # ── 视频轨 ──────────────────────────────────────────
    print(f"[2/6] 添加视频轨...")
    sf.add_track(TrackType.video, "video")
    video_mat = VideoMaterial(path=video_path, material_name=os.path.basename(video_path))
    sf.add_material(video_mat)
    video_dur = video_mat.duration
    print(f"  视频素材: {video_path}")
    print(f"  时长: {video_dur} us ({video_dur/1000000:.3f}s)")
    print(f"  分辨率: {video_mat.width}x{video_mat.height}")
    if not video_dur or video_dur <= 0:
        fail(f"视频时长异常（video_dur={video_dur}），无法生成草稿。请检查 clean mp4 是否损坏。")
    video_seg = VideoSegment(material=video_mat,
                             target_timerange=Timerange(start=0, duration=video_dur))
    sf.add_segment(video_seg, track_name="video")
    print(f"  视频片段已添加（时长 {video_dur/1000000:.3f}s）")

    # ── 字幕轨 ──────────────────────────────────────────
    written = 0
    expected_valid = 0
    if srt_path and os.path.exists(srt_path):
        print(f"[3/6] 添加字幕轨 from: {srt_path}")
        sf.add_track(TrackType.text, "subtitle")
        cues = parse_srt(srt_path)
        valid_cues = [c for c in cues if c[2].strip()]
        expected_valid = len(valid_cues)
        print(f"[剪映字幕] SRT 解析到 {len(cues)} 条（有效 {expected_valid} 条），视频时长 {video_dur/1000000:.3f}s")
        if cues:
            lsN, leN, ltN = cues[-1]
            print(f"[剪映字幕] SRT 末条（clamp前）: {lsN/1000000:.3f}s~{leN/1000000:.3f}s: {ltN[:60]}")

        MIN_DUR_US = 300000  # 最短 0.3s
        skipped = 0
        last_written = None
        for i, (start_us, end_us, text) in enumerate(cues):
            if not text.strip():
                skipped += 1
                continue
            orig_start, orig_end = start_us, end_us
            if start_us >= video_dur:
                start_us = max(0, video_dur - MIN_DUR_US)
            if end_us > video_dur:
                end_us = video_dur
            if end_us - start_us < MIN_DUR_US:
                end_us = min(video_dur, start_us + MIN_DUR_US)
            if end_us <= start_us:
                # 钳制后仍然无效（视频极短）：放在 0~MIN，保证最后一条仍被写入
                start_us, end_us = 0, min(video_dur, MIN_DUR_US)
            if orig_start != start_us or orig_end != end_us:
                print(f"[剪映字幕] 字幕 [{i+1}] 已钳制: "
                      f"{orig_start/1000000:.3f}~{orig_end/1000000:.3f}s → "
                      f"{start_us/1000000:.3f}~{end_us/1000000:.3f}s")
            text_seg = TextSegment(text=text,
                                   timerange=Timerange(start=start_us, duration=end_us - start_us))
            sf.add_segment(text_seg, track_name="subtitle")
            written += 1
            last_written = (start_us, end_us, text)
        print(f"[剪映字幕] 写入完成：{written}/{expected_valid} 条有效（跳过空文本 {skipped} 条）")
        if last_written:
            lws, lwe, lwt = last_written
            print(f"[剪映字幕] 最后写入字幕: {lws/1000000:.3f}s~{lwe/1000000:.3f}s: {lwt[:80]}")

        # ── 字幕完整性闸门：写入数必须等于有效条数 ──
        if written != expected_valid:
            fail(f"字幕写入不完整：写入 {written} 条 ≠ 有效 {expected_valid} 条，判定导出失败。")
        # ── 与前端期望条数交叉校验 ──
        if expected_subs >= 0 and expected_valid != expected_subs:
            fail(f"字幕条数与前端期望不符：SRT 有效 {expected_valid} 条 ≠ 期望 {expected_subs} 条。")
    else:
        print(f"[3/6] 无 SRT 字幕，仅生成视频轨")
        if expected_subs > 0:
            fail(f"前端期望 {expected_subs} 条字幕，但未收到 SRT，判定导出失败。")

    # ── 保存 draft_content.json ─────────────────────────
    print(f"[4/6] 保存 draft_content.json...")
    sf.save()
    content_path = os.path.join(temp_dir, 'draft_content.json')
    if not os.path.exists(content_path):
        fail("draft_content.json 未生成。")
    with open(content_path, 'r', encoding='utf-8') as f:
        draft_content = json.load(f)

    subtitle_material_count = 0
    if args.subtitle_mode == "subtitle" and written > 0:
        try:
            subtitle_material_count = upgrade_text_materials_to_subtitles(draft_content, written)
        except Exception as ex:
            fail(f"字幕材料升级为剪映 subtitle 失败：{ex}")
        with open(content_path, 'w', encoding='utf-8') as f:
            json.dump(draft_content, f, ensure_ascii=False, indent=2)
        print(f"[剪映字幕] 已升级为 subtitle material：{subtitle_material_count}/{written} 条")
    elif written > 0:
        print(f"[剪映字幕] 使用普通 text material fallback：{written} 条")

    timeline_id = draft_content.get('id', '')
    draft_duration = draft_content.get('duration', 0)

    # ── 校验轨道完整性 ──────────────────────────────────
    video_tracks = [t for t in draft_content.get('tracks', []) if t.get('type') == 'video']
    text_tracks = [t for t in draft_content.get('tracks', []) if t.get('type') == 'text']
    if not video_tracks:
        fail("draft_content.json 缺少视频轨。")
    if written > 0 and not text_tracks:
        fail(f"应写入 {written} 条字幕但 draft_content.json 缺少字幕轨。")
    if args.subtitle_mode == "subtitle" and written > 0:
        subtitle_materials = [
            t for t in draft_content.get('materials', {}).get('texts', [])
            if t.get('type') == 'subtitle'
        ]
        if len(subtitle_materials) != written:
            fail(f"subtitle material 数量异常：{len(subtitle_materials)} ≠ 写入字幕 {written}。")

    # ── 写 meta / layout / settings（用最终路径，便于 rename 后直接正确）──
    print(f"[5/6] 写入 meta / layout / settings（指向正式名 {final_name}）...")
    now_s = int(time.time())
    now_ms = now_s * 1000
    meta_path = os.path.join(temp_dir, 'draft_meta_info.json')
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)
    meta['draft_name'] = final_name
    meta['draft_id'] = timeline_id or meta.get('draft_id', '')
    meta['draft_fold_path'] = final_dir
    meta['draft_root_path'] = drafts_dir
    meta['tm_duration'] = draft_duration
    meta['tm_draft_create'] = now_ms
    meta['tm_draft_modified'] = now_ms
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    layout = {
        "activeTimeline": timeline_id,
        "dockItems": [{
            "dockIndex": 0, "ratio": 1,
            "timelineIds": [timeline_id], "timelineNames": ["时间线01"]
        }],
        "layoutOrientation": 1
    }
    with open(os.path.join(temp_dir, 'timeline_layout.json'), 'w', encoding='utf-8') as f:
        json.dump(layout, f, ensure_ascii=False, indent=2)

    settings_content = (
        "[General]\n"
        "cloud_last_modify_platform=windows\n"
        f"draft_create_time={now_s}\n"
        f"draft_last_edit_time={now_s}\n"
        "real_edit_seconds=0\n"
        "real_edit_keys=0\n"
    )
    with open(os.path.join(temp_dir, 'draft_settings'), 'w', encoding='utf-8') as f:
        f.write(settings_content)

    # ── 原子提交：临时目录 → 正式名 ─────────────────────
    print(f"[6/6] 校验通过，提交为正式草稿: {final_name}")
    if os.path.isdir(final_dir):
        # 仅在临时目录已校验通过后才删除旧的同名正式草稿
        print(f"  覆盖同名旧草稿: {final_name}")
        shutil.rmtree(final_dir)
    os.rename(temp_dir, final_dir)

except SystemExit:
    raise
except Exception as e:
    import traceback
    traceback.print_exc()
    fail(f"生成草稿过程中出现异常: {e}")

# ═══ 提交后验证（此时已是正式目录，不再有失败清理）═══════════
content_path = os.path.join(final_dir, 'draft_content.json')
with open(content_path, 'r', encoding='utf-8') as f:
    content = json.load(f)

print(f"\n草稿验证（正式目录）:")
print(f"  目录: {final_dir}")
print(f"  时长: {content.get('duration')} us ({content.get('duration', 0)/1000000:.3f}s)")
print(f"  视频轨: {len([t for t in content.get('tracks', []) if t.get('type') == 'video'])}")
print(f"  字幕轨: {len([t for t in content.get('tracks', []) if t.get('type') == 'text'])}")
print(f"  字幕素材: {len(content.get('materials', {}).get('texts', []))}")
print(f"  subtitle 素材: {len([t for t in content.get('materials', {}).get('texts', []) if t.get('type') == 'subtitle'])}")
print(f"  写入字幕条数: {written}")
print(f"\n完成: {final_dir}")
