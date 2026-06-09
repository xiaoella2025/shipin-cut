# 剪映草稿导入失败诊断报告

> 诊断日期：2026/06/08
> 分支：claude/video-editing-prototype-sjQo0
> 诊断范围：tools/jianying_draft/ 下所有脚本 + 模板 + 真实 Storybound 草稿

---

## 1. disable_opaque_files.ps1 来源调查

**结论：该项目代码、文档、git 历史中均无 `disable_opaque_files.ps1` 引用。**

- 全项目 grep `disable_opaque_files`：0 结果
- 全项目 grep `disable_opaque`：0 结果
- 全项目 grep `opaque`：10 个文件匹配（均为描述"opaque 文件不要碰"的上下文）
- 该文件名从未在任何 `.py`、`.md`、`.json`、测试文件或 git commit message 中出现

**原因**：用户在当前会话开始时试图运行 `.\disable_opaque_files.ps1`，文件不存在。本会话此前没有任何地方生成、引用或建议运行此脚本。该文件名来源不明，非本次 Claude 会话生成。

---

## 2. 全项目关键文件路径索引

### 2.1 核心工具脚本

| 文件 |用途 | 状态 |
|------|------|------|
| `tools/jianying_draft/create_1v1a1t.py` | seed-based 草稿生成（最新） | 主要生产脚本 |
| `tools/jianying_draft/template_slot_replace_draft.py` | 槽位替换法 | 备用策略脚本 |
| `tools/jianying_draft/create_minimal_draft.py` | 从零生成最小草稿 | **有严重 bug** |
| `tools/jianying_draft/create_comp_draft.py` | 从 composition JSON 生成 | 依赖 create_minimal_draft |
| `tools/jianying_draft/inspect_draft.py` | 草稿结构分析工具 | 可用 |
| `tools/jianying_draft/template_slot_replace_draft.py` | 槽位替换脚本 | 单元测试通过 |

### 2.2 模板与样本

| 文件 | 类型 | 说明 |
|------|------|------|
| `MIXCUT_TEMPLATE_3V_1A_3T/` | 真实草稿模板（剪映生成） | 含完整 opaque 文件 |
| `tools/jianying_draft/minimal_template_1v1a1t.json` | JSON 模板占位符 | 非完整草稿目录 |
| `20260605·一把花生的护心门道_e3e97909(1)/20260605·一把花生的护心门道_e3e97909/` | 用户上传真实草稿 | 11:52 Storybound 草稿 |

### 2.3 Opaque（不可写）文件

| 文件 | 实际格式 | 说明 |
|------|------|------|
| `draft_content.json` | **base64 编码二进制**（~75KB → ~56KB 解码后为二进制 protobuf） | 不要改 |
| `template-2.tmp` | 与 draft_content.json 内容完全相同（SHA256 一致） | 不要改 |
| `draft_meta_info.json` | **base64 编码**（非 JSON，明文无法解析） | 不要改 |
| `Timelines/<id>/draft_content.json` | 同根目录 | 不要改 |
| `Timelines/<id>/template-2.tmp` | 同根目录 | 不要改 |

### 2.4 可安全编辑的文件

| 文件 |格式 | 说明 |
|------|------|------|
| `draft_info.json` | 明文 JSON | **主要编辑对象** |
| `timeline_layout.json` | 明文 JSON | 指向 activeTimeline ID |
| `attachment_editing.json` | 明文 JSON | 附件 |
| `attachment_pc_common.json` | 明文 JSON | 附件 |
| `key_value.json` | 明文 JSON | 配置 |
| `draft_virtual_store.json` | 明文 JSON | 配置 |

---

## 3. 当前工具输出草稿检查

### 3.1 create_minimal_draft.py 的致命 bug

**BUG：向 `draft_content.json` 写入明文 JSON，而非 base64 编码的二进制。**

```python
# create_minimal_draft.py 第 616-617 行
content_path = out_dir / "draft_content.json"
content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
```

剪映的 `draft_content.json` 实际存储格式：**base64( binary_protobuf )**。
本脚本直接写入 JSON，剪映读取时会认为文件损坏或格式错误。

**影响**：使用 `create_minimal_draft.py`生成的草稿**剪映必然无法打开**（文件格式损坏）。

### 3.2 create_1v1a1t.py（当前主脚本）输出结构

该脚本正确地：
- 复制整个模板目录（保留所有 opaque 文件）
- 只重写 `draft_info.json`
- 将素材复制到 `assets/video/` 和 `assets/audio/`
- deepcopy 种子材料，只改必要字段

**但存在以下结构性风险**（见第 5 节）。

### 3.3 template_slot_replace_draft.py 输出结构

该脚本：
- 复制模板，保留所有 opaque 文件
- 只替换 `draft_info.json` 中已有 material槽位的路径和字幕文本
- 不重建 tracks/segments/materials

**风险**：如果模板的 `draft_content.json`（opaque）仍包含原始时间线，则剪映可能仍读旧时间线。

---

## 4. 真实剪映空白草稿结构（对照）

### 4.1 真实 Storybound 草稿（用户提供，macOS 版 JianyingPro 6.5.0）

```
草稿根目录/
  draft_content.json     ← base64(binary_protobuf)，~562KB decoded，二进制不可读
  draft_meta_info.json   ← base64，~18KB，明文无法解析
  template-2.tmp ← 与 draft_content.json 完全相同（SHA256验证一致）
  draft_info.json        ← 明文，1.77MB，含完整时间线数据
  timeline_layout.json   ← 明文，指向 activeTimeline ID
  Timelines/<id>/
    draft_content.json   ← 同根目录
    template-2.tmp ← 同根目录
    template.tmp         ← 明文 JSON，但 tracks=[]（旧版空模板）
```

### 4.2 关键元信息（Storybound 真实值）

| 字段 | 真实值 | 备注 |
|------|--------|------|
| `version` | `360000` | 整数 |
| `new_version` | `"110.0.0"` | 字符串 |
| `fps` | `30` | 整数（非 30.0） |
| `render_index_track_mode_on` | `true` | 布尔 |
| `platform.os` | `"mac"` | macOS 生成，Windows 机器打开可能有问题 |
| `platform.app_version` | `"6.5.0"` | 整数 app_id: 359289 |
| `id`（草稿ID） | 大写 UUID 带连字符 | 例：`91E08AC5-22FB-47e2-9AA0-7DC300FAEA2B` |
| `tracks`/`materials` 各 id | 32位小写十六进制 | 例：`bac7da70da883ccf8a1729928eb29502` |

### 4.3 真实 video segment 结构

```json
{
  "enable_adjust": true,
  "speed": null, // 视频 speed 为 null，非 1.0
  "volume": 1.0,
  "extra_material_refs": [
    "<speed_id>", // 引用 speed material
    "<material_animation_id>"        // 可能还有第二个 ref
  ],
  "clip": {
    "transform": { "x": 0.0, "y": 0.0 }   // transform，非 translation
  },
  "uniform_scale": { "on": true, "value": 1.0 },  // 非 null！
  "hdr_settings": { "intensity": 1.0, "mode": 1, "nits": 1000 },
  "keyframe_refs": [],
  "common_keyframes": []
}
```

### 4.4 真实 audio segment 结构

```json
{
  "speed": 1.0,                      // 音频 speed 为 1.0
  "volume": 10.0,                    // 重要：主音频轨 volume=10.0
  "extra_material_refs": ["<speed_id>"],
  "clip": null,
  "hdr_settings": null
}
```

### 4.5 真实 text segment 结构

```json
{
  "speed": 1.0,
  "volume": 1.0,
  "source_timerange": null,          // 字幕 source_timerange 必须为 null
  "extra_material_refs": ["<某些 material id>"],
  "clip": {
    "transform": { "x": 0.0, "y":0.047 } // y 值决定垂直位置
  },
  "uniform_scale": { "on": true, "value": 1.0 },
  "render_index": 15000 // 字幕轨 render_index 约 15000
}
```

### 4.6 真实 video material 结构（type: photo）

```json
{
  "id": "bac7da70da883ccf8a1729928eb29502",
  "local_material_id": "",           // Storybound 为空字符串！
  "material_id": "bac7da70da883ccf8a1729928eb29502",
  "material_name": "1.png",
  "type": "photo",                  // 注意：Storybound 用 photo
  "path": "D:\\Program Files (x86)\\jianying\\...\\assets\\image\\1.png",
  "duration": 10800000000,           // 微秒
  "has_audio": true,
  "media_path": ""
}
```

---

## 5. 失败原因分析

### 5.1 失败类型判定

**草稿列表不显示 + 草稿能打开但时间线空白/显示旧内容（双重失败）**

理由：
1. `draft_meta_info.json` 是 base64 编码的 opaque 文件，如果剪映 GUI 依赖其中的 `draft_name`/`draft_root_path` 来显示草稿列表，则这些字段为空/错误 → 草稿列表不显示
2. `draft_content.json`（opaque）仍包含原始 Storybound 时间线（30视频段 + 333 字幕段），而剪映可能优先读取 opaque 文件 → 即使 draft_info.json 已更新，时间线仍显示旧内容

### 5.2 根本原因 #1：create_minimal_draft.py 生成格式错误的 draft_content.json

**严重程度：致命（如果使用了该脚本）**

该脚本将 `draft_content.json` 写成明文 JSON，但剪映的 `draft_content.json` 实际是 **base64(binary_protobuf)**。
剪映读取时发现文件头不是 base64 字符，判定文件损坏 → **草稿无法打开**。

**已确认代码位置**：`tools/jianying_draft/create_minimal_draft.py:616-617`

### 5.3 根本原因 #2：draft_content.json (opaque) 缓存旧时间线

**严重程度：高**

策略文档（jianying-slot-replace-strategy.md）已识别此风险：
> "剪映 GUI 恢复时间线时，不只依赖 `draft_info.json`。`draft_content.json`、`template-2.tmp`、`Timelines` 下的文件等 opaque 内容仍然参与控制 GUI 看到的时间线拓扑。"

当前所有脚本策略都是"保留 opaque 文件，只改 draft_info.json"。
但剪映 GUI 可能**优先或同时读取 `draft_content.json`**（base64 编码的 protobuf），其中包含原始 Storybound 11:52 时间线拓扑。

**证据**：
- `draft_content.json` 和 `template-2.tmp` 完全相同（SHA256 一致）
- 两者均为 ~75KB base64 → ~56KB 二进制 protobuf
- 这两个文件的内容不被任何脚本修改
- 如果剪映在启动时先解析 `draft_content.json` 并缓存其中时间线，则后续对 `draft_info.json` 的修改不会生效

### 5.4 根本原因 #3：draft_meta_info.json 的 base64 编码导致草稿列表不显示

**严重程度：高**

`draft_meta_info.json` 是 base64 编码的二进制，包含了 `draft_name`、`draft_root_path`、`draft_fold_path` 等剪映用来在草稿列表中显示名称和路径的字段。

当前脚本均不修改 `draft_meta_info.json`（因为它是 opaque）。但如果用户将输出草稿复制到剪映草稿目录时 `draft_name` 为空或 `draft_root_path`指向错误路径，剪映的草稿列表可能无法正确显示。

**同时**：该草稿原为 macOS 生成，Windows 版 JianyingPro 可能对 `draft_meta_info.json` 中的路径格式（`D:\Program Files (x86)\...`）解析出错。

### 5.5 次要问题：字段精确度差异

以下差异可能影响显示效果，但不太可能是"完全打不开"的主要原因：

| 字段/问题 | create_1v1a1t.py现状 | 真实 Storybound 值 |
|-----------|----------------------|-------------------|
| `audio` segment `volume` | `1.0` | `10.0`（主音频轨）|
| `video` material `local_material_id` | `== id`（与 id相同）| `""`（空字符串）|
| `video` material `type` | `"video"` | `"photo"`（Storybound 特有）|
| `video` material `has_audio` | 有（seed 保留）| `true` |
| `materials.speeds[].speed` | `null` | `null`（正确）|
| `materials.speeds[].curve_speed` | 未设置（降级 fallback）| `null` |

---

## 6. 不需要 disable_opaque_files.ps1

`disable_opaque_files.ps1` 在项目中不存在（问题1 已确认）。

剪映草稿失败的原因**不是"opaque 文件需要被禁用"**，而是：
1. `draft_content.json`（opaque）缓存了旧时间线 → 需要研究剪映是否真的优先读它
2. `draft_meta_info.json`（opaque）的元数据字段可能不正确 → 需要找到更新它的方法
3. `create_minimal_draft.py` 写入了错误格式的 `draft_content.json` → 需要修复

**结论：不需要 `disable_opaque_files.ps1`。**

---

## 7. 下一步建议修复顺序

### 第一优先级（致命）

**修复文件：`tools/jianying_draft/create_minimal_draft.py`**

- 停止向 `draft_content.json` 写入明文 JSON
-改为复制模板的 `draft_content.json`（保留 opaque格式）
- 或删除 `draft_content.json` 生成逻辑（只在有模板时使用槽位替换）

### 第二优先级（高）

**确认文件：`draft_content.json` 的优先级问题**

在 `docs/jianying-draft-research.md` 中标记为"需要用户本地验证"：
> "将输出草稿目录复制到剪映草稿目录，打开剪映，确认..."

**需要用户本地验证的具体问题是**：
> 剪映打开后，时间线显示的是原始 Storybound 11:52 内容，还是新的 5 秒内容？

如果是前者，说明剪映确实优先读 `draft_content.json`，则需要：
- 研究 `draft_content.json` 的二进制 protobuf编码
- 或者改用"空白草稿模板"（不含任何时间线内容的初始草稿）作为模板

### 第三优先级（中）

**修复文件：`tools/jianying_draft/create_1v1a1t.py`**

- 音频 segment 的 `volume` 应为 `10.0`（参考 Storybound 真实值）
- 视频 material 的 `local_material_id`：如果模板是 Storybound 原版，应保留空字符串
- 考虑从用户真实创建的空白剪映草稿（Windows 版，JianyingPro 本地创建）作为模板，而不是用 Storybound 草稿

### 第四优先级（中）

**补充：生成空白剪映草稿模板**

用户应在 Windows 版剪映中手动创建一个空白草稿（无素材，5 秒时长），保存到：
```
C:\Users\Admin\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\
```
然后将该目录作为 `create_1v1a1t.py --template` 使用。

这样做的好处：
- 模板的 `draft_content.json` 含空白时间线（无旧内容）
- 元数据字段与 Windows 版剪映完全匹配
- 不存在 macOS/Windows 路径兼容性问题

---

## 8. 诊断总结

| 项目 | 结论 |
|------|------|
| `disable_opaque_files.ps1` | 项目中不存在，不需要 |
| 草稿列表不显示 | 很可能是因为 `draft_meta_info.json`（opaque）的 `draft_name`/`draft_root_path` 字段不正确 |
| 时间线显示旧内容 | 很可能是因为剪映优先读 `draft_content.json`（opaque），其中含原始 Storybound 时间线 |
| create_minimal_draft.py | **有致命 bug**：写入明文 JSON 到 `draft_content.json` |
| create_1v1a1t.py | 主体逻辑正确，但依赖模板的 opaque 文件，可能因此读旧时间线 |
| template_slot_replace_draft.py | 较保守，但同样受 opaque 文件影响 |
| 最佳模板来源 | Windows 版剪映本地创建的空白草稿，不是 Storybound 草稿 |

---

## 附录：关键文件内容对照

### A. create_minimal_draft.py 的 clip 字段 bug

```python
#错误：使用 translation 而非 transform
"clip": {
    "translation": {"x": 0.0, "y": 0.0}   # ← 应该是 transform
}
```

真实 Storybound 使用 `clip.transform`，无 `clip.translation`。

### B. create_minimal_draft.py 的 uniform_scale bug

```python
# 错误：uniform_scale = None
"uniform_scale": None # ← 应该是 {"on": true, "value": 1.0}
```

### C. create_minimal_draft.py 的 hdr_settings bug

```python
# 错误：video segment 的 hdr_settings 为 None
"hdr_settings": None   # ← 应该是 {"intensity": 1.0, "mode": 1, "nits": 1000}
```

### D. create_minimal_draft.py 的 text material type bug

```python
# 错误：type = "text"
"type": "text"   # ← 应该是 "subtitle"
```