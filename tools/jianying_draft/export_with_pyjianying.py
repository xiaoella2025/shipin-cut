#!/usr/bin/env python3
"""
export_with_pyjianying.py - 使用 pyJianYingDraft 将视频/字幕导出为剪映草稿

用法:
  python export_with_pyjianying.py --video <mp4_path> [--srt <srt_path>] [--name <draft_name>] [--drafts-dir <dir>]

示例:
  python export_with_pyjianying.py --video F:/shipin-cut/export_workspace/jianying_test_assets/clip1.mp4 --name MIXCUT_EXPORT_TEST_20260608_001
"""

import argparse
import datetime
import json
import os
import re
import shutil
import time

# ─── 参数解析 ────────────────────────────────────────────

parser = argparse.ArgumentParser(description="使用 pyJianYingDraft 导出剪映草稿")
parser.add_argument("--video", required=True, help="输入 MP4 视频路径（必填）")
parser.add_argument("--srt", help="输入 SRT 字幕路径（可选）")
parser.add_argument("--name", help="草稿名称（可选，默认自动生成）")
parser.add_argument(
    "--drafts-dir",
    default="C:/Users/Admin/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/",
    help="剪映草稿目录（默认剪映默认目录）"
)
args = parser.parse_args()

video_path = os.path.abspath(args.video)
srt_path = os.path.abspath(args.srt) if args.srt else None

# 生成草稿名
if args.name:
    draft_name = args.name
else:
    now = datetime.datetime.now()
    draft_name = f"MIXCUT_EXPORT_{now.strftime('%Y%m%d_%H%M%S')}"

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
    exit(1)

# ─── SRT 解析 ────────────────────────────────────────────

def parse_srt(srt_path):
    """解析 SRT 文件，返回 [(start_us, end_us, text), ...]"""
    cues = []
    with open(srt_path, 'r', encoding='utf-8-sig') as f:
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

# ─── 创建草稿目录结构 ─────────────────────────────────────

draft_dir = os.path.join(drafts_dir, draft_name)

# ─── 保护重要草稿，不允许覆盖 ──────────────────────────────

PROTECTED_DRAFTS = [
    "PYJIANYING_TEST_1V1T",
    "MIXCUT_EMPTY_TEMPLATE",
]

# 检查 Storybound 相关草稿（不区分大小写）
storybound_pattern = "storybound"

if os.path.exists(draft_dir):
    # 保护重要测试草稿
    if draft_name in PROTECTED_DRAFTS:
        print(f"[错误] 禁止覆盖受保护草稿: {draft_name}")
        print(f"  受保护草稿列表: {PROTECTED_DRAFTS}")
        print(f"  请使用其他草稿名（--name MY_NEW_DRAFT）")
        exit(1)
    # 检查 Storybound 草稿
    if storybound_pattern in draft_name.lower():
        print(f"[错误] 禁止覆盖 Storybound 样本草稿: {draft_name}")
        print(f"  请使用其他草稿名（--name MY_NEW_DRAFT）")
        exit(1)
    # 其他草稿直接删除重建（避免 FileExistsError）
    print(f"[提示] 目录已存在，将删除后重建: {draft_name}")
    shutil.rmtree(draft_dir)

print(f"[1/5] 创建草稿目录: {draft_name}")
df = DraftFolder(drafts_dir)
sf = df.create_draft(draft_name, width=1920, height=1080, fps=30, allow_replace=True)
print(f"  目录 + draft_meta_info.json 已创建")

# ── 添加视频轨 ───────────────────────────────────────────

print(f"[2/5] 添加视频轨...")
sf.add_track(TrackType.video, "video")

video_mat = VideoMaterial(path=video_path, material_name=os.path.basename(video_path))
sf.add_material(video_mat)

video_dur = video_mat.duration
print(f"  视频素材: {video_path}")
print(f"  时长: {video_dur} us ({video_dur/1000000:.2f}s)")
print(f"  分辨率: {video_mat.width}x{video_mat.height}")

video_seg = VideoSegment(
    material=video_mat,
    target_timerange=Timerange(start=0, duration=video_dur)
)
sf.add_segment(video_seg, track_name="video")
print(f"  视频片段已添加")

# ── 添加字幕轨 ───────────────────────────────────────────

if srt_path and os.path.exists(srt_path):
    print(f"[3/5] 添加字幕轨 from: {srt_path}")
    sf.add_track(TrackType.text, "subtitle")

    cues = parse_srt(srt_path)
    print(f"  SRT 解析到 {len(cues)} 条字幕")

    # 字幕时间钳制到视频时长内：避免最后一条字幕被放到视频末尾之后而被剪映忽略
    MIN_DUR_US = 300000  # 最短 0.3s
    written = 0
    for i, (start_us, end_us, text) in enumerate(cues):
        if not text.strip():
            continue
        # 起点超出视频时长：往回挪，保证至少能显示一小段
        if start_us >= video_dur:
            start_us = max(0, video_dur - MIN_DUR_US)
        # 终点超出视频时长：钳制到视频末尾
        if end_us > video_dur:
            end_us = video_dur
        # 时长异常：给一个最小时长
        if end_us - start_us < MIN_DUR_US:
            end_us = min(video_dur, start_us + MIN_DUR_US)
        if end_us <= start_us:
            print(f"  字幕 [{i+1}] 跳过（时间无效 {start_us}~{end_us}）")
            continue
        text_seg = TextSegment(
            text=text,
            timerange=Timerange(start=start_us, duration=end_us - start_us)
        )
        sf.add_segment(text_seg, track_name="subtitle")
        written += 1
        print(f"  字幕 [{i+1}] {start_us/1000000:.1f}s-{end_us/1000000:.1f}s: {text[:40]}")
    print(f"  字幕轨写入完成：{written}/{len(cues)} 条（视频时长 {video_dur/1000000:.2f}s）")
    if cues:
        ls, le, lt = cues[-1]
        print(f"  [末条字幕] {ls/1000000:.2f}s-{le/1000000:.2f}s: {lt[:60]}")
else:
    print(f"[3/5] 无 SRT 字幕，跳过字幕轨")

# ─── 保存 ScriptFile（写入 draft_content.json）──────────────

print(f"[4/5] 保存 draft_content.json...")
sf.save()  # 使用 save() 而非 dump()

print(f"  draft_content.json 已保存")

# ── 读取 draft_content.json 获取 timeline id ─────────────

content_path = os.path.join(draft_dir, 'draft_content.json')
with open(content_path, 'r', encoding='utf-8') as f:
    draft_content = json.load(f)

timeline_id = draft_content.get('id', '')
print(f"  获取 timeline_id: {timeline_id}")

# ── 更新 draft_meta_info.json ────────────────────────────

meta_path = os.path.join(draft_dir, 'draft_meta_info.json')
with open(meta_path, 'r', encoding='utf-8') as f:
    meta = json.load(f)

now_s = int(time.time())
now_ms = now_s * 1000

meta['draft_name'] = draft_name
meta['draft_id'] = timeline_id or meta.get('draft_id', '')
meta['draft_fold_path'] = draft_dir
meta['draft_root_path'] = drafts_dir
meta['tm_duration'] = draft_content.get('duration', 0)
meta['tm_draft_create'] = now_ms
meta['tm_draft_modified'] = now_ms

with open(meta_path, 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print(f"  draft_meta_info.json 已更新（draft_name={draft_name}）")

# ── 写入 timeline_layout.json ────────────────────────────

layout = {
    "activeTimeline": timeline_id,
    "dockItems": [{
        "dockIndex": 0,
        "ratio": 1,
        "timelineIds": [timeline_id],
        "timelineNames": ["时间线01"]
    }],
    "layoutOrientation": 1
}

layout_path = os.path.join(draft_dir, 'timeline_layout.json')
with open(layout_path, 'w', encoding='utf-8') as f:
    json.dump(layout, f, ensure_ascii=False, indent=2)

print(f"  timeline_layout.json 已创建")

# ── 写入 draft_settings ──────────────────────────────────

settings_path = os.path.join(draft_dir, 'draft_settings')
settings_content = f"""[General]
cloud_last_modify_platform=windows
draft_create_time={now_s}
draft_last_edit_time={now_s}
real_edit_seconds=0
real_edit_keys=0
"""
with open(settings_path, 'w', encoding='utf-8') as f:
    f.write(settings_content)

print(f"  draft_settings 已创建")

# ─── 验证并列出文件 ───────────────────────────────────────

files = []
for root, dirs, filenames in os.walk(draft_dir):
    for f in filenames:
        fp = os.path.join(root, f)
        size = os.path.getsize(fp)
        rel = os.path.relpath(fp, draft_dir)
        files.append(f"  {rel} ({size} bytes)")

print(f"\n[5/5] 生成文件 ({len(files)} 个):")
for f in sorted(files):
    print(f)

# 验证内容
with open(content_path, 'r', encoding='utf-8') as f:
    content = json.load(f)

print(f"\n草稿验证:")
print(f"  平台: {content.get('platform', {}).get('app_source')} {content.get('platform', {}).get('app_version')} ({content.get('platform', {}).get('os')})")
print(f"  时长: {content.get('duration')} us ({content.get('duration', 0)/1000000:.2f}s)")
print(f"  视频轨: {len([t for t in content.get('tracks', []) if t.get('type') == 'video'])}")
print(f"  字幕轨: {len([t for t in content.get('tracks', []) if t.get('type') == 'text'])}")
videos = content.get('materials', {}).get('videos', [])
texts = content.get('materials', {}).get('texts', [])
print(f"  视频素材: {len(videos)}")
print(f"  字幕素材: {len(texts)}")

print(f"\n完成: {draft_dir}")