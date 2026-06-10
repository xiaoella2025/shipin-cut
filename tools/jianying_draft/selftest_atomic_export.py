#!/usr/bin/env python3
"""
selftest_atomic_export.py — 不依赖真实剪映 / 真实 pyJianYingDraft 的端到端自检。

通过注入一个 mock pyJianYingDraft 包，运行真实的 export_with_pyjianying.py，验证：
  1. 成功导出时：临时目录 MIXCUT_TMP_* 被改名为正式草稿名，且无残留临时目录。
  2. 失败导出时（字幕条数与期望不符 / 视频时长异常）：不产生正式草稿，临时目录被清理。
  3. 末条字幕即使 end 超过视频时长也被写入（clamp），写入条数 == 有效条数。

用法: python tools/jianying_draft/selftest_atomic_export.py
退出码 0 表示全部通过。
"""

import json
import os
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "export_with_pyjianying.py"


def make_mock_pkg(mock_root, video_dur_us):
    """生成一个最小可用的 mock pyJianYingDraft 包。"""
    pkg = mock_root / "pyJianYingDraft"
    pkg.mkdir(parents=True, exist_ok=True)
    (pkg / "__init__.py").write_text(textwrap.dedent(f"""
        import json, os

        VIDEO_DUR = {video_dur_us}

        class TrackType:
            video = "video"
            text = "text"

        class Timerange:
            def __init__(self, start=0, duration=0):
                self.start = start
                self.duration = duration

        class VideoMaterial:
            def __init__(self, path, material_name=None):
                self.path = path
                self.material_name = material_name or os.path.basename(path)
                self.duration = VIDEO_DUR
                self.width = 1920
                self.height = 1080

        class VideoSegment:
            def __init__(self, material=None, target_timerange=None):
                self.material = material
                self.target_timerange = target_timerange

        class TextSegment:
            def __init__(self, text="", timerange=None):
                self.text = text
                self.timerange = timerange

        class _ScriptFile:
            def __init__(self, draft_dir):
                self.draft_dir = draft_dir
                self.tracks = {{}}
                self.materials = {{"videos": [], "texts": []}}
            def add_track(self, ttype, name):
                self.tracks[name] = {{"type": ttype, "segments": []}}
            def add_material(self, mat):
                self.materials["videos"].append({{"name": getattr(mat, 'material_name', '')}})
            def add_segment(self, seg, track_name=None):
                self.tracks[track_name]["segments"].append(seg)
                if track_name and self.tracks[track_name]["type"] == "text":
                    self.materials["texts"].append({{"content": getattr(seg, 'text', '')}})
            def save(self):
                content = {{
                    "id": "MOCK-TIMELINE-ID",
                    "duration": VIDEO_DUR,
                    "platform": {{"app_source": "lv", "app_version": "mock", "os": "windows"}},
                    "tracks": [{{"type": t["type"]}} for t in self.tracks.values()],
                    "materials": self.materials,
                }}
                with open(os.path.join(self.draft_dir, 'draft_content.json'), 'w', encoding='utf-8') as f:
                    json.dump(content, f, ensure_ascii=False, indent=2)

        class DraftFolder:
            def __init__(self, drafts_dir):
                self.drafts_dir = drafts_dir
            def create_draft(self, name, width=1920, height=1080, fps=30, allow_replace=True):
                d = os.path.join(self.drafts_dir, name)
                os.makedirs(d, exist_ok=True)
                meta = {{"draft_name": name, "draft_id": "", "draft_fold_path": d}}
                with open(os.path.join(d, 'draft_meta_info.json'), 'w', encoding='utf-8') as f:
                    json.dump(meta, f, ensure_ascii=False, indent=2)
                return _ScriptFile(d)
    """), encoding="utf-8")
    return mock_root


def run_export(drafts_dir, mock_root, video, srt=None, name="SELFTEST_DRAFT", expected_subs=None):
    env = dict(os.environ)
    env["PYTHONPATH"] = str(mock_root) + os.pathsep + env.get("PYTHONPATH", "")
    cmd = [sys.executable, str(SCRIPT), "--video", str(video),
           "--name", name, "--drafts-dir", str(drafts_dir)]
    if srt:
        cmd += ["--srt", str(srt)]
    if expected_subs is not None:
        cmd += ["--expected-subs", str(expected_subs)]
    r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=60)
    return r


def list_drafts(drafts_dir):
    return sorted(p.name for p in Path(drafts_dir).iterdir() if p.is_dir())


def main():
    failures = []
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        drafts_dir = tmp / "drafts"; drafts_dir.mkdir()
        mock_root = make_mock_pkg(tmp / "mock", video_dur_us=50_000_000)  # 50s 视频
        video = tmp / "clean.mp4"; video.write_bytes(b"\x00" * 1024)

        # SRT：3 条，最后一条 end=55s 超过 50s 视频时长（应被 clamp 仍写入）
        srt = tmp / "subs.srt"
        srt.write_text(
            "1\n00:00:01,000 --> 00:00:06,000\n第一句\n\n"
            "2\n00:00:08,000 --> 00:00:14,000\n第二句\n\n"
            "3\n00:00:48,000 --> 00:00:55,000\n最后一句 1-4\n",
            encoding="utf-8")

        # ── 测试 1：成功导出，末条字幕被 clamp 后仍写入 ──
        r = run_export(drafts_dir, mock_root, video, srt, name="SELFTEST_OK", expected_subs=3)
        drafts = list_drafts(drafts_dir)
        if r.returncode != 0:
            failures.append(f"[T1] 期望成功但退出码={r.returncode}\nSTDOUT:\n{r.stdout}\nSTDERR:\n{r.stderr}")
        elif "SELFTEST_OK" not in drafts:
            failures.append(f"[T1] 正式草稿未生成，drafts={drafts}")
        elif any(d.startswith("MIXCUT_TMP_") for d in drafts):
            failures.append(f"[T1] 残留临时目录: {drafts}")
        else:
            content = json.loads((drafts_dir / "SELFTEST_OK" / "draft_content.json").read_text(encoding="utf-8"))
            n_text_mat = len(content["materials"]["texts"])
            if n_text_mat != 3:
                failures.append(f"[T1] 写入字幕条数={n_text_mat}，期望 3（末条 clamp 后应仍写入）")
            if "写入完成：3/3" not in r.stdout:
                failures.append(f"[T1] 日志未显示 3/3 写入：\n{r.stdout}")
            else:
                print("[T1] 通过：成功导出，3/3 字幕写入（末条已 clamp），无残留临时目录")

        # ── 测试 2：字幕条数与期望不符 → 失败 + 清理，不留正式草稿 ──
        r = run_export(drafts_dir, mock_root, video, srt, name="SELFTEST_MISMATCH", expected_subs=5)
        drafts = list_drafts(drafts_dir)
        if r.returncode == 0:
            failures.append(f"[T2] 期望失败（期望5条实际3条）但退出码=0")
        elif "SELFTEST_MISMATCH" in drafts:
            failures.append(f"[T2] 失败时仍留下正式草稿: {drafts}")
        elif any(d.startswith("MIXCUT_TMP_") for d in drafts):
            failures.append(f"[T2] 失败时残留临时目录: {drafts}")
        else:
            print("[T2] 通过：字幕条数不符判定失败，已清理临时目录，无损坏草稿")

        # ── 测试 3：视频时长异常（mock 0s）→ 失败 + 清理 ──
        mock_root0 = make_mock_pkg(tmp / "mock0", video_dur_us=0)
        r = run_export(drafts_dir, mock_root0, video, srt, name="SELFTEST_BADVIDEO", expected_subs=3)
        drafts = list_drafts(drafts_dir)
        if r.returncode == 0:
            failures.append(f"[T3] 期望失败（视频0时长）但退出码=0")
        elif "SELFTEST_BADVIDEO" in drafts:
            failures.append(f"[T3] 失败时仍留下正式草稿: {drafts}")
        elif any(d.startswith("MIXCUT_TMP_") for d in drafts):
            failures.append(f"[T3] 失败时残留临时目录: {drafts}")
        else:
            print("[T3] 通过：视频时长异常判定失败，已清理临时目录")

        # ── 测试 4：覆盖同名旧草稿不破坏（先建 OK 再重建 OK）──
        r = run_export(drafts_dir, mock_root, video, srt, name="SELFTEST_OK", expected_subs=3)
        drafts = list_drafts(drafts_dir)
        if r.returncode != 0 or "SELFTEST_OK" not in drafts or any(d.startswith("MIXCUT_TMP_") for d in drafts):
            failures.append(f"[T4] 覆盖同名草稿失败：rc={r.returncode} drafts={drafts}")
        else:
            print("[T4] 通过：覆盖同名旧草稿成功，无残留临时目录")

    print("-" * 50)
    if failures:
        print(f"自检失败 {len(failures)} 项：")
        for f in failures:
            print(f)
        sys.exit(1)
    print("全部自检通过 ✅")


if __name__ == "__main__":
    main()
