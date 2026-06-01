#!/usr/bin/env python3
"""
shipin-cut v0.9.3 — 本地导出服务
用法: python local_export_server.py
     启动后监听 http://127.0.0.1:8765
     - 网页导入原视频时自动 POST 到 /upload-video（同步到 videos/）
     - 精修页导入配音时自动 POST 到 /upload-audio（同步到 audio/）
     - 网页点击"导出成品视频"时 POST 草稿 JSON 到 /export
"""

import sys
import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

SCRIPT_DIR    = Path(__file__).resolve().parent
WORKSPACE     = SCRIPT_DIR.parent / "export_workspace"
DRAFTS_DIR    = WORKSPACE / "drafts"
VIDEOS_DIR    = WORKSPACE / "videos"
AUDIO_DIR     = WORKSPACE / "audio"
EXPORT_SCRIPT = SCRIPT_DIR / "export_video.py"
CURRENT_DRAFT = "web-export-current.json"

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
            self._json({"ok": True, "service": "shipin-cut-local-export", "version": "0.9.3"})
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

        if result.returncode == 0 and output_file:
            print(f"[服务] 生成成功：{output_file}", flush=True)
            self._json({
                "ok": True,
                "output": output_file,
                "message": f"生成成功！成品视频已保存到 {output_file}",
            })
        else:
            # 提取用户可读的错误信息
            error_lines = [l for l in (stdout + "\n" + stderr).splitlines()
                           if "[ERROR]" in l]
            if error_lines:
                error_msg = "\n".join(l.replace("[ERROR]", "").strip() for l in error_lines)
            elif stderr.strip():
                error_msg = stderr.strip()[-400:]
            else:
                error_msg = "生成失败，请查看服务窗口中的日志。"
            print(f"[服务] 生成失败：{error_msg}", flush=True)
            self._json({"ok": False, "error": error_msg})


def main():
    server = HTTPServer((HOST, PORT), ExportHandler)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
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
