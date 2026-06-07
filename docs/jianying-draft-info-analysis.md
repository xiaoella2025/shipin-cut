# 剪映草稿 draft_info.json 结构分析（基于真实 Storybound 包）

> **数据来源**：用户上传的 `storybound_draft_structure_pack.zip`（2026-06-07）  
> **已验证**：通过 Python 解析 draft_info.json（1.77MB）得出以下所有字段

---

## 1. Storybound 草稿目录结构

```
<草稿根目录>/
  draft_info.json           ← 主明文时间线入口（1.77MB，含全部 tracks/materials）
  draft_info.json.bak       ← 旧版本备份（tracks=[], duration=0，无实际数据）
  draft_content.json        ← opaque（base64 编码，与 template-2.tmp 完全一致）
  draft_content.json.bak    ← opaque
  draft_meta_info.json      ← opaque（18KB，无法直接读写）
  template.tmp              ← 明文 JSON，但 tracks=[], duration=0（旧版空模板）
  template-2.tmp            ← opaque（与 draft_content.json 完全相同）
  timeline_layout.json      ← 明文，指向 activeTimeline ID
  attachment_editing.json   ← 明文
  attachment_pc_common.json ← 明文
  draft_agency_config.json  ← 明文
  draft_biz_config.json     ← 空文件
  draft_virtual_store.json  ← 明文
  performance_opt_info.json ← 明文
  tree.txt / report.txt     ← 文字说明
  Timelines/
    <timeline-id>/
      draft_content.json    ← opaque（与根目录 draft_content.json 完全相同）
      template-2.tmp        ← opaque（与根目录完全相同）
      template.tmp          ← 明文 JSON，但 tracks=0（旧版空模板）
      common_attachment/    ← 明文 JSON 附件
```

**关键结论**：
- `draft_info.json`（根目录）是唯一有效的明文时间线数据源
- `draft_content.json`、`template-2.tmp`、`draft_meta_info.json` 全是 opaque，不要碰
- `timeline_layout.json` 只引用 activeTimeline ID，不含时间线数据
- `Timelines/<id>/` 下的 `template.tmp` 也是空模板（tracks=0）

---

## 2. draft_info.json 顶层字段（已确认）

```json
{
  "canvas_config": { "width": 1080, "height": 1920, "ratio": "original" },
  "color_space": 0,
  "config": { "adjust_max_index": 1, "attachment_info": [], ... },
  "cover": "",
  "create_time": 0,
  "duration": 712099999,
  "extra_info": null,
  "fps": 30,
  "free_render_index_mode_on": false,
  "group_container": null,
  "id": "91E08AC5-22FB-47e2-9AA0-7DC300FAEA2B",
  "keyframe_graph_list": [],
  "keyframes": { "adjusts": [], "audios": [], "effects": [], "filters": [],
                 "handwrites": [], "stickers": [], "texts": [], "videos": [] },
  "last_modified_platform": { "app_id": 359289, "app_source": "cc",
    "app_version": "6.5.0", "device_id": "...", "os": "mac", "os_version": "15.5" },
  "materials": { ... },
  "mutable_config": null,
  "name": "",
  "new_version": "100.0.0",
  "platform": { ... },
  "relationships": [],
  "render_index_track_mode_on": true,
  "retouch_cover": "",
  "source": "default",
  "static_cover_image_path": "",
  "time_marks": null,
  "tracks": [ ... ],
  "update_time": 0,
  "version": 360000
}
```

**重要差异（与旧预测不同）**：
- `fps`: 整数 `30`，不是 `30.0`
- `id`: **大写 UUID + 连字符**（草稿 ID 格式）
- `render_index_track_mode_on`: `true`（不是 false）
- `update_time`: 0（不更新）
- `create_time`: 0

---

## 3. keyframes 结构（已确认）

```json
"keyframes": {
  "adjusts":    [],
  "audios":     [],
  "effects":    [],
  "filters":    [],
  "handwrites": [],
  "stickers":   [],
  "texts":      [],
  "videos":     []
}
```

⚠️ **与旧预测不同**：keyframes keys 是 `audios/filters/videos`，不是 `beats/color_curves/color_wheels`

---

## 4. tracks 结构

### 4.1 track 对象

```json
{
  "attribute": 0,
  "flag": 0,
  "id": "fefc392cf05b44e39f2048c6ffdb27b9",  ← 32位小写十六进制（无连字符）
  "is_default_name": false,
  "name": "image_main",
  "type": "video"
}
```

**ID 格式**：track/segment/material 使用 **32位小写十六进制**（如 `fefc392cf05b44e39f2048c6ffdb27b9`），
草稿 ID 本身使用 **大写 UUID 带连字符**（如 `91E08AC5-22FB-47e2-9AA0-7DC300FAEA2B`）

### 4.2 video segment（已确认）

```json
{
  "enable_adjust": true,
  "enable_color_correct_adjust": false,
  "enable_color_curves": true,
  "enable_color_match_adjust": false,
  "enable_color_wheels": true,
  "enable_lut": true,
  "enable_smart_color_adjust": false,
  "last_nonzero_volume": 1.0,
  "reverse": false,
  "track_attribute": 0,
  "track_render_index": 0,
  "visible": true,
  "id": "<hex32>",
  "material_id": "<hex32>",
  "target_timerange": { "start": 0, "duration": 10200000 },
  "source_timerange": { "start": 0, "duration": 10200000 },
  "common_keyframes": [],
  "keyframe_refs": [],
  "speed": null,
  "volume": 1.0,
  "extra_material_refs": [ "<speed_mat_id>" ],
  "clip": {
    "alpha": 1.0,
    "flip": { "horizontal": false, "vertical": false },
    "rotation": 0.0,
    "scale": { "x": 1.0, "y": 1.0 },
    "transform": { "x": 0.0, "y": 0.0 }    ← transform，不是 translation！
  },
  "uniform_scale": { "on": true, "value": 1.0 },   ← 不是 null！
  "hdr_settings": { "intensity": 1.0, "mode": 1, "nits": 1000 },
  "render_index": 0
}
```

⚠️ **关键差异**：
- `clip.transform` ≠ `clip.translation`
- `uniform_scale: {"on":true,"value":1.0}` ≠ `null`
- `keyframe_refs: []` 是新字段，必须有
- `speed: null`（不是 1.0）
- `hdr_settings` 有实际内容

### 4.3 audio segment（已确认）

```json
{
  "enable_adjust": true, "enable_color_correct_adjust": false,
  "enable_color_curves": true, "enable_color_match_adjust": false,
  "enable_color_wheels": true, "enable_lut": true,
  "enable_smart_color_adjust": false,
  "last_nonzero_volume": 1.0,
  "reverse": false, "track_attribute": 0, "track_render_index": 0, "visible": true,
  "id": "<hex32>",
  "material_id": "<hex32>",
  "target_timerange": { "start": 0, "duration": 10200000 },
  "source_timerange": { "start": 0, "duration": 10200000 },
  "common_keyframes": [], "keyframe_refs": [],
  "speed": 1.0,
  "volume": 10.0,
  "extra_material_refs": [ "<speed_mat_id>" ],
  "clip": null,
  "hdr_settings": null,
  "render_index": 0
}
```

### 4.4 text segment（已确认）

```json
{
  "enable_adjust": true, "enable_color_correct_adjust": false,
  "enable_color_curves": true, "enable_color_match_adjust": false,
  "enable_color_wheels": true, "enable_lut": true,
  "enable_smart_color_adjust": false,
  "last_nonzero_volume": 1.0,
  "reverse": false, "track_attribute": 0, "track_render_index": 0, "visible": true,
  "id": "<hex32>",
  "material_id": "<hex32>",
  "target_timerange": { "start": 0, "duration": 3308000 },
  "source_timerange": null,                   ← null，不是 {start:0,duration:...}
  "common_keyframes": [], "keyframe_refs": [],
  "speed": 1.0,
  "volume": 1.0,
  "extra_material_refs": [],
  "clip": {
    "alpha": 1.0,
    "flip": { "horizontal": false, "vertical": false },
    "rotation": 0.0,
    "scale": { "x": 1.0, "y": 1.0 },
    "transform": { "x": 0.0, "y": -0.215 }  ← y 为负数 = 靠近顶部
  },
  "uniform_scale": { "on": true, "value": 1.0 },
  "render_index": 15999                         ← 文字轨 render_index 约 15000-15999
}
```

---

## 5. materials 结构

### 5.1 materials.videos（Storybound 用 photo 类型！）

**重要**：Storybound 的"视频"素材实际上是 **PNG 图片**（`type: "photo"`）。
用户提供真实 mp4 时，应使用 `type: "video"`。

```json
{
  "audio_fade": null,
  "category_id": "",
  "category_name": "local",
  "check_flag": 63487,
  "crop": {
    "upper_left_x": 0.0, "upper_left_y": 0.0,
    "upper_right_x": 1.0, "upper_right_y": 0.0,
    "lower_left_x": 0.0, "lower_left_y": 1.0,
    "lower_right_x": 1.0, "lower_right_y": 1.0
  },
  "crop_ratio": "free",
  "crop_scale": 1.0,
  "duration": 10200000,                         ← µs，实际视频时长
  "height": 1920,
  "id": "<hex32>",
  "local_material_id": "<hex32>",              ← video 类型设同 id
  "material_id": "<hex32>",
  "material_name": "clip.mp4",
  "media_path": "",
  "path": "D:\\JianyingPro Drafts\\<name>\\assets\\video\\clip.mp4",  ← 绝对路径
  "remote_url": null,
  "type": "video",                             ← 真实视频用 "video"
  "width": 1080
}
```

⚠️ **注意**：没有 `file_Path`、`aigc_type`、`matting`、`has_audio` 字段（Storybound 结构更简洁）

### 5.2 materials.audios（已确认）

```json
{
  "app_id": 0,
  "category_id": "",
  "category_name": "local",
  "check_flag": 1,
  "copyright_limit_type": "none",
  "duration": 10200000,
  "effect_id": "",
  "formula_id": "",
  "id": "<hex32>",
  "intensifies_path": "",
  "is_ai_clone_tone": false,
  "is_text_edit_overdub": false,
  "is_ugc": false,
  "local_material_id": "<hex32>",
  "music_id": "<hex32>",           ← 与 id 相同，是 Storybound 格式特有字段
  "name": "audio.mp3",             ← 注意是 name，不是 material_name
  "path": "D:\\JianyingPro Drafts\\<name>\\assets\\audio\\audio.mp3",
  "remote_url": null,
  "query": "",
  "request_id": "",
  "resource_id": "",
  "search_id": "",
  "source_from": "",
  "source_platform": 0,
  "team_id": "",
  "text_id": "",
  "tone_category_id": "", "tone_category_name": "", "tone_effect_id": "",
  "tone_effect_name": "", "tone_platform": "",
  "tone_second_category_id": "", "tone_second_category_name": "",
  "tone_speaker": "", "tone_type": "",
  "type": "extract_music",
  "video_id": "",
  "wave_points": []
}
```

### 5.3 materials.texts（已确认，type 是 "subtitle"！）

```json
{
  "id": "<hex32>",
  "content": "{\"styles\":[{\"fill\":{\"alpha\":1.0,\"content\":{\"render_type\":\"solid\",\"solid\":{\"alpha\":1.0,\"color\":[1.0,1.0,1.0]}}},\"range\":[0,7],\"size\":12.0,\"bold\":false,\"italic\":false,\"underline\":false,\"strokes\":[{\"content\":{\"solid\":{\"alpha\":0.0,\"color\":[0.0,0.0,0.0]}},\"width\":0.0}]}],\"text\":\"CLEAN字幕\"}",
  "typesetting": 0,
  "alignment": 1,
  "letter_spacing": 0.0,
  "line_spacing": 0.02,
  "line_feed": 1,
  "line_max_width": 1.0,         ← 1.0，不是 0.82
  "force_apply_line_max_width": false,
  "check_flag": 31,              ← 31，不是 63487
  "type": "subtitle",            ← "subtitle"，不是 "text"！
  "fixed_width": -1,
  "fixed_height": -1,
  "font_category_id": "",
  "font_category_name": "",
  "font_id": "",
  "font_name": "",
  "font_path": "",
  "font_resource_id": "",        ← 新字段
  "font_size": 15.0,
  "font_source_platform": 0,     ← 新字段
  "font_team_id": "",            ← 新字段
  "font_title": "none",          ← 新字段
  "font_url": "",                ← 新字段
  "fonts": [],
  "background_style": 0,
  "background_color": "#000000",
  "background_alpha": 0.5,
  "background_round_radius": 0.3,
  "background_height": 0.14,
  "background_width": 0.14,
  "background_horizontal_offset": 0.0,
  "background_vertical_offset": 0.0,
  "sub_type": 0,
  "recognize_type": 0,
  "is_rich_text": true,          ← 新字段
  "caption_template_info": {     ← 新字段
    "category_id": "", "category_name": "", "effect_id": "",
    "is_new": false, "path": "", "request_id": "",
    "resource_id": "", "resource_name": "", "source_platform": 0
  },
  "combo_info": { "text_templates": [] },   ← 新字段
  "words": { "end_time": [], "start_time": [], "text": [] },
  "subtitle_keywords": null      ← 新字段
}
```

**content 字段内嵌 JSON** — styles[0] 结构：
```json
{
  "fill": {
    "alpha": 1.0,               ← 额外的 alpha 字段（旧预测没有）
    "content": {
      "render_type": "solid",
      "solid": { "alpha": 1.0, "color": [1.0, 1.0, 1.0] }
    }
  },
  "range": [0, <text_len>],
  "size": 12.0,                 ← 新字段
  "bold": false,                ← 新字段
  "italic": false,              ← 新字段
  "underline": false,           ← 新字段
  "strokes": [{                 ← 新字段
    "content": { "solid": { "alpha": 0.0, "color": [0.0, 0.0, 0.0] } },
    "width": 0.0
  }]
}
```

### 5.4 materials.speeds（已确认）

每个视频/音频 segment 通过 `extra_material_refs` 引用一个 speed material：

```json
{
  "curve_speed": null,
  "id": "<hex32>",
  "mode": 0,
  "speed": null,
  "type": "speed"
}
```

---

## 6. 时间单位（已确认）

**微秒 (µs)**，1秒 = 1,000,000

| 草稿时长    | µs 值         | 实际秒数 |
|-------------|---------------|----------|
| 原始草稿    | 712,099,999   | ~11:52   |
| 目标测试草稿| 5,000,000     | 5 秒     |
| 一帧（30fps）| 33,333       | 1/30 秒  |

---

## 7. path 字段规则（已确认）

1. **绝对路径**（Windows 反斜杠格式）
2. 例：`D:\Program Files (x86)\jianying\Apps\JianyingPro Drafts\<名称>\assets\image\1.png`
3. 音频路径：`...\assets\audio\1.mp3`
4. 视频路径：`...\assets\video\clip.mp4`
5. **只有 `path` 字段**，没有 `file_Path` 字段（Storybound 格式）
6. `remote_url: null`
7. `local_material_id` 设为同 id

---

## 8. 可复用 vs 必须重建的字段

| 字段                         | 操作           | 原因                                  |
|------------------------------|----------------|---------------------------------------|
| `canvas_config`              | 复用           | 分辨率/比例不变                       |
| `fps`                        | 复用           | 帧率不变                              |
| `version`                    | 复用           | 格式版本号不变                        |
| `new_version`                | 复用           | 同上                                  |
| `config`                     | 复用           | 内部配置参数，不影响时间线            |
| `last_modified_platform`     | 复用           | 平台信息不影响播放                    |
| `id`                         | **保持原值**   | 必须与 Timelines/<id>/ 文件夹名一致  |
| `duration`                   | **设新值**     | 必须等于时间线总时长                  |
| `tracks`                     | **清空重建**   | 完全替换旧时间线内容                  |
| `materials.videos/audios/texts` | **清空重建** | 完全替换旧素材                        |
| `materials.speeds`           | **清空重建**   | 引用旧 segment ID 的 speed，必须重建  |
| `materials.material_animations` | **清空为[]** | 旧图片动画效果不需要                  |
| `keyframes.*`                | **清空为[]**   | 残留关键帧会引用旧 material           |
| `keyframe_graph_list`        | **清空为[]**   | 同上                                  |

---

## 9. 为什么只改 template.json/timeline_layout 不够

1. `Timelines/<id>/template.tmp` 是 opaque（base64 编码）
2. 根目录 `template.tmp` 是空模板（tracks=[], duration=0），不是实际时间线
3. `timeline_layout.json` 只指向 active timeline ID，不含时间线数据
4. **剪映真正读取时间线数据的来源是根目录 `draft_info.json`**

---

## 10. 当前风险

| 风险                              | 影响                   | 缓解                                   |
|-----------------------------------|------------------------|----------------------------------------|
| opaque `draft_content.json` 缓存 | 可能覆盖 draft_info    | 先以 draft_info 为主；后续研究         |
| 路径只在生成机器上有效            | 其他机器 Media Not Found| 用户本地运行，保证路径存在            |
| `draft_meta_info.json` 是 opaque | 无法更新草稿列表名称   | 剪映可通过 draft_info.json 的内容显示 |
| `extra_material_refs` 悬空 refs  | 轻微影响（可能忽略）   | 用 `[]`，不引用旧 speed 材料          |

---

## 11. 当前实现状态（v0.9.9-step2）

`tools/jianying_draft/create_draft_info_test.py` 已基于真实 Storybound 字段结构完成：

- `rebuild_draft_info()` 真正清空并重建 tracks / materials.videos、audios、texts、speeds
- 生成 3 video segment（等分 5 秒）+ 1 audio segment + 3 subtitle segment
- keyframes 全 8 个 key（adjusts/audios/effects/filters/handwrites/stickers/texts/videos）全部清空为 `[]`
- keyframe_graph_list 清空为 `[]`
- draft id 保持模板原值（匹配 `Timelines/<id>/` 文件夹）
- 输入 video/audio 不存在时 `sys.exit(1)`，不生成假草稿
- 素材 path 写绝对路径，指向 `output/assets/video/` 和 `output/assets/audio/`

**单元测试**：71/71 通过（`python -m unittest tests.test_jianying_draft_tools -v`）

---

## 12. ⚠ 云端限制 — 必须用户本地验证

云端 Claude Code 无法访问剪映 GUI，无法打开草稿验证。

**脚本层结构检查通过，但以下验证必须由用户本地完成**：

1. 将输出草稿目录复制到剪映草稿目录：  
   `C:\Users\Admin\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\`
2. 打开剪映专业版，找到该草稿
3. 确认：时长 5 秒 / 3 个视频片段 / 1 个音频片段 / 3 条字幕 / 无 Media Not Found

**运行 inspect_draft.py 核查（本地执行后粘贴输出）**：
```
python tools/jianying_draft/inspect_draft.py "<输出草稿目录>" --check-media-paths
```
