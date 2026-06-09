#!/usr/bin/env python3
"""
shipin-cut v0.9.3 — 本地导出服务
用法: python local_export_server.py
     启动后监听 http://127.0.0.1:8765
     - 网页导入原视频时自动 POST 到 /upload-video（同步到 videos/）
     - 精修页导入配音时自动 POST 到 /upload-audio（同步到 audio/）
     - 网页点击"导出成品视频"时 POST 草稿 JSON 到 /export
"""

import os
import sys
import json
import re
import shutil
import tempfile
import subprocess
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

SCRIPT_DIR     = Path(__file__).resolve().parent
REPO_ROOT      = SCRIPT_DIR.parent
WORKSPACE      = REPO_ROOT / "export_workspace"
DRAFTS_DIR     = WORKSPACE / "drafts"
VIDEOS_DIR     = WORKSPACE / "videos"
AUDIO_DIR      = WORKSPACE / "audio"
IMAGES_DIR     = WORKSPACE / "images"   # v0.9.8: background images
EXPORT_SCRIPT  = SCRIPT_DIR / "export_video.py"
WHISPER_CONFIG = REPO_ROOT / "local-tools" / "whisper.config.json"
CURRENT_DRAFT  = "web-export-current.json"

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

HOST = "127.0.0.1"
PORT = 8765

VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}
AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".aac"}


def safe_stored_name(original, prefix, default_ext):
    """生成安全的存储文件名：prefix_时间戳_清洗后原名.ext，避免中文/空格/特殊符号。"""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    stem = Path(original or "").stem
    ext = Path(original or "").suffix.lower()
    if not ext:
        ext = default_ext
    clean = re.sub(r"[^A-Za-z0-9._-]", "_", stem).strip("_")[:40] or "file"
    return f"{prefix}_{ts}_{clean}{ext}"


def parse_multipart(body, content_type):
    """极简 multipart/form-data 解析，返回 (fields:dict, files:dict{name:{filename,content}})。"""
    m = re.search(r"boundary=([^;]+)", content_type)
    if not m:
        return {}, {}
    boundary = m.group(1).strip().strip('"')
    delim = b"--" + boundary.encode()
    fields, files = {}, {}
    for part in body.split(delim):
        if not part or part in (b"--", b"--\r\n", b"\r\n"):
            continue
        if b"\r\n\r\n" not in part:
            continue
        header_blob, content = part.split(b"\r\n\r\n", 1)
        if content.endswith(b"\r\n"):
            content = content[:-2]
        headers = header_blob.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]*)"', headers)
        if not name_m:
            continue
        name = name_m.group(1)
        fn_m = re.search(r'filename="([^"]*)"', headers)
        if fn_m and fn_m.group(1):
            files[name] = {"filename": fn_m.group(1), "content": content}
        else:
            fields[name] = content.decode("utf-8", "replace").strip()
    return fields, files


# ── v0.9.7: 字幕↔配音自动对齐（本地 whisper.cpp，不接云 API）──────────────────────

def _find_local_tool(names, subdir):
    """在 local-tools/<subdir>/ 中查找可执行文件，找到返回路径字符串，否则 None。"""
    for name in names:
        p = REPO_ROOT / "local-tools" / subdir / name
        if p.exists():
            return str(p)
    return None


def check_whisper():
    """
    检测本地语音识别组件是否可用。
    v0.9.8: 优先使用 local-tools/whisper/ 内置路径，再 fallback 到配置文件 / PATH。
    返回 (ok: bool, info: dict|None, reason: str)
    """
    # 1) 优先检测项目内 local-tools/whisper/
    local_cli = _find_local_tool(
        ["whisper-cli.exe", "whisper-cli", "main.exe", "main"],
        "whisper"
    )
    # 2) 从 whisper.config.json 读取额外配置（语言、线程等）
    cfg = {}
    if WHISPER_CONFIG.exists():
        try:
            cfg = json.loads(WHISPER_CONFIG.read_text(encoding="utf-8"))
        except Exception:
            pass

    cli = local_cli or (cfg.get("whisperCliPath") or "whisper-cli").strip()

    # 3) 模型文件：优先 local-tools/whisper/models/
    local_model_dir = REPO_ROOT / "local-tools" / "whisper" / "models"
    local_model = None
    if local_model_dir.exists():
        for pattern in ("ggml-small.bin", "ggml-base.bin", "ggml-tiny.bin"):
            p = local_model_dir / pattern
            if p.exists():
                local_model = str(p)
                break
        if not local_model:
            # any ggml-*.bin
            for p in sorted(local_model_dir.glob("ggml-*.bin")):
                local_model = str(p); break
    if not local_model:
        model_raw = (cfg.get("modelPath") or "").strip()
        if model_raw:
            mp = Path(model_raw)
            if not mp.is_absolute():
                mp = REPO_ROOT / model_raw
            if mp.exists():
                local_model = str(mp)

    # 4) ffmpeg 可用性（优先 local-tools/ffmpeg/）
    local_ff = _find_local_tool(["ffmpeg.exe", "ffmpeg"], "ffmpeg")
    ff_ok = bool(local_ff) or bool(shutil.which("ffmpeg"))
    if not ff_ok:
        return False, None, "未找到 ffmpeg（local-tools/ffmpeg/ 或系统 PATH）"

    cli_ok = bool(shutil.which(cli)) or Path(cli).exists()
    if not cli_ok:
        return False, None, f"未找到 whisper-cli（{cli}）；请将 whisper-cli 放入 local-tools/whisper/ 目录"
    if not local_model:
        return False, None, "未找到 whisper 模型文件；请将 ggml-*.bin 放入 local-tools/whisper/models/"

    ff_cmd = local_ff or "ffmpeg"
    return True, {
        "cli": cli,
        "model": local_model,
        "ffmpeg": ff_cmd,
        "language": cfg.get("language", "zh"),
        "threads": int(cfg.get("threads", 4) or 4),
    }, ""


def _parse_srt(text):
    """解析 SRT 文本 → [(start_sec, end_sec, text), ...]"""
    segs = []
    for block in re.split(r"\n\s*\n", text.strip()):
        lines = [l for l in block.strip().splitlines()]
        if len(lines) < 2:
            continue
        tl_idx = next((i for i, l in enumerate(lines) if "-->" in l), None)
        if tl_idx is None:
            continue
        m = re.search(
            r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)",
            lines[tl_idx])
        if not m:
            continue
        sh, sm, ss, sms, eh, em, es, ems = (int(x) for x in m.groups())
        start = sh * 3600 + sm * 60 + ss + sms / 1000.0
        end   = eh * 3600 + em * 60 + es + ems / 1000.0
        txt = " ".join(lines[tl_idx + 1:]).strip()
        if end > start:
            segs.append((start, end, txt))
    return segs


def run_whisper(audio_path, info):
    """把配音转 16k 单声道 WAV，调用 whisper-cli 识别，返回 [(start,end,text), ...]。"""
    tmpdir = Path(tempfile.mkdtemp(prefix="align_"))
    ff_cmd = info.get("ffmpeg") or "ffmpeg"
    try:
        wav = tmpdir / "audio16k.wav"
        subprocess.run(
            [ff_cmd, "-y", "-i", str(audio_path),
             "-ar", "16000", "-ac", "1", str(wav)],
            capture_output=True, check=True, timeout=300)
        out_prefix = tmpdir / "out"
        cmd = [info["cli"], "-m", info["model"], "-f", str(wav),
               "-l", info["language"], "-t", str(info["threads"]),
               "-osrt", "-of", str(out_prefix)]
        subprocess.run(cmd, capture_output=True, check=True, timeout=600)
        srt = out_prefix.with_suffix(".srt")
        if not srt.exists():
            return []
        return _parse_srt(srt.read_text(encoding="utf-8", errors="replace"))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _visible_len(s):
    """字幕可见字符数（忽略空白与换行），最少 1。"""
    return max(1, len(re.sub(r"\s+", "", s or "")))


def _split_script_to_subs(script):
    """没有 finalSubtitles 时，按标点/换行把字幕稿粗切成句（仅用于提供文本顺序）。"""
    subs = []
    for line in (script or "").strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        for part in re.split(r"(?<=[。！？；…])", line):
            part = part.strip()
            if not part:
                continue
            if len(part) > 20:
                for sp in re.split(r"(?<=[，、：])", part):
                    sp = sp.strip()
                    while len(sp) > 20:
                        subs.append(sp[:20]); sp = sp[20:]
                    if sp:
                        subs.append(sp)
            else:
                subs.append(part)
    base = int(datetime.now().timestamp() * 1000)
    return [{"id": f"sub-{base}-{i}", "start": 0, "end": 0, "text": t}
            for i, t in enumerate(subs)]


def align_subs_to_speech(user_subs, segs):
    """
    用 whisper 识别片段提供的真实时间轴，按字符占比把时间分配给用户字幕。
    保留用户字幕文本，仅更新 start/end。比"按时长平均分配"更贴近真实配音节奏。
    """
    if not segs or not user_subs:
        return None
    seg_lens = [_visible_len(t) for (_, _, t) in segs]
    total_chars = sum(seg_lens)
    seg_start_c, c = [], 0
    for L in seg_lens:
        seg_start_c.append(c); c += L
    speech_end = segs[-1][1]

    def time_at(cp):
        for i, (s, e, _) in enumerate(segs):
            base_c, L = seg_start_c[i], seg_lens[i]
            if cp <= base_c + L or i == len(segs) - 1:
                frac = min(1.0, max(0.0, (cp - base_c) / L))
                return s + (e - s) * frac
        return speech_end

    u_lens = [_visible_len(s.get("text", "")) for s in user_subs]
    u_total = sum(u_lens) or 1
    out, uc = [], 0
    for i, sub in enumerate(user_subs):
        cp_start = uc / u_total * total_chars
        uc += u_lens[i]
        cp_end = uc / u_total * total_chars
        st = time_at(cp_start)
        en = time_at(cp_end)
        if en <= st:
            en = st + 0.4
        out.append({**sub, "start": round(st, 2), "end": round(en, 2)})
    # 保证时间单调递增、不重叠
    for i in range(1, len(out)):
        if out[i]["start"] < out[i - 1]["end"]:
            out[i]["start"] = out[i - 1]["end"]
        if out[i]["end"] <= out[i]["start"]:
            out[i]["end"] = round(out[i]["start"] + 0.4, 2)
    return out


# ── v0.9.10: 剪映草稿路径推断 + 打开剪映 / 打开目录 ─────────────────────────

# 默认剪映草稿根目录（JianyingPro 通用位置）
JIANYING_DRAFT_ROOT = Path.home() / "AppData" / "Local" / "JianyingPro" / "User Data" / "Projects" / "com.lveditor.draft"


def _resolve_jianying_draft_dir(stdout_text, hint_name=None):
    """
    从 export_with_jianying.py 的 stdout 推断草稿目录。
    优先解析 `[草稿名称] <name>` 这一行；再用 hint_name 或解析到的 name
    在 JIANYING_DRAFT_ROOT 下拼出目录路径。
    返回 (name, dir_path_str)；dir_path_str 不存在也照样返回（前端可容错）。
    """
    parsed_name = (hint_name or "").strip() or None
    if not parsed_name:
        for line in (stdout_text or "").splitlines():
            m = re.match(r"^\[草稿名称\]\s*(.+?)\s*$", line.strip())
            if m:
                parsed_name = m.group(1).strip()
                break
    dir_str = ""
    if parsed_name:
        candidate = JIANYING_DRAFT_ROOT / parsed_name
        # 兼容 "JianyingPro" 也可能装到 Program Files；先看根目录在不在
        if not JIANYING_DRAFT_ROOT.exists():
            # 根目录不存在时，仍按规则返回推断路径（前端可显示但打开会失败，给清晰错误）
            dir_str = str(candidate)
        else:
            dir_str = str(candidate)
    return parsed_name, dir_str


def _find_jianying_exe():
    """
    探测本机 JianyingPro.exe 路径。返回 Path 或 None。
    仅做"启动剪映软件"用途，不去研究任何剪映协议。
    """
    candidates = []
    # 1) 优先探测当前用户 AppData
    candidates.append(Path.home() / "AppData" / "Local" / "JianyingPro" / "JianyingPro.exe")
    # 2) Program Files / (x86) 的常见安装位
    for pf in (r"C:/Program Files", r"C:/Program Files (x86)"):
        base = Path(pf)
        if not base.exists():
            continue
        # 直接 JianyingPro 子目录
        candidates.append(base / "JianyingPro" / "JianyingPro.exe")
        # 也扫一下 JianyingPro* 开头、JianyingPro 4.x、JianyingPro 5.x 等
        try:
            for entry in base.iterdir():
                if entry.is_dir() and entry.name.lower().startswith("jianyingpro"):
                    candidates.append(entry / "JianyingPro.exe")
        except Exception:
            pass
    # 3) 兜底：roaming 之类
    for c in candidates:
        try:
            if c.exists() and c.is_file():
                return c
        except Exception:
            continue
    return None


def _is_safe_open_path(p: Path):
    """
    /open-path 的安全闸门：只允许打开以下三类目录，避开系统/用户根目录。
    1) 剪映草稿根目录及其子目录
    2) 项目 export_workspace 及其子目录
    3) 用户桌面（避免误开时仍能到合理位置）
    """
    try:
        ap = p.resolve()
    except Exception:
        return False
    if not ap.exists() or not ap.is_dir():
        return False
    # Windows 不区分大小写
    def starts_with_case_insensitive(parent: Path, child: Path):
        try:
            return str(child).lower().startswith(str(parent).lower())
        except Exception:
            return False
    safe_parents = []
    if JIANYING_DRAFT_ROOT.exists():
        safe_parents.append(JIANYING_DRAFT_ROOT)
    safe_parents.append((REPO_ROOT / "export_workspace").resolve())
    desktop = Path.home() / "Desktop"
    if desktop.exists():
        safe_parents.append(desktop)
    for sp in safe_parents:
        if starts_with_case_insensitive(sp, ap):
            return True
    return False


class ExportHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[服务] {fmt % args}", flush=True)

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            w_ok, w_info, w_reason = check_whisper()
            local_ff = _find_local_tool(["ffmpeg.exe", "ffmpeg"], "ffmpeg")
            self._json({
                "ok": True,
                "service": "shipin-cut-local-export",
                "version": "0.9.8",
                "whisper": {
                    "available": w_ok,
                    "reason": w_reason,
                    "cli": w_info.get("cli", "") if w_info else "",
                    "model": w_info.get("model", "") if w_info else "",
                },
                "ffmpeg": {
                    "path": local_ff or "系统 PATH",
                    "local": bool(local_ff),
                },
            })
        elif self.path == "/synced-files":
            VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
            AUDIO_DIR.mkdir(parents=True, exist_ok=True)
            vids = [f.name for f in VIDEOS_DIR.iterdir()
                    if f.is_file() and f.suffix.lower() in VIDEO_EXTS]
            auds = [f.name for f in AUDIO_DIR.iterdir()
                    if f.is_file() and f.suffix.lower() in AUDIO_EXTS]
            self._json({"ok": True, "videos": sorted(vids), "audio": sorted(auds)})
        else:
            self._json({"ok": False, "error": "not found"}, 404)

    def _handle_upload(self, kind):
        """kind: 'video' | 'audio'。接收 multipart/form-data，保存到对应目录。"""
        ctype = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in ctype:
            self._json({"ok": False, "error": "需要 multipart/form-data"})
            return
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        fields, files = parse_multipart(body, ctype)
        if "file" not in files:
            self._json({"ok": False, "error": "缺少 file 字段"})
            return
        up = files["file"]
        original = fields.get("originalName") or up["filename"] or "file"
        if kind == "video":
            target_dir, prefix, default_ext = VIDEOS_DIR, "video", ".mp4"
        elif kind == "bgm":
            target_dir, prefix, default_ext = AUDIO_DIR, "bgm", ".mp3"
        elif kind == "image":
            target_dir, prefix, default_ext = IMAGES_DIR, "img", ".jpg"
        else:
            target_dir, prefix, default_ext = AUDIO_DIR, "audio", ".mp3"
        target_dir.mkdir(parents=True, exist_ok=True)
        stored = safe_stored_name(original, prefix, default_ext)
        dest = target_dir / stored
        try:
            with open(dest, "wb") as f:
                f.write(up["content"])
        except Exception as e:
            self._json({"ok": False, "error": f"保存文件失败: {e}"})
            return
        size = dest.stat().st_size
        kind_label = '视频' if kind=='video' else ('背景音乐' if kind=='bgm' else '配音')
        print(f"[服务] 已同步{kind_label}：{original} → {stored} ({size/1024/1024:.1f} MB)", flush=True)
        self._json({
            "ok": True,
            "type": kind,
            "fileName": stored,
            "originalName": original,
            "storedPath": str(dest),
            "size": size,
        })

    def _handle_align(self):
        """v0.9.7: 用本条配音做本地语音识别，对齐 finalSubtitles 的时间轴。"""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._json({"ok": False, "error": f"JSON 解析失败: {e}"})
            return

        # 1) 本地识别组件是否可用——不可用时明确告知，绝不假装对齐
        ok, info, reason = check_whisper()
        if not ok:
            self._json({
                "ok": False,
                "engine": "unavailable",
                "error": reason,
                "message": f"当前未安装本地语音识别组件，无法自动对齐：{reason}",
            })
            return

        # 2) 定位本条配音文件
        voice = data.get("voice") or {}
        names = [voice.get(k) for k in ("storedFileName", "fileName", "originalName")
                 if isinstance(voice, dict) and voice.get(k)]
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        audio_map = {f.name.lower(): f for f in AUDIO_DIR.iterdir()
                     if f.is_file() and f.suffix.lower() in AUDIO_EXTS}
        apath = None
        for n in names:
            if n and n.lower() in audio_map:
                apath = audio_map[n.lower()]
                break
        if apath is None:
            self._json({"ok": False,
                        "error": "未找到本条配音文件，请先在精修页导入并同步配音到本地服务。"})
            return

        # 3) 准备用户字幕文本（优先 finalSubtitles，其次字幕稿）
        user_subs = data.get("finalSubtitles") or []
        from_script = False
        if not user_subs:
            script = (data.get("summaryScript") or "").strip()
            if not script:
                self._json({"ok": False,
                            "error": "没有成品字幕或字幕稿，无法对齐。请先保存最终字幕稿或生成成品字幕。"})
                return
            user_subs = _split_script_to_subs(script)
            from_script = True
            if not user_subs:
                self._json({"ok": False, "error": "字幕稿切分结果为空，无法对齐。"})
                return

        # 4) 本地识别
        print(f"[服务] 自动对齐：识别配音 {apath.name} ...", flush=True)
        try:
            segs = run_whisper(apath, info)
        except subprocess.TimeoutExpired:
            self._json({"ok": False, "error": "语音识别超时，请尝试更短的配音或更小的模型。"})
            return
        except Exception as e:
            self._json({"ok": False, "error": f"语音识别失败：{e}"})
            return
        if not segs:
            self._json({"ok": False,
                        "error": "语音识别未得到有效结果，请检查本条配音文件是否完好。"})
            return

        aligned = align_subs_to_speech(user_subs, segs)
        if not aligned:
            self._json({"ok": False, "error": "对齐失败：识别结果与字幕无法匹配。"})
            return

        mismatch = (len(segs) != len(user_subs))
        msg = f"已根据本条配音自动对齐 {len(aligned)} 条字幕。"
        if from_script:
            msg += " （字幕由字幕稿切分生成）"
        if mismatch:
            msg += " 识别段数与字幕句数不完全一致，已按顺序自动匹配，可少量微调。"
        engine = f"whisper.cpp({Path(info['model']).name})"
        print(f"[服务] 自动对齐完成：{len(aligned)} 条，引擎 {engine}", flush=True)
        self._json({
            "ok": True,
            "subtitles": aligned,
            "engine": engine,
            "mismatch": mismatch,
            "segCount": len(segs),
            "message": msg,
        })

    def _handle_transcribe_video(self):
        """v0.9.9: 对已同步到 videos/ 的视频做字幕识别，返回真实字幕片段列表。"""
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._json({"ok": False, "error": f"JSON 解析失败: {e}"})
            return

        stored_file = data.get("storedFile", "").strip()
        if not stored_file:
            self._json({"ok": False, "error": "缺少 storedFile 参数"})
            return

        VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
        video_path = VIDEOS_DIR / stored_file
        if not video_path.exists():
            self._json({"ok": False, "error": f"视频文件不存在: {stored_file}（请确认已上传到 export_workspace/videos/）"})
            return

        ok, info, reason = check_whisper()
        if not ok:
            self._json({"ok": False, "error": reason, "whisperReason": reason})
            return

        print(f"[服务] 开始识别字幕：{stored_file}", flush=True)
        try:
            segs = run_whisper(str(video_path), info)
        except subprocess.CalledProcessError as e:
            self._json({"ok": False, "error": f"whisper-cli 运行失败: {e}"})
            return
        except Exception as e:
            self._json({"ok": False, "error": f"识别过程出错: {e}"})
            return

        segments = [
            {"id": i + 1, "start": round(s, 3), "end": round(e, 3), "text": t.strip()}
            for i, (s, e, t) in enumerate(segs)
            if t.strip()
        ]
        print(f"[服务] 识别完成：{stored_file} → {len(segments)} 条字幕", flush=True)
        self._json({"ok": True, "segments": segments, "count": len(segments)})

    def do_POST(self):
        if self.path == "/upload-video":
            self._handle_upload("video")
            return
        if self.path == "/upload-audio":
            self._handle_upload("audio")
            return
        if self.path == "/upload-bgm":
            self._handle_upload("bgm")
            return
        if self.path == "/upload-image":
            self._handle_upload("image")
            return
        if self.path == "/align-subtitles":
            self._handle_align()
            return
        if self.path == "/transcribe-video":
            self._handle_transcribe_video()
            return
        if self.path == "/export-jianying":
            # 接收 {mp4, srt?, name?} 生成剪映草稿
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body)
            except Exception as e:
                self._json({"ok": False, "error": f"JSON 解析失败: {e}"})
                return
            mp4_path = data.get("mp4", "")
            srt_path = data.get("srt") or None
            draft_name = data.get("name") or None
            if not mp4_path:
                self._json({"ok": False, "error": "缺少 mp4 参数"})
                return
            if not Path(mp4_path).exists():
                self._json({"ok": False, "error": f"MP4 文件不存在: {mp4_path}"})
                return
            jianying_script = SCRIPT_DIR / "export_with_jianying.py"
            if not jianying_script.exists():
                self._json({"ok": False, "error": "export_with_jianying.py 不存在"})
                return
            # 使用 pyjianying_probe venv
            venv_python = REPO_ROOT / "tmp" / "pyjianying_probe" / ".venv" / "Scripts" / "python"
            cmd = [str(venv_python), str(jianying_script), "--mp4", mp4_path]
            if srt_path:
                cmd += ["--srt", srt_path]
            if draft_name:
                cmd += ["--name", draft_name]
            print(f"[服务] 生成剪映草稿：{cmd}", flush=True)
            try:
                result = subprocess.run(
                    cmd, capture_output=True, text=True,
                    encoding="utf-8", errors="replace", timeout=120,
                )
            except Exception as e:
                self._json({"ok": False, "error": f"调用失败: {e}"})
                return
            if result.returncode == 0:
                # v0.9.10: 解析草稿名 + 推断草稿路径，给前端用
                parsed_name, draft_dir = _resolve_jianying_draft_dir(
                    result.stdout or "", draft_name,
                )
                self._json({
                    "ok": True,
                    "message": "剪映草稿生成成功，请在剪映中刷新查看",
                    "draftName": parsed_name or "",
                    "draftPath": draft_dir or "",
                })
            else:
                self._json({"ok": False, "error": result.stderr or "生成失败"})
            return
        if self.path == "/open-jianying":
            # 打开剪映软件（不直接打开指定草稿）
            self._handle_open_jianying()
            return
        if self.path == "/open-path":
            # 在资源管理器中打开一个目录（仅限允许的目录）
            self._handle_open_path()
            return
        if self.path != "/export":
            self._json({"ok": False, "error": "not found"}, 404)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        try:
            data = json.loads(body)
        except Exception as e:
            self._json({"ok": False, "error": f"JSON 解析失败: {e}"})
            return

        if data.get("type") != "refine-plan":
            self._json({"ok": False, "error": "不是有效的 refine-plan JSON（type 字段不对）"})
            return

        # 保存草稿
        DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
        draft_path = DRAFTS_DIR / CURRENT_DRAFT
        try:
            with open(draft_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            self._json({"ok": False, "error": f"保存草稿失败: {e}"})
            return

        comp_name = data.get("compositionName", "?")
        seg_count = len(data.get("derivedTimeline", []))
        print(f"[服务] 已收到草稿：{comp_name}，{seg_count} 个片段", flush=True)
        print(f"[服务] 开始调用 FFmpeg 生成视频...", flush=True)

        # 调用 export_video.py
        try:
            result = subprocess.run(
                [sys.executable, str(EXPORT_SCRIPT), str(draft_path)],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=600,
            )
        except subprocess.TimeoutExpired:
            self._json({"ok": False, "error": "生成超时（超过10分钟），请检查视频文件是否过大。"})
            return
        except Exception as e:
            self._json({"ok": False, "error": f"调用导出脚本失败: {e}"})
            return

        stdout = result.stdout or ""
        stderr = result.stderr or ""

        # 打印脚本输出到服务窗口
        for line in stdout.splitlines():
            print(f"  {line}", flush=True)
        for line in stderr.splitlines():
            print(f"  [ERR] {line}", flush=True)

        # 从 stdout 提取输出文件路径
        output_file = None
        for line in stdout.splitlines():
            if "完成！输出文件:" in line:
                parts = line.split("完成！输出文件:")
                if len(parts) > 1:
                    output_file = parts[1].strip().split("  ")[0].strip()

        # 兜底：stdout 未解析到路径时，扫描 export_workspace/output/ 找最新且非空的 mp4
        if not output_file:
            out_dir = WORKSPACE / "output"
            if out_dir.exists():
                mp4s = sorted(
                    (p for p in out_dir.glob("*.mp4") if p.stat().st_size > 0),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )
                if mp4s:
                    output_file = str(mp4s[0])

        # 把相对路径转成绝对路径，并校验存在 + size > 0
        final_output = None
        if output_file:
            p = Path(output_file)
            if not p.is_absolute():
                p = REPO_ROOT / output_file
            if p.exists() and p.stat().st_size > 0:
                final_output = str(p)

        # 成功判定：returncode == 0 且 最终成品 mp4 存在且 size > 0
        if result.returncode == 0 and final_output:
            print(f"[服务] 生成成功：{final_output}", flush=True)
            # 尝试找对应的 SRT 文件
            srt_path = None
            srt_dir = REPO_ROOT / "local-output" / "subtitles"
            if srt_dir.exists():
                mp4_stem = Path(final_output).stem
                # 从 subtitle-manifest.json 匹配
                manifest_path = srt_dir / "subtitle-manifest.json"
                if manifest_path.exists():
                    try:
                        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                        for item in manifest.get("items", []):
                            vname = item.get("videoFilename", "")
                            if Path(vname).stem in mp4_stem or mp4_stem in Path(vname).stem:
                                srt_rel = item.get("srt", "")
                                srt_candidate = REPO_ROOT / srt_rel
                                if srt_candidate.exists():
                                    srt_path = str(srt_candidate)
                                    break
                    except Exception:
                        pass
                # fallback：直接查找同名 srt
                if not srt_path:
                    for ext in (".srt", ".SRT"):
                        candidate = srt_dir / (mp4_stem + ext)
                        if candidate.exists():
                            srt_path = str(candidate)
                            break
            self._json({
                "ok": True,
                "output": final_output,
                "srt": srt_path,
                "message": f"生成成功！成品视频已保存到 {final_output}",
            })
        else:
            # 失败：提取可读错误信息，但要排除 ffmpeg 正常编码日志
            NOISE_PATTERNS = (
                "libx264", "Weighted P-Frames", "ref P L0", "ref B L0",
                "kb/s", "Lsize", "frame=", "muxing overhead",
            )
            def _is_noise(line):
                s = line.strip()
                if not s:
                    return True
                return any(p in s for p in NOISE_PATTERNS)

            error_lines = [l for l in (stdout + "\n" + stderr).splitlines()
                           if "[ERROR]" in l]
            if error_lines:
                error_msg = "\n".join(l.replace("[ERROR]", "").strip() for l in error_lines)
            else:
                meaningful = [l for l in stderr.splitlines() if not _is_noise(l)]
                if meaningful:
                    error_msg = "\n".join(meaningful).strip()[-400:]
                else:
                    if result.returncode != 0:
                        error_msg = (
                            f"FFmpeg/脚本退出码非 0（{result.returncode}），"
                            "请查看服务窗口中的日志。"
                        )
                    else:
                        error_msg = (
                            "生成失败：未在输出目录找到成品视频，请查看服务窗口中的日志。"
                        )
            print(f"[服务] 生成失败：{error_msg}", flush=True)
            self._json({"ok": False, "error": error_msg})

    # ── v0.9.10: 打开剪映软件（不研究剪映协议，只负责启动 exe） ────────────────
    def _handle_open_jianying(self):
        exepath = _find_jianying_exe()
        if not exepath:
            self._json({
                "ok": False,
                "error": "未找到剪映安装路径，请手动打开剪映。",
                "hint": "在常见安装位置未探测到 JianyingPro.exe（已检查 %LocalAppData% 与 Program Files）。",
            })
            return
        try:
            # 非阻塞启动，进程独立；服务不被拖住
            subprocess.Popen(
                [str(exepath)],
                cwd=str(exepath.parent),
                shell=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                close_fds=True,
            )
        except Exception as e:
            self._json({"ok": False, "error": f"启动剪映失败：{e}"})
            return
        print(f"[服务] 已尝试启动剪映：{exepath}", flush=True)
        self._json({"ok": True, "message": f"已尝试打开剪映（{exepath.name}）", "exe": str(exepath)})

    # ── v0.9.10: 在资源管理器中打开一个目录（白名单闸门） ──────────────────────
    def _handle_open_path(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        try:
            data = json.loads(body)
        except Exception as e:
            self._json({"ok": False, "error": f"JSON 解析失败: {e}"})
            return
        target = (data.get("path") or "").strip()
        if not target:
            self._json({"ok": False, "error": "缺少 path 参数"})
            return
        p = Path(target)
        if not _is_safe_open_path(p):
            self._json({
                "ok": False,
                "error": "目标目录不存在或不在允许范围（仅允许剪映草稿 / 项目 export_workspace / 桌面）。",
            })
            return
        try:
            # Windows: os.startfile 会用资源管理器打开目录
            os.startfile(str(p))  # noqa: only on Windows; 服务仅在 Windows 跑
        except Exception as e:
            self._json({"ok": False, "error": f"打开目录失败：{e}"})
            return
        print(f"[服务] 已打开目录：{p}", flush=True)
        self._json({"ok": True, "message": f"已打开：{p}", "path": str(p)})


def main():
    server = HTTPServer((HOST, PORT), ExportHandler)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    DRAFTS_DIR.mkdir(parents=True, exist_ok=True)
    print("=" * 56, flush=True)
    print(" shipin-cut v0.9.3  本地导出服务", flush=True)
    print("=" * 56, flush=True)
    print(f" 地址: http://{HOST}:{PORT}", flush=True)
    print(" 网页导入素材会自动同步到 videos/ 和 audio/", flush=True)
    print(" 请回到网页点击「导出成品视频」", flush=True)
    print(" 按 Ctrl+C 可停止服务", flush=True)
    print("=" * 56, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[shipin-cut] 服务已停止", flush=True)


if __name__ == "__main__":
    main()
