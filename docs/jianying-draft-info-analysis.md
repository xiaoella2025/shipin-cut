# 剪映草稿 draft_info.json 结构分析

## 状态

- [x] 结构描述来源：用户提供的 Storybound 草稿结构包说明 + JianyingPro 5.x 社区分析
- [ ] 用户本地 inspect_draft.py 实际输出（待填入）
- [ ] GUI 验证结果（待填入）

---

## 1. Storybound 草稿目录结构总结

```
<草稿根目录>/
  draft_info.json           ← 主明文时间线入口（~1.77MB，可直接编辑）
  draft_info.json.bak
  draft_content.json        ← 可能是 opaque/编码内容，不要碰
  draft_content.json.bak
  draft_meta_info.json      ← 草稿列表元信息
  draft_biz_config.json
  draft_agency_config.json
  draft_virtual_store.json
  timeline_layout.json      ← 指向 active timeline ID
  attachment_editing.json
  attachment_pc_common.json
  performance_opt_info.json
  template.tmp              ← opaque，不要碰
  template-2.tmp            ← opaque，不要碰
  tree.txt
  report.txt
  Timelines/
    <timeline-id>/
      draft_content.json    ← opaque
      template.tmp          ← opaque
      template-2.tmp        ← opaque
    project.json
    project.json.bak
    common_attachment/
      ...
```

**关键结论**：
- 只修改 `draft_info.json`（根目录），这是剪映真正读取时间线数据的明文入口
- `draft_content.json` 和 `template*.tmp` 是 opaque 文件，不要尝试解析或替换
- Timelines 目录下没有传统 `template.json`，那些也是 opaque

---

## 2. draft_info.json 顶层字段

```json
{
  "canvas_config": { "height": 1920, "ratio": "9:16", "width": 1080 },
  "color_space": 0,
  "cover": "",
  "duration": 10000000,           ← 单位微秒 (µs)，10s = 10,000,000
  "extra_info": null,
  "fps": 30.0,                    ← 浮点，30 或 29.97
  "free_render_index_mode_on": false,
  "id": "<uuid>",
  "keyframe_graph_list": [],
  "keyframes": { ... },           ← 见第 3 节
  "last_modified_platform": { ... },
  "materials": { ... },           ← 见第 5 节
  "new_version": "100.0.0",
  "platform": { "app_version": "5.x.x", "os": "windows", ... },
  "relationships": [],
  "render_index_track_mode_on": false,
  "retouch_cover": "",
  "source": "default",
  "static_cover_image_path": "",
  "time_marks": null,
  "tracks": [ ... ],              ← 见第 4 节
  "update_time": 1234567890000,
  "version": 360000
}
```

---

## 3. keyframes 字段结构

keyframes 里各 sub-array 存储关键帧，**清空时间线时必须一并清空**，否则残留关键帧会导致 Media Not Found 或崩溃：

```json
"keyframes": {
  "adjusts": [],
  "beats": [],
  "color_curves": [],
  "color_wheels": [],
  "effects": [],
  "flowers": [],
  "handwrites": [],
  "stickers": [],
  "texts": [],
  "videos": []
}
```

`keyframe_graph_list` 也要清空（`[]`）。

---

## 4. tracks 结构

### track 对象

```json
{
  "attribute": 0,
  "flag": 0,
  "id": "<uuid>",
  "is_default_name": true,
  "name": "",
  "segments": [ ... ],
  "type": "video"    ← "video" | "audio" | "text" | "sticker" | "effect"
}
```

### video/audio segment

```json
{
  "cartoon": false,
  "clip": {
    "alpha": 1.0,
    "flip": { "horizontal": false, "vertical": false },
    "rotation": 0.0,
    "scale": { "x": 1.0, "y": 1.0 },
    "translation": { "x": 0.0, "y": 0.0 }
  },
  "common_keyframes": [],
  "enable_adjust": true,
  "extra_material_refs": [],
  "group_id": "",
  "hdr_settings": null,
  "id": "<uuid>",
  "intensifies_audio": false,
  "is_placeholder": false,
  "is_tone_modify": false,
  "material_id": "<material-uuid>",    ← 关联 materials 里的 id
  "render_index": 0,
  "reverse": false,
  "source_timerange": { "duration": 5000000, "start": 0 },   ← 素材本身时间范围
  "speed": 1.0,
  "target_timerange": { "duration": 5000000, "start": 0 },   ← 时间线上的位置
  "template_id": "",
  "template_scene": "default",
  "track_attribute": 0,
  "track_render_index": 0,
  "uniform_scale": null,
  "visible": true,
  "volume": 1.0
}
```

### text segment

text segment 与 video segment 结构相同，差异：
- `translation.y` 通常设为 `0.8`（靠近底部）
- `source_timerange.start` 固定为 `0`
- `target_timerange` 指向字幕显示时间区间

---

## 5. materials 字段结构

### materials.videos 单条

```json
{
  "aigc_type": "none",
  "audio_fade": null,
  "cartoon_path": "",
  "category_id": "",
  "category_name": "local",
  "check_flag": 63487,
  "crop": {
    "lower_left_x": 0.0, "lower_left_y": 1.0,
    "lower_right_x": 1.0, "lower_right_y": 1.0,
    "upper_left_x": 0.0, "upper_left_y": 0.0,
    "upper_right_x": 1.0, "upper_right_y": 0.0
  },
  "crop_ratio": "free",
  "crop_scale": 1.0,
  "duration": 10000000,
  "extra_type_option": 0,
  "file_Path": "C:\\abs\\path\\to\\video.mp4",
  "formula_id": "",
  "freeze": null,
  "has_audio": true,
  "height": 1920,
  "id": "<uuid>",
  "import_time": 1234567890,
  "import_time_ms": 1234567890123,
  "is_ai_matting_valid_cache": false,
  "is_unified_beauty_valid_cache": false,
  "local_material_id": "<uuid>",
  "material_id": "<uuid>",
  "material_name": "video.mp4",
  "material_url": "",
  "matting": { "flag": 0, "has_use_quick_brush": false, "has_use_quick_eraser": false,
               "interactiveTime": [], "path": "", "strokes": [] },
  "media_path": "",
  "object_file_key": "",
  "path": "C:\\abs\\path\\to\\video.mp4",    ← 绝对路径
  "picture_from": "none",
  "picture_set_category_id": "",
  "picture_set_category_name": "",
  "request_id": "",
  "reverse_path": "",
  "smart_motion": null,
  "source": "none",
  "source_platform": 0,
  "stable": null,
  "team_id": "",
  "type": "video",
  "video_algorithm": { "algorithms": [], "deflicker": null, "motion_blur_config": null,
                       "noise_reduction": null, "path": "", "quality_enhance": null, "time_range": null },
  "width": 1080
}
```

### materials.audios 单条

```json
{
  "app_id": 0,
  "category_id": "",
  "category_name": "local",
  "check_flag": 1,
  "duration": 10000000,
  "effect_id": "",
  "formula_id": "",
  "id": "<uuid>",
  "intensifies_path": "",
  "local_material_id": "<uuid>",
  "material_id": "<uuid>",
  "material_name": "audio.mp3",
  "material_url": "",
  "name": "audio",
  "path": "C:\\abs\\path\\to\\audio.mp3",    ← 绝对路径
  "request_id": "",
  "search_id": "",
  "source_platform": 0,
  "team_id": "",
  "text": "",
  "tone_folder_path": "",
  "type": "extract_music",
  "wave_points": []
}
```

### materials.texts 单条

**注意**：`content` 字段是一个嵌套 JSON 字符串（字符串里面是 JSON）：

```json
{
  "alignment": 1,
  "content": "{\"styles\":[{\"fill\":{\"content\":{\"render_type\":\"solid\",\"solid\":{\"alpha\":1.0,\"color\":[1.0,1.0,1.0]}}},\"range\":[0,5],\"useStyle\":\"\"}],\"text\":\"字幕文字\"}",
  "font_size": 8.0,
  "id": "<uuid>",
  "italic": false,
  "letter_spacing": 0.0,
  "line_max_width": 0.82,
  "line_spacing": 0.02,
  "name": "",
  "text_alpha": 1.0,
  "text_color": "#FFFFFF",
  "text_size": 30,
  "type": "text",
  "underline": false,
  ...
}
```

`content` 里的 `range: [0, N]` 中 N = 字幕文字长度（字符数）。

---

## 6. 时间单位确认

**时间单位：微秒 (µs)**

| 时长   | µs 值      |
|--------|------------|
| 1 秒   | 1,000,000  |
| 5 秒   | 5,000,000  |
| 1 分钟 | 60,000,000 |

Storybound 草稿中确认：原草稿约 11:52 → duration ≈ 712,000,000 µs

---

## 7. path 字段规则

1. **绝对路径**（Windows: `C:\...`，Mac: `/Users/...`）
2. **正反斜杠**：Windows 草稿里是反斜杠 `\`，但剪映也接受正斜杠 `/`
3. **材料同时有 `path` 和 `file_Path`**：两个字段都要写，内容相同
4. **不能用相对路径**：剪映不会相对于草稿目录解析路径
5. **路径不存在时**：剪映打开后显示 "Media Not Found"（视频/音频区域显示红色）

---

## 8. 哪些字段可以复用 Storybound 模板

| 字段                  | 操作          | 原因                          |
|-----------------------|---------------|-------------------------------|
| `canvas_config`       | 复用          | 分辨率/比例通常不变           |
| `fps`                 | 复用          | 帧率通常不变                  |
| `version`             | 复用          | 格式版本号不要改              |
| `platform`            | 复用          | 平台信息不影响播放            |
| `new_version`         | 复用          | 同上                          |
| `color_space`         | 复用          | 色彩空间通常为 0              |
| `id`                  | **重新生成**  | 每个草稿需要唯一 ID           |
| `duration`            | **设新值**    | 必须等于所有轨道总时长        |
| `tracks`              | **清空重建**  | 核心：完全替换旧内容          |
| `materials.*`         | **清空重建**  | 核心：完全替换旧素材          |
| `keyframes.*`         | **全部清空**  | 残留关键帧会引用旧 material   |
| `keyframe_graph_list` | **清空为 []** | 同上                          |
| `update_time`         | **更新**      | 设为当前时间戳（毫秒）        |

---

## 9. 哪些字段必须重新生成

- 所有 `id` 字段（draft id、track id、segment id、material id）→ 使用 `uuid4()`
- `duration` → 根据实际轨道计算
- `tracks` 完整重建
- `materials.videos` / `materials.audios` / `materials.texts` 完整重建
- `keyframes` 所有子数组 → 清空为 `[]`

---

## 10. 为什么只改 template.json 不够

1. Storybound 生成的草稿没有传统 `template.json`（Timelines 目录下的文件全是 opaque）
2. `timeline_layout.json` 只指向哪个 Timelines 子目录是 active，不含时间线数据
3. 剪映 5.x 读取时间线的主要明文来源是根目录 `draft_info.json`
4. `template.tmp` / `template-2.tmp` 可能是压缩/加密的缓存，剪映会优先读 JSON

---

## 11. 为什么必须处理 root draft_info.json

1. 它是 Storybound 草稿里唯一的大型明文 JSON（~1.77MB，含 30 视频 + 31 音频 + 333 字幕）
2. 直接修改它才能真正清空时间线内容
3. Codex 本地实验确认：改了 draft_info.json 的 tracks/materials 后草稿结构变化

---

## 12. 当前风险和限制

| 风险                              | 影响                         | 缓解                              |
|-----------------------------------|------------------------------|-----------------------------------|
| draft_content.json opaque 缓存   | 可能覆盖 draft_info.json     | 暂时无法消除；先以 draft_info 为主 |
| template*.tmp 缓存                | 同上                         | 同上                              |
| 路径在不同机器上不同              | Media Not Found              | 用户在本地运行脚本生成绝对路径    |
| 剪映版本差异                      | 字段可能不同                 | inspect_draft.py 检查真实结构    |

---

## 13. 验证日志

```
（运行 inspect_draft.py 后粘贴输出）
```

---

## 14. GUI 验证

```
（用户本地打开剪映后填写）
```
