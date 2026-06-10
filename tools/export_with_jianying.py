#!/usr/bin/env python3
"""
export_with_jianying.py — 成品视频导出后自动生成剪映草稿

用法（接在 export_video.py 之后，或独立调用）：
  python tools/export_with_jianying.py --mp4 <mp4_path> [--srt <srt_path>] [--name <draft_name>]

此脚本是 shipin-cut 主流程的最小接入点：
  1. 调用 export_video.main() 生成成品 MP4（如未生成）
  2. 查找对应的 SRT（如未传入）
  3. 调用 export_with_pyjianying.py 生成剪映草稿

关键约束：
  - 不影响原本的 MP4 导出流程
  - pyJianYingDraft 调用失败不影响主流程
  - 草稿名默认带时间戳：MIXCUT_成品_YYYYMMDD_HHMMSS
"""

import argparse
import datetime
import os
import subprocess
import sys

# ─── 参数解析 ────────────────────────────────────────────

parser = argparse.ArgumentParser(description="成品 MP4 + SRT 生成剪映草稿")
parser.add_argument("--mp4", help="成品 MP4 路径（可选，默认自动查找 output/ 最新 MP4）")
parser.add_argument("--srt", help="SRT 字幕路径（可选，默认从 local-output/subtitles/ 匹配）")
parser.add_argument("--name", help="草稿名称（可选，默认 MIXCUT_成品_YYYYMMDD_HHMMSS）")
parser.add_argument(
    "--venv",
    default="F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/python",
    help="pyJianYingDraft venv 中的 Python 解释器路径"
)
args = parser.parse_args()

# ─── 成品 MP4 路径解析 ────────────────────────────────────

if args.mp4:
    mp4_path = os.path.abspath(args.mp4)
    if not os.path.exists(mp4_path):
        print(f"[ERROR] MP4 不存在: {mp4_path}")
        sys.exit(1)
    print(f"[成品视频] {mp4_path}")
else:
    # 自动查找 export_workspace/output/ 下最新的 MP4
    output_dir = os.path.join(os.path.dirname(__file__), "..", "export_workspace", "output")
    output_dir = os.path.abspath(output_dir)
    mp4_files = []
    if os.path.exists(output_dir):
        mp4_files = [
            f for f in os.listdir(output_dir)
            if f.endswith(".mp4") and not f.startswith(".")
        ]
    if not mp4_files:
        print("[ERROR] 未找到成品 MP4（export_workspace/output/ 下无 .mp4 文件）")
        print("请先运行 export_video.py 生成成品视频，或传入 --mp4 指定路径")
        sys.exit(1)
    # 按修改时间取最新
    mp4_files.sort(key=lambda f: os.path.getmtime(os.path.join(output_dir, f)), reverse=True)
    mp4_path = os.path.join(output_dir, mp4_files[0])
    print(f"[成品视频]（自动）{mp4_path}")

# ─── SRT 路径解析 ─────────────────────────────────────────

srt_path = None
if args.srt:
    srt_path = os.path.abspath(args.srt)
    if not os.path.exists(srt_path):
        print(f"[WARNING] SRT 不存在: {srt_path}，本次只生成视频轨")
        srt_path = None
    else:
        print(f"[字幕文件] {srt_path}")
else:
    # 自动匹配：从 local-output/subtitles/ 查找与 MP4 同名的 .srt
    # 例如：export_workspace/output/成品视频_1_20260602.mp4 → local-output/subtitles/1.srt
    mp4_basename = os.path.splitext(os.path.basename(mp4_path))[0]
    subtitle_dir = os.path.join(os.path.dirname(__file__), "..", "local-output", "subtitles")
    subtitle_dir = os.path.abspath(subtitle_dir)

    # 策略：查找 manifest 确认 MP4 basename 对应的 SRT
    manifest_path = os.path.join(subtitle_dir, "subtitle-manifest.json")
    if os.path.exists(manifest_path):
        import json
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
        for item in manifest.get("items", []):
            video_name = item.get("videoFilename", "")
            srt = item.get("srt", "")
            # 匹配 videoFilename 部分（去掉扩展名）
            video_base = os.path.splitext(video_name)[0]
            if video_base in mp4_basename or mp4_basename in video_base:
                potential_srt = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", srt))
                if os.path.exists(potential_srt):
                    srt_path = potential_srt
                    print(f"[字幕文件]（自动匹配）{srt_path}")
                    break

    if not srt_path:
        print("[字幕] 未找到对应 SRT，本次只生成视频轨")

# ─── 生成草稿名 ───────────────────────────────────────────

if args.name:
    draft_name = args.name
else:
    now = datetime.datetime.now()
    draft_name = f"MIXCUT_成品_{now.strftime('%Y%m%d_%H%M%S')}"

print(f"[草稿名称] {draft_name}")

# ─── 调用 export_with_pyjianying.py ───────────────────────

jianying_script = os.path.join(os.path.dirname(__file__), "jianying_draft", "export_with_pyjianying.py")
jianying_script = os.path.abspath(jianying_script)

cmd = [args.venv, jianying_script, "--video", mp4_path, "--name", draft_name]
if srt_path:
    cmd += ["--srt", srt_path]

# ─── 打印 SRT 关键信息（方便黑窗口排查）──────────────────────
if srt_path and os.path.exists(srt_path):
    try:
        with open(srt_path, 'r', encoding='utf-8-sig') as f:
            srt_raw = f.read()
        blocks = [b.strip() for b in srt_raw.split('\n\n') if b.strip()]
        print(f"[调用前验证] SRT 路径: {srt_path}")
        print(f"[调用前验证] SRT 共 {len(blocks)} 条字幕")
        if blocks:
            last_block = blocks[-1]
            print(f"[调用前验证] 最后一条字幕:\n{last_block}")
    except Exception as ex:
        print(f"[调用前验证] 读取 SRT 失败: {ex}")
else:
    print(f"[调用前验证] 无 SRT 字幕")

print(f"\n[调用剪映草稿生成] {' '.join(cmd)}")
print("─" * 60)

try:
    result = subprocess.run(cmd, check=True, capture_output=True, text=True,
                            encoding="utf-8", errors="replace")
    print(result.stdout)
    if result.stderr:
        print(f"[stderr] {result.stderr[:500]}")
    print("─" * 60)
    print(f"[成功] 剪映草稿已生成: {draft_name}")
    print(f"  成品视频: {mp4_path}")
    if srt_path:
        print(f"  字幕文件: {srt_path}")
    print(f"  剪映草稿名: {draft_name}")
    print("  请重新打开剪映专业版查看草稿")
except subprocess.CalledProcessError as e:
    print("─" * 60)
    print(f"[错误] 剪映草稿生成失败（pyJianYingDraft 脚本返回非零退出码）")
    print(f"  成品视频: {mp4_path}")
    if srt_path:
        print(f"  字幕文件: {srt_path}")
    stdout_out = (e.stdout or '').strip()
    stderr_out = (e.stderr or '').strip()
    if stdout_out:
        print(f"  stdout: {stdout_out[-1000:]}")
    if stderr_out:
        print(f"  stderr: {stderr_out[-1000:]}")
    sys.exit(1)  # 向上层（local_export_server.py）传播失败，不能悄悄返回 0