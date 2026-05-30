#!/usr/bin/env python3
"""
shipin-cut v0.9-hotfix — 本地成品视频生成脚本
用法: python export_video.py [草稿JSON路径]
     不传参数则自动扫描 export_workspace/drafts/ 下最新的 JSON
依赖: Python 3.8+, FFmpeg（ffmpeg/ffprobe 必须在 PATH 中）
"""

import sys
import os
import json
import subprocess
import shutil
import tempfile
import re
from pathlib import Path
from datetime import datetime

# ── 路径配置 ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE  = SCRIPT_DIR.parent / "export_workspace"
DRAFTS_DIR = WORKSPACE / "drafts"
VIDEOS_DIR = WORKSPACE / "videos"
AUDIO_DIR  = WORKSPACE / "audio"
OUTPUT_DIR = WORKSPACE / "output"
TEMP_DIR   = WORKSPACE / "temp"

for d in (DRAFTS_DIR, VIDEOS_DIR, AUDIO_DIR, OUTPUT_DIR, TEMP_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ── 工具函数 ──────────────────────────────────────────────────────────────────
def log(msg):
    print(f"[shipin-cut] {msg}", flush=True)

def err(msg):
    print(f"[ERROR] {msg}", file=sys.stderr, flush=True)

def check_ffmpeg():
    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            err(f"找不到 {tool}，请确认 FFmpeg 已安装并加入 PATH")
            sys.exit(1)
    log("FFmpeg 检测通过")

def run(cmd, check=True, capture=False):
    """运行 FFmpeg 命令，默认失败时抛出异常"""
    kwargs = dict(check=check)
    if capture:
        kwargs.update(capture_output=True, text=True)
    log("运行: " + " ".join(str(c) for c in cmd))
    return subprocess.run([str(c) for c in cmd], **kwargs)

def safe_name(s):
    return re.sub(r'[^\w一-鿿.-]', '_', s)

AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac"}

# ── 查找草稿 ──────────────────────────────────────────────────────────────────
def find_draft(arg=None):
    if arg:
        p = Path(arg)
        if not p.exists():
            err(f"找不到文件: {p}")
            sys.exit(1)
        return p
    jsons = sorted(DRAFTS_DIR.glob("*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not jsons:
        err(f"export_workspace/drafts/ 下没有找到 .json 文件，请先从网页导出剪辑草稿")
        sys.exit(1)
    if len(jsons) > 1:
        log(f"找到 {len(jsons)} 个草稿，使用最新: {jsons[0].name}")
        for i, j in enumerate(jsons):
            print(f"  [{i+1}] {j.name}")
    else:
        log(f"草稿: {jsons[0].name}")
    return jsons[0]

# ── 加载 JSON ─────────────────────────────────────────────────────────────────
def load_draft(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("type") != "refine-plan":
        err("文件不是有效的 refine-plan JSON（type 字段不对）")
        sys.exit(1)
    return data

# ── 匹配素材视频 ──────────────────────────────────────────────────────────────
def resolve_videos(source_videos):
    """
    source_videos: [{ index, fileName, duration }, ...]
    在 export_workspace/videos/ 下按文件名匹配，不区分大小写。
    返回 { index: Path } 映射。
    """
    available = {f.name.lower(): f for f in VIDEOS_DIR.iterdir() if f.is_file()}
    resolved = {}
    missing = []
    for sv in source_videos:
        idx = sv["index"]
        fname = sv["fileName"]
        match = available.get(fname.lower())
        if match:
            resolved[idx] = match
            log(f"  素材[{idx}] {fname} → {match.name}")
        else:
            missing.append(fname)
    if missing:
        err("以下素材视频未找到，请将原始视频放入 export_workspace/videos/:")
        for m in missing:
            err(f"  缺失: {m}")
        sys.exit(1)
    return resolved

# ── 解析音频文件 ──────────────────────────────────────────────────────────────
def resolve_voice(data):
    """
    按优先级查找最终语音文件，返回 Path 或 None（None 表示无声导出）。

    优先级 1: draft.voice.fileName → audio/ 同名文件
    优先级 2: draft.voiceMeta.fileName → audio/ 同名文件（兼容旧格式）
    优先级 3: 草稿无记录 + audio/ 只有 1 个音频 → 自动使用
    优先级 4: 草稿无记录 + audio/ 多个音频 → 报错退出
    兜底:    草稿无记录 + audio/ 无音频 → 无声导出，打印提示
    """
    audio_files = [
        f for f in AUDIO_DIR.iterdir()
        if f.is_file() and f.suffix.lower() in AUDIO_EXTS
    ]
    audio_map = {f.name.lower(): f for f in audio_files}

    # 优先级 1: voice.fileName
    voice = data.get("voice") or {}
    fname = voice.get("fileName", "").strip() if isinstance(voice, dict) else ""

    # 优先级 2: voiceMeta.fileName（兼容旧版或备用字段）
    if not fname:
        voice_meta = data.get("voiceMeta") or {}
        fname = voice_meta.get("fileName", "").strip() if isinstance(voice_meta, dict) else ""

    if fname:
        match = audio_map.get(fname.lower())
        if match:
            log(f"已找到最终语音：{match.name}")
            return match
        else:
            err(f"剪辑草稿记录了最终语音：{fname}")
            err(f"但在 export_workspace/audio/ 中没有找到该文件。")
            err(f"请把 {fname} 放入 audio 文件夹，或重新导出剪辑草稿。")
            sys.exit(1)

    # 草稿没有记录语音文件名
    if len(audio_files) == 1:
        log(f"草稿未记录语音，已自动使用 audio 文件夹中的唯一音频：{audio_files[0].name}")
        return audio_files[0]
    elif len(audio_files) > 1:
        err("audio 文件夹里有多个音频文件，但剪辑草稿没有记录最终语音文件名。")
        err("请只保留一个音频文件，或在精修页重新导入最终语音后导出剪辑草稿。")
        err("检测到的音频文件：")
        for f in sorted(audio_files, key=lambda x: x.name):
            err(f"  {f.name}")
        sys.exit(1)
    else:
        log("未检测到最终语音文件，本次将导出无声视频。")
        return None

# ── 裁剪单个片段 ──────────────────────────────────────────────────────────────
def cut_segment(seg, video_path, out_path, speed=1.0):
    """
    从 video_path 裁剪 [startSec, endSec]，应用速度，输出到 out_path。
    """
    start  = seg["startSec"]
    end    = seg["endSec"]
    dur    = end - start
    if dur <= 0:
        err(f"片段时长无效: {start} → {end}")
        return False

    vf = ""
    af = ""
    if abs(speed - 1.0) > 0.01:
        # setpts 控制视频速度，atempo 控制音频速度（支持 0.5~2.0）
        pts_val = 1.0 / speed
        vf = f"setpts={pts_val:.6f}*PTS"
        # atempo 只支持 [0.5, 2.0]，超出要串联
        af = _build_atempo(speed)

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start),
        "-t",  str(dur),
        "-i",  video_path,
        "-an",  # 先静音原声，后面合流
    ]
    if vf:
        cmd += ["-vf", vf]
    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        out_path,
    ]
    try:
        run(cmd)
        return True
    except subprocess.CalledProcessError:
        err(f"裁剪失败: {out_path}")
        return False

def _build_atempo(speed):
    """构造 atempo 滤镜链，支持任意倍速"""
    filters = []
    s = speed
    while s > 2.0:
        filters.append("atempo=2.0")
        s /= 2.0
    while s < 0.5:
        filters.append("atempo=0.5")
        s /= 0.5
    filters.append(f"atempo={s:.4f}")
    return ",".join(filters)

# ── 拼接片段列表 ──────────────────────────────────────────────────────────────
def concat_segments(clip_paths, out_path):
    """用 concat demuxer 拼接无声视频片段"""
    list_file = TEMP_DIR / "concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for p in clip_paths:
            f.write(f"file '{p.resolve()}'\n")
    run([
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file,
        "-c", "copy",
        out_path,
    ])

# ── 混合配音 ──────────────────────────────────────────────────────────────────
def mux_voice(video_path, voice_path, out_path, audio_policy):
    """
    将最终语音作为成品唯一音轨合入视频。
    临时视频由 -an 生成，没有音频轨，所以只取 0:v:0 + 1:a:0。
    v0.9 暂不支持 amix 原声混合，keepOriginalAudio 为 true 时打印提示后仍走替换逻辑。
    """
    keep_orig = audio_policy.get("keepOriginalAudio", False) if audio_policy else False
    if keep_orig:
        log("提示：当前 v0.9 暂不混合原声，仍使用最终语音作为主音轨。")

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", voice_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        out_path,
    ]
    run(cmd)

# ── 主流程 ────────────────────────────────────────────────────────────────────
def main():
    check_ffmpeg()

    draft_path = find_draft(sys.argv[1] if len(sys.argv) > 1 else None)
    data = load_draft(draft_path)

    comp_name    = data.get("compositionName", "output")
    timeline     = data.get("derivedTimeline", [])
    source_vids  = data.get("sourceVideos", [])
    audio_policy = data.get("exportSettings", {})

    if not timeline:
        err("derivedTimeline 为空，草稿中没有片段")
        sys.exit(1)
    if not source_vids:
        err("草稿缺少 sourceVideos 字段（请用 v0.9+ 网页重新导出草稿）")
        sys.exit(1)

    log(f"成品方案: {comp_name}  共 {len(timeline)} 个片段")

    # 解析素材视频路径
    video_map = resolve_videos(source_vids)

    # 解析配音文件（含 4 级自动匹配逻辑）
    voice_path = resolve_voice(data)

    # 清理临时目录
    for f in TEMP_DIR.glob("seg_*.mp4"):
        f.unlink()

    # 逐片段裁剪
    clip_paths = []
    for i, seg in enumerate(timeline):
        vidx = seg.get("videoIndex")
        if vidx is None or vidx not in video_map:
            err(f"片段 {i} 的 videoIndex={vidx} 无法匹配素材")
            sys.exit(1)
        speed = seg.get("speed", 1.0) or 1.0
        clip_out = TEMP_DIR / f"seg_{i:04d}.mp4"
        log(f"裁剪片段 {i+1}/{len(timeline)}: {seg.get('label','?')} [{seg['startSec']:.2f}~{seg['endSec']:.2f}s] x{speed}")
        ok = cut_segment(seg, video_map[vidx], clip_out, speed)
        if not ok:
            sys.exit(1)
        clip_paths.append(clip_out)

    # 拼接
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe = safe_name(comp_name)
    concat_out = TEMP_DIR / f"concat_{safe}_{ts}.mp4"
    log(f"拼接 {len(clip_paths)} 个片段 → {concat_out.name}")
    concat_segments(clip_paths, concat_out)

    # 混合配音或仅复制视频
    final_name = f"{safe}_{ts}.mp4"
    final_out  = OUTPUT_DIR / final_name
    if voice_path:
        log(f"正在合成配音：使用最终语音作为成品音轨")
        mux_voice(concat_out, voice_path, final_out, audio_policy)
        log(f"已合成配音 → {final_name}")
    else:
        shutil.copy2(concat_out, final_out)

    # 清理临时片段
    for f in clip_paths:
        try: f.unlink()
        except: pass
    try: concat_out.unlink()
    except: pass

    size_mb = final_out.stat().st_size / 1024 / 1024
    log(f"完成！输出文件: export_workspace/output/{final_name}  ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
