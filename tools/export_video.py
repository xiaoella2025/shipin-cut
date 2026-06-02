#!/usr/bin/env python3
"""
shipin-cut v0.9.4 — 本地成品视频生成脚本
用法: python export_video.py [草稿JSON路径]
     不传参数则自动扫描 export_workspace/drafts/ 下最新的 JSON
依赖: Python 3.8+, FFmpeg（ffmpeg/ffprobe 必须在 PATH 中）
"""

import sys
import os
import json
import subprocess
import shutil
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
        # v0.9.3: 优先使用同步后的 storedFileName / fileName，回退到 originalName
        candidates = [
            sv.get("storedFileName"),
            sv.get("fileName"),
            sv.get("originalName"),
        ]
        match = None
        used = None
        for cand in candidates:
            if cand and cand.lower() in available:
                match = available[cand.lower()]
                used = cand
                break
        if match:
            resolved[idx] = match
            log(f"  素材[{idx}] {used} → {match.name}")
        else:
            missing.append(sv.get("fileName") or sv.get("originalName") or f"index={idx}")
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

    # 优先级 1: voice 的同步文件名（storedFileName / fileName / originalName）
    voice = data.get("voice") or {}
    names = []
    if isinstance(voice, dict):
        for key in ("storedFileName", "fileName", "originalName"):
            v = (voice.get(key) or "").strip()
            if v:
                names.append(v)

    # 优先级 2: voiceMeta.fileName（兼容旧版或备用字段）
    if not names:
        voice_meta = data.get("voiceMeta") or {}
        if isinstance(voice_meta, dict):
            v = (voice_meta.get("fileName") or "").strip()
            if v:
                names.append(v)

    if names:
        for fname in names:
            match = audio_map.get(fname.lower())
            if match:
                log(f"已找到最终语音：{match.name}")
                return match
        err(f"剪辑草稿记录了最终语音：{names[0]}")
        err(f"但在 export_workspace/audio/ 中没有找到该文件。")
        err(f"请在网页精修页重新导入并同步配音，或重新导出剪辑草稿。")
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
def cut_segment(seg, video_path, out_path, speed=1.0, crf=20):
    """从 video_path 裁剪 [startSec, endSec]，应用速度，输出到 out_path。"""
    start  = seg["startSec"]
    end    = seg["endSec"]
    dur    = end - start
    if dur <= 0:
        err(f"片段时长无效: {start} → {end}")
        return False

    vf = ""
    if abs(speed - 1.0) > 0.01:
        pts_val = 1.0 / speed
        vf = f"setpts={pts_val:.6f}*PTS"

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
        "-crf", str(crf),
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
    """将最终语音作为成品唯一音轨合入视频。"""
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

# ── v0.9.4 画面裁切（Reframe）────────────────────────────────────────────────

def get_video_dimensions(video_path):
    """用 ffprobe 获取视频宽高，失败时返回 (1920, 1080)"""
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=width,height",
             "-of", "csv=s=x:p=0", str(video_path)],
            capture_output=True, text=True, check=True
        )
        parts = result.stdout.strip().split("x")
        if len(parts) == 2:
            return int(parts[0]), int(parts[1])
    except Exception:
        pass
    return 1920, 1080


_ASPECT_MAP = {
    "16:9":   (1920, 1080),
    "4:3":    (1440, 1080),
    "3:4":    (810,  1080),
    "9:16":   (608,  1080),
    "1:1":    (1080, 1080),
    "2:1":    (2160, 1080),
    "2.35:1": (2540, 1080),
}

def aspect_to_wh(aspect_str):
    """返回 (W, H)，保留原比例 / 未知 key 返回 None"""
    if not aspect_str or aspect_str == "保留原比例":
        return None
    wh = _ASPECT_MAP.get(aspect_str)
    if not wh:
        return None
    W, H = wh
    return (W - W % 2), (H - H % 2)


def reframe_video(in_path, out_path, W, H, scale=1.0, offset_x=0.0, offset_y=0.0, crf=20):
    """
    裁切 in_path 到 W×H 画布，输出 out_path。
    scale:    额外放大系数（>1 可避免黑边）
    offset_x: 水平偏移比例，>0 向右移（画面右移，底部原字幕不受影响）
    offset_y: 垂直偏移比例，>0 向上移（crop 向下裁，有利于隐藏底部原字幕）
    """
    src_w, src_h = get_video_dimensions(in_path)
    fill_f = max(W / src_w, H / src_h) * scale
    scaled_w = int(src_w * fill_f)
    scaled_h = int(src_h * fill_f)
    if scaled_w % 2: scaled_w += 1
    if scaled_h % 2: scaled_h += 1

    cx = (scaled_w - W) / 2 - offset_x * W
    cy = (scaled_h - H) / 2 - offset_y * H
    cx = max(0.0, min(cx, float(scaled_w - W)))
    cy = max(0.0, min(cy, float(scaled_h - H)))

    vf = (
        f"scale={scaled_w}:{scaled_h}:flags=lanczos,"
        f"crop={W}:{H}:{int(cx)}:{int(cy)}"
    )
    cmd = [
        "ffmpeg", "-y",
        "-i", str(in_path),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", str(crf),
        "-c:a", "copy",
        str(out_path),
    ]
    run(cmd)


# ── v0.9.3/v0.9.4 字幕生成 ───────────────────────────────────────────────────

def split_script_to_subtitles(text, total_duration):
    """
    将字幕稿切分为带时间戳的字幕列表。
    按换行、句末标点切分，单句超 20 字再强制截断。
    返回 [{start, end, text}, ...]，按字数比例分配时长。
    """
    if not text or not text.strip() or total_duration <= 0:
        return []

    raw_lines = [l.strip() for l in text.strip().splitlines() if l.strip()]
    sentences = []
    for line in raw_lines:
        parts = re.split(r'(?<=[。！？；…])', line)
        for part in parts:
            part = part.strip()
            if not part:
                continue
            if len(part) > 20:
                sub_parts = re.split(r'(?<=[，、：])', part)
                for sp in sub_parts:
                    sp = sp.strip()
                    if not sp:
                        continue
                    while len(sp) > 20:
                        sentences.append(sp[:20])
                        sp = sp[20:]
                    if sp:
                        sentences.append(sp)
            else:
                sentences.append(part)

    if not sentences:
        return []

    total_chars = sum(len(s) for s in sentences) or 1
    subs = []
    t = 0.0
    for s in sentences:
        dur = max(0.8, min(6.0, total_duration * len(s) / total_chars))
        end = min(t + dur, total_duration)
        subs.append({'start': t, 'end': end, 'text': s})
        t = end

    return subs


def _format_ass_time(seconds):
    """秒数转 ASS 时间格式 H:MM:SS.cc"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    cs = int((s - int(s)) * 100)
    return f"{h}:{m:02d}:{int(s):02d}.{cs:02d}"


def write_ass_file(subs, out_path, subtitle_style=None, cover_pct=0.0, play_res_y=1080):
    """
    生成 ASS 字幕文件。
    subtitle_style: dict with fontFamily/fontSize/color/outline/outlineColor/
                    outlineWidth/background/backgroundOpacity/position/marginV
    cover_pct: 底部遮挡高度比例（0~1），字幕上移至遮挡条上方。
    """
    st = subtitle_style or {}

    def color_to_ass(c, alpha=0):
        # ASS color format: &HAABBGGRR (alpha=0 means opaque)
        a = format(alpha, '02X')
        # Support hex colors like #RRGGBB
        if c and isinstance(c, str) and c.startswith('#') and len(c) == 7:
            try:
                r, g, b = c[1:3], c[3:5], c[5:7]
                return f'&H{a}{b}{g}{r}'
            except Exception:
                pass
        table = {
            'white':  f'&H{a}FFFFFF',
            'yellow': f'&H{a}00FFFF',
            'black':  f'&H{a}000000',
            'red':    f'&H{a}0000FF',
            'blue':   f'&H{a}FF8844',
            'green':  f'&H{a}33CC33',
            'orange': f'&H{a}0099FF',
            'pink':   f'&H{a}AA88FF',
            'purple': f'&H{a}FF55BB',
        }
        return table.get(c, f'&H{a}FFFFFF')

    font         = st.get("fontFamily", "Microsoft YaHei")
    font_size    = int(st.get("fontSize", max(48, int(play_res_y / 27))))
    primary      = color_to_ass(st.get("color", "white"))
    outline_on   = st.get("outline", True)
    outline_c    = color_to_ass(st.get("outlineColor", "black")) if outline_on else color_to_ass("black")
    outline_w    = int(st.get("outlineWidth", 4)) if outline_on else 0
    shadow_w     = max(0, outline_w // 2)

    # background: support new backgroundMode/backgroundColor + old background field
    bg_mode      = st.get("backgroundMode")
    if bg_mode is None:
        old_bg = st.get("background", "none")
        bg_mode = "none" if old_bg == "none" else "text"
        bg_color_key = old_bg if old_bg != "none" else "black"
    else:
        bg_color_key = st.get("backgroundColor", "black")
    bg_opacity   = float(st.get("backgroundOpacity", 0.45))
    if bg_mode != "none":
        alpha_val    = int((1.0 - bg_opacity) * 255)
        border_style = 3   # ASS opaque box wraps text; bar mode uses same box for low-risk impl
        bg_color     = color_to_ass(bg_color_key, alpha=alpha_val)
    else:
        border_style = 1
        bg_color     = "&H80000000"

    position     = st.get("position", "bottom")
    margin_v     = int(st.get("marginV", 60))
    cover_px     = max(0, int(play_res_y * cover_pct)) + 10 if cover_pct > 0 else 0

    align_map    = {'bottom': 2, 'lower': 2, 'middle': 5, 'top': 8}
    alignment    = align_map.get(position, 2)

    if position == 'lower':
        margin_v = int(play_res_y * 0.15) + cover_px
    elif position in ('bottom', 'top'):
        margin_v = margin_v + cover_px
    # middle: marginV ignored by ASS

    header = (
        "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\n"
        f"PlayResX: 1080\nPlayResY: {play_res_y}\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font},{font_size},"
        f"{primary},&H000000FF,{outline_c},{bg_color},"
        f"-1,0,0,0,100,100,0,0,{border_style},{outline_w},{shadow_w},"
        f"{alignment},30,30,{margin_v},1\n\n"
        "[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )

    with open(out_path, 'w', encoding='utf-8-sig') as f:
        f.write(header)
        for sub in subs:
            start = _format_ass_time(sub['start'])
            end   = _format_ass_time(sub['end'])
            text  = sub['text'].replace('\n', '\\N')
            f.write(f"Dialogue: 0,{start},{end},Default,,0,0,0,,{text}\n")

    return out_path


def burn_sub_and_cover(in_path, out_path, sub_name=None, cover_pct=0.0, crf=20):
    """
    将字幕和/或底部遮挡条烧录到视频中。
    sub_name: ASS 文件名（相对 TEMP_DIR，None 则不烧字幕）
    cover_pct: 底部遮挡比例 0~1
    以 TEMP_DIR 为工作目录，避免路径转义问题。
    """
    vf_parts = []
    if cover_pct > 0:
        vf_parts.append(
            f"drawbox=x=0:y=ih-ih*{cover_pct:.4f}:w=iw:h=ih*{cover_pct:.4f}:color=black:t=fill"
        )
    if sub_name:
        vf_parts.append(f"ass='{sub_name}'")

    vf = ",".join(vf_parts)
    cmd = [
        "ffmpeg", "-y",
        "-i", str(in_path.resolve()),
        "-vf", vf,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", str(crf),
        "-c:a", "copy",
        str(out_path.resolve()),
    ]
    log("运行: " + " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True, cwd=str(TEMP_DIR))


# ── 主流程 ────────────────────────────────────────────────────────────────────
def main():
    check_ffmpeg()

    draft_path = find_draft(sys.argv[1] if len(sys.argv) > 1 else None)
    data = load_draft(draft_path)

    comp_name        = data.get("compositionName", "output")
    timeline         = data.get("derivedTimeline", [])
    source_vids      = data.get("sourceVideos", [])
    export_settings  = data.get("exportSettings", {}) or {}
    audio_policy     = export_settings
    summary_script   = (data.get("summaryScript") or "").strip()
    final_subtitles  = data.get("finalSubtitles")  # v0.9.4: per-comp edited subtitles

    # v0.9.4: reframe settings
    reframe_cfg  = export_settings.get("reframe") or {}
    reframe_on   = reframe_cfg.get("enabled", False)
    reframe_asp  = reframe_cfg.get("aspect", "保留原比例")
    reframe_scl  = float(reframe_cfg.get("scale", 1.0))
    reframe_ox   = float(reframe_cfg.get("offsetX", 0.0))
    reframe_oy   = float(reframe_cfg.get("offsetY", 0.0))

    # v0.9.5h: output quality CRF
    quality_crf_map = {"标准": 23, "高清": 20, "超清": 18}
    export_quality = export_settings.get("exportQuality", "高清")
    crf = quality_crf_map.get(export_quality, 20)
    log(f"输出画质: {export_quality} (CRF {crf})")

    # v0.9.4: origSubMode ('keep'|'crop'|'cover'), subtitle style
    orig_sub_mode  = export_settings.get("origSubMode", None)
    if orig_sub_mode is None:
        # fallback from v0.9.3 boolean
        orig_sub_mode = "cover" if export_settings.get("coverOriginalSub", False) else "keep"
    subtitle_style = export_settings.get("subtitleStyle") or {}

    # burn subtitle flag
    burn_sub = export_settings.get("burnInSubtitle", False)

    # cover strip height (used when origSubMode == 'cover')
    cover_height_str = export_settings.get("coverOrigSubHeight", "12%")
    try:
        cover_pct = float(str(cover_height_str).rstrip('%')) / 100.0
    except (ValueError, AttributeError):
        cover_pct = 0.12

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
        ok = cut_segment(seg, video_map[vidx], clip_out, speed, crf=crf)
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

    # v0.9.4: 画面裁切（reframe）
    if reframe_on and reframe_asp and reframe_asp != "保留原比例":
        wh = aspect_to_wh(reframe_asp)
        if wh:
            W, H = wh
            reframed_out = OUTPUT_DIR / f"reframed_{final_name}"
            log(f"画面裁切: {reframe_asp} ({W}×{H}), 缩放={reframe_scl:.2f}, offsetX={reframe_ox:.2f}, offsetY={reframe_oy:.2f}")
            reframe_video(final_out, reframed_out, W, H, reframe_scl, reframe_ox, reframe_oy, crf=crf)
            final_out.unlink()
            shutil.move(str(reframed_out), str(final_out))
            log(f"裁切完成 → {final_name}")

    # v0.9.3/v0.9.4: 字幕 + 遮挡
    need_cover   = (orig_sub_mode == "cover")
    need_burn_sub = burn_sub
    need_burn    = need_burn_sub or need_cover

    if need_burn:
        # 获取输出视频尺寸（用于 ASS PlayRes）
        out_w, out_h = get_video_dimensions(final_out)

        sub_file = None
        if need_burn_sub:
            # v0.9.4: 优先使用用户逐句编辑的 finalSubtitles
            if final_subtitles and len(final_subtitles) > 0:
                subs = [
                    {'start': s.get('start', 0), 'end': s.get('end', 0), 'text': s.get('text', '')}
                    for s in final_subtitles
                    if s.get('text', '').strip()
                ]
                log(f"使用用户编辑字幕，共 {len(subs)} 条")
            elif summary_script:
                total_dur = data.get("totalDuration") or sum(
                    seg.get("actualDur", seg.get("endSec", 0) - seg.get("startSec", 0))
                    for seg in timeline
                )
                subs = split_script_to_subtitles(summary_script, total_dur)
                log(f"从字幕稿切分，共 {len(subs)} 条")
            else:
                subs = []
                log("字幕稿为空，跳过字幕烧录")

            if subs:
                sub_file = TEMP_DIR / "sub.ass"
                write_ass_file(
                    subs, sub_file,
                    subtitle_style=subtitle_style,
                    cover_pct=cover_pct if need_cover else 0.0,
                    play_res_y=out_h,
                )
                log(f"字幕文件已生成，共 {len(subs)} 条")

        if sub_file or need_cover:
            burned_out = OUTPUT_DIR / f"burned_{final_name}"
            actual_cover = cover_pct if need_cover else 0.0
            burn_sub_and_cover(
                final_out, burned_out,
                sub_name=sub_file.name if sub_file else None,
                cover_pct=actual_cover,
                crf=crf,
            )
            final_out.unlink()
            shutil.move(str(burned_out), str(final_out))
            log(f"字幕/遮挡烧录完成 → {final_name}")

        if sub_file and sub_file.exists():
            try: sub_file.unlink()
            except: pass

    # v0.9.5: Background music mixing
    bgm_cfg = export_settings.get("bgm") or {}
    if bgm_cfg.get("enabled") and voice_path:
        bgm_name = bgm_cfg.get("fileName") or ""
        bgm_volume = float(bgm_cfg.get("volume", 0.18))
        bgm_path = None
        if bgm_name:
            bgm_path = AUDIO_DIR / bgm_name
            if not bgm_path.exists():
                log(f"背景音乐文件未找到，跳过背景音乐混合: {bgm_name}")
                bgm_path = None
        if bgm_path:
            bgm_out = OUTPUT_DIR / f"bgm_{final_name}"
            log(f"正在混合背景音乐（音量 {int(bgm_volume*100)}%）: {bgm_path.name}")
            cmd = [
                "ffmpeg", "-y",
                "-i", str(final_out),
                "-i", str(bgm_path),
                "-filter_complex",
                f"[0:a]volume=1.0[main];[1:a]volume={bgm_volume:.2f},aloop=-1:size=2e+09[bgm];[main][bgm]amix=inputs=2:duration=first[aout]",
                "-map", "0:v:0",
                "-map", "[aout]",
                "-c:v", "copy",
                "-c:a", "aac",
                str(bgm_out),
            ]
            run(cmd)
            final_out.unlink()
            shutil.move(str(bgm_out), str(final_out))
            log(f"背景音乐混合完成 → {final_name}")

    size_mb = final_out.stat().st_size / 1024 / 1024
    log(f"完成！输出文件: export_workspace/output/{final_name}  ({size_mb:.1f} MB)")

if __name__ == "__main__":
    main()
