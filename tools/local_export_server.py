#!/usr/bin/env python3
"""
shipin-cut v0.9.1 — 本地导出服务
用法: python local_export_server.py
     启动后监听 http://127.0.0.1:8765
     网页点击"导出成品视频"时自动 POST 草稿 JSON 到 /export
"""

import sys
import json
import subprocess
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler

SCRIPT_DIR    = Path(__file__).resolve().parent
WORKSPACE     = SCRIPT_DIR.parent / "export_workspace"
DRAFTS_DIR    = WORKSPACE / "drafts"
EXPORT_SCRIPT = SCRIPT_DIR / "export_video.py"
CURRENT_DRAFT = "web-export-current.json"

HOST = "127.0.0.1"
PORT = 8765


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
            self._json({"ok": True, "service": "shipin-cut-local-export", "version": "0.9.1"})
        else:
            self._json({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
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
    print("=" * 56, flush=True)
    print(" shipin-cut v0.9.1  本地导出服务", flush=True)
    print("=" * 56, flush=True)
    print(f" 地址: http://{HOST}:{PORT}", flush=True)
    print(" 请回到网页点击「导出成品视频」", flush=True)
    print(" 按 Ctrl+C 可停止服务", flush=True)
    print("=" * 56, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[shipin-cut] 服务已停止", flush=True)


if __name__ == "__main__":
    main()
