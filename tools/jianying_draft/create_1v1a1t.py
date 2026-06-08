#!/usr/bin/env python3
"""
create_1v1a1t.py — 基于 Storybound 模板生成最小剪映草稿（1视频 + 1音频 + 1字幕）

策略：
  1. 完整复制 Storybound 模板草稿目录（保留 opaque 文件，让剪映能打开）
  2. 把视频/音频复制到 output/assets/video/ 和 output/assets/audio/
  3. 用最小 1V/1A/1T 结构重建 output/draft_info.json
  4. draft id 保持模板原值（必须与 Timelines/<id>/ 文件夹名一致）

与 create_draft_info_test.py 的区别：
  - 只接受 1 个视频、1 个音频、1 条字幕（更简单）
  - 不依赖 ffprobe（用 --duration 手动指定时长，单位微秒）
  - 不处理 materials.speeds 和 extra_material_refs（简化版）

用法示例（Windows PowerShell）：
  python tools/jianying_draft/create_1v1a1t.py `
    --template "D:\\JianyingPro Drafts\\我的Storybound草稿" `
    --output   "D:\\JianyingPro Drafts\\TEST_1V1A1T" `
    --video    "D:\\clips\\video.mp4" `
    --audio    "D:\\clips\\audio.mp3" `
    --subtitle "这是第一条字幕" `
    --duration 5000000

注意：
  video/audio 文件必须真实存在，否则脚本报错退出
  云端无法验证剪映 GUI，需用户本地打开剪映确认
"""

import argparse
import copy
import json
import shutil
import sys
import uuid
from pathlib import Path


# ────────────────────────────────────────────────
# ID 生成
# ────────────────────────────────────────────────

def hex32() -> str:
    """32位小写十六进制，用于 track / segment / material ID"""
    return uuid.uuid4().hex


# ────────────────────────────────────────────────
# content 字段（字幕内嵌 JSON）
# ────────────────────────────────────────────────

def make_subtitle_content(text: str) -> str:
    obj = {
        "styles": [{
            "fill": {
                "alpha": 1.0,
                "content": {
                    "render_type": "solid",
                    "solid": {"alpha": 1.0, "color": [1.0, 1.0, 1.0]}
                }
            },
            "range": [0, len(text)],
            "size": 12.0,
            "bold": False,
            "italic": False,
            "underline": False,
            "strokes": [{
                "content": {"solid": {"alpha": 0.0, "color": [0.0, 0.0, 0.0]}},
                "width": 0.0
            }]
        }],
        "text": text
    }
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


# ────────────────────────────────────────────────
# 核心重建
# ────────────────────────────────────────────────

def build_draft_info(
    template_data: dict,
    video_abs_path: str,
    video_duration_us: int,
    video_w: int,
    video_h: int,
    audio_abs_path: str,
    audio_duration_us: int,
    subtitle_text: str,
    total_duration_us: int,
) -> dict:
    """
    保留 template_data 的元信息（canvas_config / fps / version / id 等），
    完全重建 tracks / materials / keyframes。

    draft id 保持不变，必须与 Timelines/<id>/ 文件夹名一致。
    """
    new = copy.deepcopy(template_data)

    vid_mat_id  = hex32()
    aud_mat_id  = hex32()
    txt_mat_id  = hex32()
    vid_seg_id  = hex32()
    aud_seg_id  = hex32()
    txt_seg_id  = hex32()
    vid_trk_id  = hex32()
    aud_trk_id  = hex32()
    txt_trk_id  = hex32()

    # ── materials.videos ─────────────────────────────────────────
    vid_mat = {
        "audio_fade": None,
        "category_id": "",
        "category_name": "local",
        "check_flag": 63487,
        "crop": {
            "lower_left_x": 0.0, "lower_left_y": 1.0,
            "lower_right_x": 1.0, "lower_right_y": 1.0,
            "upper_left_x": 0.0, "upper_left_y": 0.0,
            "upper_right_x": 1.0, "upper_right_y": 0.0,
        },
        "crop_ratio": "free",
        "crop_scale": 1.0,
        "duration": video_duration_us,
        "height": video_h,
        "id": vid_mat_id,
        "local_material_id": vid_mat_id,
        "material_id": vid_mat_id,
        "material_name": Path(video_abs_path).name,
        "media_path": "",
        "path": video_abs_path,
        "remote_url": None,
        "type": "video",
        "width": video_w,
    }

    # ── materials.audios ─────────────────────────────────────────
    aud_mat = {
        "app_id": 0,
        "category_id": "",
        "category_name": "local",
        "check_flag": 1,
        "copyright_limit_type": "none",
        "duration": audio_duration_us,
        "effect_id": "",
        "formula_id": "",
        "id": aud_mat_id,
        "intensifies_path": "",
        "is_ai_clone_tone": False,
        "is_text_edit_overdub": False,
        "is_ugc": False,
        "local_material_id": aud_mat_id,
        "music_id": aud_mat_id,
        "name": Path(audio_abs_path).stem,
        "path": audio_abs_path,
        "query": "",
        "remote_url": None,
        "request_id": "",
        "resource_id": "",
        "search_id": "",
        "source_from": "",
        "source_platform": 0,
        "team_id": "",
        "text_id": "",
        "tone_category_id": "", "tone_category_name": "",
        "tone_effect_id": "", "tone_effect_name": "",
        "tone_platform": "",
        "tone_second_category_id": "", "tone_second_category_name": "",
        "tone_speaker": "", "tone_type": "",
        "type": "extract_music",
        "video_id": "",
        "wave_points": [],
    }

    # ── materials.texts ──────────────────────────────────────────
    txt_mat = {
        "id": txt_mat_id,
        "type": "subtitle",
        "content": make_subtitle_content(subtitle_text),
        "alignment": 1,
        "background_alpha": 0.5,
        "background_color": "#000000",
        "background_height": 0.14,
        "background_horizontal_offset": 0.0,
        "background_round_radius": 0.3,
        "background_style": 0,
        "background_vertical_offset": 0.0,
        "background_width": 0.14,
        "caption_template_info": {
            "category_id": "", "category_name": "", "effect_id": "",
            "is_new": False, "path": "", "request_id": "",
            "resource_id": "", "resource_name": "", "source_platform": 0,
        },
        "check_flag": 31,
        "combo_info": {"text_templates": []},
        "fixed_height": -1,
        "fixed_width": -1,
        "font_category_id": "", "font_category_name": "",
        "font_id": "", "font_name": "", "font_path": "",
        "font_resource_id": "",
        "font_size": 15.0,
        "font_source_platform": 0,
        "font_team_id": "",
        "font_title": "none",
        "font_url": "",
        "fonts": [],
        "force_apply_line_max_width": False,
        "is_rich_text": True,
        "letter_spacing": 0.0,
        "line_feed": 1,
        "line_max_width": 1.0,
        "line_spacing": 0.02,
        "recognize_type": 0,
        "sub_type": 0,
        "subtitle_keywords": None,
        "typesetting": 0,
        "words": {"end_time": [], "start_time": [], "text": []},
    }

    # ── segments ─────────────────────────────────────────────────
    _base = {
        "enable_adjust": True, "enable_color_correct_adjust": False,
        "enable_color_curves": True, "enable_color_match_adjust": False,
        "enable_color_wheels": True, "enable_lut": True,
        "enable_smart_color_adjust": False,
        "last_nonzero_volume": 1.0,
        "reverse": False,
        "track_attribute": 0, "track_render_index": 0, "visible": True,
        "common_keyframes": [],
        "keyframe_refs": [],
        "extra_material_refs": [],
    }

    vid_seg = {
        **_base,
        "id": vid_seg_id,
        "material_id": vid_mat_id,
        "source_timerange": {"start": 0, "duration": video_duration_us},
        "target_timerange": {"start": 0, "duration": total_duration_us},
        "speed": None,
        "volume": 1.0,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": 0.0},
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "hdr_settings": {"intensity": 1.0, "mode": 1, "nits": 1000},
        "render_index": 0,
    }

    aud_seg = {
        **_base,
        "id": aud_seg_id,
        "material_id": aud_mat_id,
        "source_timerange": {"start": 0, "duration": audio_duration_us},
        "target_timerange": {"start": 0, "duration": audio_duration_us},
        "speed": 1.0,
        "volume": 1.0,
        "clip": None,
        "hdr_settings": None,
        "render_index": 0,
    }

    txt_seg = {
        **_base,
        "id": txt_seg_id,
        "material_id": txt_mat_id,
        "source_timerange": None,
        "target_timerange": {"start": 0, "duration": total_duration_us},
        "speed": 1.0,
        "volume": 1.0,
        "clip": {
            "alpha": 1.0,
            "flip": {"horizontal": False, "vertical": False},
            "rotation": 0.0,
            "scale": {"x": 1.0, "y": 1.0},
            "transform": {"x": 0.0, "y": -0.215},
        },
        "uniform_scale": {"on": True, "value": 1.0},
        "render_index": 15000,
    }

    # ── tracks ───────────────────────────────────────────────────
    new["tracks"] = [
        {"attribute": 0, "flag": 0, "id": vid_trk_id,
         "is_default_name": True, "name": "", "type": "video",
         "segments": [vid_seg]},
        {"attribute": 0, "flag": 0, "id": aud_trk_id,
         "is_default_name": True, "name": "", "type": "audio",
         "segments": [aud_seg]},
        {"attribute": 0, "flag": 0, "id": txt_trk_id,
         "is_default_name": True, "name": "", "type": "text",
         "segments": [txt_seg]},
    ]

    # ── materials ────────────────────────────────────────────────
    orig_mats = template_data.get("materials") or {}
    new_mats: dict = {}
    for k, v in orig_mats.items():
        if k in ("videos", "audios", "texts", "speeds"):
            new_mats[k] = []     # 这几个全重建
        elif isinstance(v, list):
            new_mats[k] = []     # stickers / effects / material_animations 等全清空
        else:
            new_mats[k] = v
    new_mats["videos"] = [vid_mat]
    new_mats["audios"] = [aud_mat]
    new_mats["texts"]  = [txt_mat]
    new_mats["speeds"] = []      # 简化版：不生成 speed materials

    new["materials"] = new_mats

    # ── keyframes 全清空 ──────────────────────────────────────────
    orig_kf = template_data.get("keyframes") or {}
    new["keyframes"] = {
        k: [] for k in (orig_kf.keys() or
                        ["adjusts", "audios", "effects", "filters",
                         "handwrites", "stickers", "texts", "videos"])
    }
    new["keyframe_graph_list"] = []

    # ── 顶层：duration（id 保持原值）────────────────────────────
    new["duration"] = total_duration_us

    return new


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="生成最小剪映草稿（1视频 + 1音频 + 1字幕）"
    )
    parser.add_argument("--template",  required=True, help="Storybound 模板草稿目录")
    parser.add_argument("--output",    required=True, help="输出草稿目录（不能已存在）")
    parser.add_argument("--video",     required=True, help="视频文件绝对路径（.mp4）")
    parser.add_argument("--audio",     required=True, help="音频文件绝对路径（.mp3/.wav）")
    parser.add_argument("--subtitle",  default="CLEAN 字幕 1", help="字幕文本（默认：CLEAN 字幕 1）")
    parser.add_argument("--duration",  type=int, default=5_000_000,
                        help="草稿总时长（微秒，默认 5000000 = 5秒）")
    parser.add_argument("--video-duration", type=int, default=None,
                        help="视频素材时长（微秒，默认与 --duration 相同）")
    parser.add_argument("--audio-duration", type=int, default=None,
                        help="音频素材时长（微秒，默认与 --duration 相同）")
    parser.add_argument("--video-width",  type=int, default=1080)
    parser.add_argument("--video-height", type=int, default=1920)
    args = parser.parse_args()

    template_dir = Path(args.template).resolve()
    output_dir   = Path(args.output).resolve()
    video_path   = Path(args.video).resolve()
    audio_path   = Path(args.audio).resolve()

    total_us     = args.duration
    video_us     = args.video_duration or total_us
    audio_us     = args.audio_duration or total_us

    # ── 参数验证 ─────────────────────────────────────────────────
    if not template_dir.exists():
        print(f"[错误] 模板目录不存在: {template_dir}")
        sys.exit(1)
    if not (template_dir / "draft_info.json").exists():
        print(f"[错误] 模板目录没有 draft_info.json: {template_dir}")
        sys.exit(1)
    if not video_path.exists():
        print(f"[错误] 视频文件不存在: {video_path}")
        sys.exit(1)
    if not audio_path.exists():
        print(f"[错误] 音频文件不存在: {audio_path}")
        sys.exit(1)
    if output_dir.exists():
        print(f"[错误] 输出目录已存在，请先删除或换一个路径: {output_dir}")
        sys.exit(1)

    print(f"\n[1/5] 复制模板到输出目录...")
    shutil.copytree(str(template_dir), str(output_dir))
    print(f"      完成: {output_dir}")

    print(f"\n[2/5] 复制素材...")
    vid_dir = output_dir / "assets" / "video"
    aud_dir = output_dir / "assets" / "audio"
    vid_dir.mkdir(parents=True, exist_ok=True)
    aud_dir.mkdir(parents=True, exist_ok=True)

    vid_dst = vid_dir / video_path.name
    aud_dst = aud_dir / audio_path.name
    shutil.copy2(str(video_path), str(vid_dst))
    shutil.copy2(str(audio_path), str(aud_dst))
    print(f"      视频 → {vid_dst}")
    print(f"      音频 → {aud_dst}")

    print(f"\n[3/5] 读取模板 draft_info.json...")
    template_data = json.loads(
        (output_dir / "draft_info.json").read_text(encoding="utf-8")
    )
    print(f"      模板 duration: {template_data.get('duration')}µs")
    print(f"      模板 id      : {template_data.get('id')}")

    print(f"\n[4/5] 重建 draft_info.json...")
    new_data = build_draft_info(
        template_data   = template_data,
        video_abs_path  = str(vid_dst),
        video_duration_us = video_us,
        video_w         = args.video_width,
        video_h         = args.video_height,
        audio_abs_path  = str(aud_dst),
        audio_duration_us = audio_us,
        subtitle_text   = args.subtitle,
        total_duration_us = total_us,
    )

    out_json = output_dir / "draft_info.json"
    out_json.write_text(
        json.dumps(new_data, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )
    size_kb = out_json.stat().st_size / 1024
    print(f"      写入完成: {out_json}  ({size_kb:.1f} KB)")

    print(f"\n[5/5] 结构自验:")
    tracks = new_data.get("tracks") or []
    mats   = new_data.get("materials") or {}
    print(f"      duration      : {new_data.get('duration')}µs  "
          f"= {new_data.get('duration')/1_000_000:.1f}s")
    print(f"      tracks        : {len(tracks)}")
    for t in tracks:
        segs = t.get("segments") or []
        print(f"        [{t.get('type'):<6}] segments={len(segs)}")
    print(f"      materials.videos : {len(mats.get('videos') or [])}")
    print(f"      materials.audios : {len(mats.get('audios') or [])}")
    print(f"      materials.texts  : {len(mats.get('texts') or [])}")

    txt_items = mats.get("texts") or []
    for i, t in enumerate(txt_items):
        raw = t.get("content") or ""
        try:
            text = json.loads(raw).get("text", "")
        except Exception:
            text = raw[:40]
        print(f"      字幕 [{i+1}]      : {text!r}")

    vid_items = mats.get("videos") or []
    for v in vid_items:
        p = v.get("path", "")
        exists = "✓" if Path(p).exists() else "✗ 不存在"
        print(f"      video path    : {exists}  {p}")
    aud_items = mats.get("audios") or []
    for a in aud_items:
        p = a.get("path", "")
        exists = "✓" if Path(p).exists() else "✗ 不存在"
        print(f"      audio path    : {exists}  {p}")

    kf_keys = list((new_data.get("keyframes") or {}).keys())
    all_empty = all(
        new_data["keyframes"][k] == [] for k in kf_keys
    )
    print(f"      keyframes     : 全{'清空 ✓' if all_empty else '未清空 ✗'}  keys={kf_keys}")
    print(f"      keyframe_graph_list: {new_data.get('keyframe_graph_list')}")

    print(f"""
================================================================
完成！输出目录：
  {output_dir}

⚠ 云端无法验证剪映 GUI。请本地执行以下步骤：

  1. 打开剪映专业版
  2. 在草稿列表找到：{output_dir.name}
  3. 点击打开，确认：
     - 时间线总时长 ≈ {total_us/1_000_000:.1f} 秒
     - 1 个视频片段 + 1 个音频片段 + 1 条字幕
     - 字幕内容：{args.subtitle!r}
     - 无 Media Not Found
================================================================
""")


if __name__ == "__main__":
    main()
