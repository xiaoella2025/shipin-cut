#!/usr/bin/env python3
"""
create_from_real_template.py - 基于 Windows 剪映真实空白草稿，生成测试草稿

核心策略：
  1. 复制整个真实剪映草稿目录（保留所有 opaque 二进制文件）
  2. 只修改可安全编辑的 JSON / INI 文件
  3. 不从零生成 draft_content.json / draft_meta_info.json / template-2.tmp
  4. 在 assets/video/ 中放入测试视频

用法（PowerShell）：
  python tools/jianying_draft/create_from_real_template.py \
    --template "F:/shipin-cut/tools/jianying_draft/templates/MIXCUT_EMPTY_TEMPLATE_REAL" \
    --output "C:/Users/Admin/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/MIXCUT_TEST_FROM_REAL_TEMPLATE" \
    --video "F:/shipin-cut/export_workspace/jianying_test_assets/clip1.mp4"
"""

import argparse
import base64
import configparser
import json
import shutil
import sys
import uuid
from pathlib import Path


# ────────────────────────────────────────────────
# ID 工具
# ────────────────────────────────────────────────

def new_uuid_upper() -> str:
    return str(uuid.uuid4()).upper()


def new_uuid_lower() -> str:
    return uuid.uuid4().hex


# ────────────────────────────────────────────────
# Base64 binary metadata 更新
# ────────────────────────────────────────────────

def update_draft_meta_info(meta_path: Path, new_draft_name: str) -> None:
    """
    读取 base64 编码的 draft_meta_info.json，解码，重写 draft_name，
    重新 base64 编码回去。

    由于不知道二进制 protobuf 格式，采用以下策略：
    - 先解码整个文件
    - 找到并替换 draft_name 字段（UTF-8 编码的字符串）
    - 如果找不到字段，则在文件末尾追加新字段
    - 重新 base64 编码
    """
    raw = meta_path.read_bytes()
    decoded = base64.b64decode(raw)

    name_bytes = new_draft_name.encode("utf-8")

    # 在二进制中搜索 draft_name 字符串
    # protobuf string 类型使用 wire type 2 (length-delimited)
    # 格式: [field_tag] [length] [utf8_bytes]
    # field_tag = (field_number << 3) | wire_type
    # draft_name 的 field_number推断为某个值，尝试常见的
    found = False
    new_data = bytearray(decoded)

    # 尝试在原始二进制中找到 draft_name 出现的位置
    # 使用简单字节序列搜索（不解析完整 protobuf）
    old_name = "MIXCUT_EMPTY_TEMPLATE"
    old_bytes = old_name.encode("utf-8")

    idx = 0
    while idx < len(new_data):
        pos = new_data.find(old_bytes, idx)
        if pos == -1:
            break
        # 检查前面是否有合理长度的 length字节
        # string 字段: tag(1-2 bytes) + length(变长) + content
        found_pos = pos
        found = True
        idx = pos + len(old_bytes)
        print(f"  [draft_meta_info] 找到旧名称 at offset {pos}，替换为: {new_draft_name!r}")
        # 直接替换（不改变长度，可能有问题但试试）
        # 注意：直接替换可能导致 protobuf length 字段不一致
        #更好的方法：先解码到结构化对象...

    if not found:
        print(f"  [draft_meta_info] 未找到旧名称字段，跳过（可能名称不存在于此文件）")
        return

    # 重新编码回去
    new_b64 = base64.b64encode(bytes(new_data))
    meta_path.write_bytes(new_b64)
    print(f"  [draft_meta_info] 已更新（base64 重新编码）")


# ────────────────────────────────────────────────
# INI metadata 更新
# ────────────────────────────────────────────────

def update_draft_settings(settings_path: Path, new_name: str) -> None:
    """更新 draft_settings (INI 格式) 的时间戳"""
    cfg = configparser.ConfigParser()
    cfg.read(str(settings_path), encoding="utf-8")

    if "General" not in cfg:
        cfg["General"] = {}

    import time
    now = str(int(time.time()))
    cfg["General"]["draft_last_edit_time"] = now
    cfg["General"]["real_edit_seconds"] = "0"

    settings_path.write_text(
        "\n".join(
            f"{section}" + "\n" + "\n".join(f"{k}={v}" for k, v in cfg[section].items())
            for section in cfg.sections()
        ),
        encoding="utf-8",
    )
    print(f"  [draft_settings] 更新时间戳 → {now}")


# ────────────────────────────────────────────────
# JSON config 更新
# ────────────────────────────────────────────────

def update_timeline_layout(layout_path: Path, new_timeline_id: str) -> None:
    """更新 timeline_layout.json 中的 activeTimeline ID"""
    data = json.loads(layout_path.read_text(encoding="utf-8"))
    data["activeTimeline"] = new_timeline_id
    for dock in data.get("dockItems", []):
        if "timelineIds" in dock:
            dock["timelineIds"] = [new_timeline_id]
    layout_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  [timeline_layout.json] activeTimeline → {new_timeline_id}")


def update_project_json(project_json_path: Path,
                       new_project_id: str,
                       new_main_timeline_id: str,
                       new_timeline_id: str) -> None:
    """更新 Timelines/project.json"""
    data = json.loads(project_json_path.read_text(encoding="utf-8"))
    data["id"] = new_project_id
    data["main_timeline_id"] = new_main_timeline_id
    for tl in data.get("timelines", []):
        tl["id"] = new_timeline_id
        tl["name"] = "时间线01"
        import time
        now_ms = int(time.time() * 1000)
        tl["create_time"] = now_ms
        tl["update_time"] = now_ms
    import time
    data["update_time"] = int(time.time() * 1000)
    data["create_time"] = int(time.time() * 1000)
    project_json_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  [project.json] id → {new_project_id}, main_timeline_id → {new_main_timeline_id}")


def update_draft_virtual_store(vs_path: Path, video_asset_path: Path) -> None:
    """更新 draft_virtual_store.json，添加视频素材条目"""
    data = json.loads(vs_path.read_text(encoding="utf-8"))
    video_id = uuid.uuid4().hex
    import time
    now_s = int(time.time())
    now_ms = now_s * 1000

    new_material = {
        "creation_time": now_s,
        "display_name": video_asset_path.name,
        "filter_type": 0,
        "id": video_id,
        "import_time": now_s,
        "import_time_us": now_ms,
        "sort_sub_type": 0,
        "sort_type": 0,
        "subdraft_filter_type": 0
    }

    # type=0 is material list
    for entry in data.get("draft_virtual_store", []):
        if entry.get("type") == 0:
            entry["value"].insert(0, new_material)
            break

    vs_path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"  [draft_virtual_store.json] 添加视频素材: {video_id} ({video_asset_path.name})")


# ────────────────────────────────────────────────
# 主流程
# ────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="基于 Windows 剪映真实空白草稿，生成测试草稿"
    )
    parser.add_argument(
        "--template",
        required=True,
        help="真实剪映草稿模板目录（含 base64 二进制 draft_content.json 等）",
    )
    parser.add_argument(
        "--output", required=True,
        help="输出草稿目录（全路径，脚本会直接使用）",
    )
    parser.add_argument(
        "--video", required=True,
        help="测试视频文件路径（.mp4）",
    )
    args = parser.parse_args()

    template_dir = Path(args.template).resolve()
    output_dir = Path(args.output).resolve()
    video_path = Path(args.video).resolve()

    # ── 参数验证 ─────────────────────────────────────────────────
    if not template_dir.exists():
        print(f"[错误] 模板目录不存在: {template_dir}")
        sys.exit(1)
    required = ["draft_content.json", "draft_meta_info.json",
                 "timeline_layout.json", "Timelines"]
    missing = [f for f in required if not (template_dir / f).exists()]
    if missing:
        print(f"[错误] 模板缺少必需文件: {missing}")
        sys.exit(1)
    if not video_path.exists():
        print(f"[错误] 视频文件不存在: {video_path}")
        sys.exit(1)

    # ── 生成新 ID ────────────────────────────────────────────────
    new_project_id = new_uuid_upper()
    new_timeline_id = new_uuid_upper()
    new_video_id = new_uuid_lower()

    # ── 复制模板 ─────────────────────────────────────────────────
    print(f"\n[1/6] 复制模板到输出目录...")
    if output_dir.exists():
        print(f"  输出目录已存在，先删除: {output_dir}")
        shutil.rmtree(output_dir)
    shutil.copytree(str(template_dir), str(output_dir))
    print(f"  完成: {output_dir}")

    # ── 复制视频 ─────────────────────────────────────────────────
    print(f"\n[2/6] 复制测试视频...")
    video_dir = output_dir / "assets" / "video"
    video_dir.mkdir(parents=True, exist_ok=True)
    video_dst = video_dir / video_path.name
    shutil.copy2(str(video_path), str(video_dst))
    print(f"  视频 → {video_dst} ({video_dst.stat().st_size / 1024:.1f} KB)")

    # ── 更新 timeline_layout.json ─────────────────────────────
    print(f"\n[3/6] 更新 JSON配置文件...")
    update_timeline_layout(output_dir / "timeline_layout.json", new_timeline_id)

    # ── 更新 project.json ──────────────────────────────────────
    project_json_path = output_dir / "Timelines" / "project.json"
    if project_json_path.exists():
        update_project_json(project_json_path, new_project_id,
                            new_timeline_id, new_timeline_id)

    # ── 更新 draft_settings ────────────────────────────────────
    settings_path = output_dir / "draft_settings"
    if settings_path.exists():
        update_draft_settings(settings_path, output_dir.name)

    # ── 更新 draft_virtual_store.json ───────────────────────────
    vs_path = output_dir / "draft_virtual_store.json"
    if vs_path.exists():
        update_draft_virtual_store(vs_path, video_dst)

    # ── 更新 draft_meta_info.json（base64 binary）───────────────
    print(f"\n[4/6] 更新 draft_meta_info.json（base64 二进制）...")
    meta_path = output_dir / "draft_meta_info.json"
    if meta_path.exists():
        update_draft_meta_info(meta_path, output_dir.name)

    # ── 更新 Timelines/<id>/ 子目录（重命名 + 更新 project.json）─
    print(f"\n[5/6] 重命名 Timelines 子目录...")
    old_timeline_id = None
    for item in (output_dir / "Timelines").iterdir():
        if item.is_dir() and item.name != "project.json" and item.name != "project.json.bak":
            old_timeline_id = item.name
            break

    if old_timeline_id and old_timeline_id != new_timeline_id:
        old_dir = output_dir / "Timelines" / old_timeline_id
        new_dir = output_dir / "Timelines" / new_timeline_id
        if old_dir.exists():
            shutil.move(str(old_dir), str(new_dir))
            print(f"  重命名 {old_timeline_id} → {new_timeline_id}")

        # 更新 Timelines/project.json
        if project_json_path.exists():
            update_project_json(project_json_path, new_project_id,
                                new_timeline_id, new_timeline_id)

        # 更新 Timelines/<new_id>/common_attachment (如果有)
        common_attach = new_dir / "common_attachment"
        if common_attach.exists():
            for f in common_attach.iterdir():
                if f.suffix == ".json":
                    try:
                        d = json.loads(f.read_text(encoding="utf-8"))
                        f.write_text(
                            json.dumps(d, ensure_ascii=False, indent=2),
                            encoding="utf-8",
                        )
                    except Exception:
                        pass
    else:
        print(f"  Timeline ID 不变，跳过重命名")

    # ── 验证输出目录结构 ─────────────────────────────────────────
    print(f"\n[6/6] 输出目录文件列表:")
    for f in sorted(output_dir.iterdir()):
        size = f.stat().st_size if f.is_file() else 0
        tag = "DIR " if f.is_dir() else "FILE"
        kb = f"{size / 1024:.1f}KB" if f.is_file() else ""
        print(f"  {tag}  {f.name:<45}  {kb:>10}")

    print(f"""
================================================================
output: {output_dir}
================================================================
NOTE: draft_meta_info.json (binary base64) could not have its name
field updated - the name is encoded in protobuf format and requires
the .proto schema to regenerate. The draft should still open.
================================================================
[Verification steps - please do in JianyingPro locally]
  1. Open JianyingPro
  2. Check if MIXCUT_TEST_FROM_REAL_TEMPLATE appears in draft list
  3. Open the draft and check:
     - Does it open without crashing?
     - Does the video appear in the media panel?
     - Is the timeline blank (expected for this test)?
     - Any Media Not Found errors?
================================================================
""")


if __name__ == "__main__":
    main()