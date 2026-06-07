# 剪映草稿格式研究文档

## 状态

- [ ] 获取真实草稿样本（需要用户操作）
- [ ] inspect_draft.py 分析完成
- [ ] 确认时间单位
- [ ] 确认资源路径规则
- [ ] 最小草稿生成验证
- [ ] 剪映可打开最小草稿

---

## 需要用户准备的草稿样本

1. 打开剪映专业版（JianyingPro）
2. 新建空白项目，随意命名（例如 `test-for-research`）
3. 导入一个短视频（< 30s 即可）
4. 导入一个 mp3 音频
5. 添加一条普通文字字幕（任意文字）
6. 保存草稿（Ctrl+S 或直接关闭）
7. 找到草稿目录：

   **Windows 默认路径：**
   ```
   C:\Users\<用户名>\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\<草稿名>\
   ```
   或
   ```
   C:\Users\<用户名>\Documents\JianyingPro\User Data\Projects\com.lveditor.draft\<草稿名>\
   ```

   **Mac 默认路径：**
   ```
   ~/Movies/JianyingPro/User Data/Projects/com.lveditor.draft/<草稿名>/
   ```

8. 把该草稿文件夹复制一份到项目目录：
   ```
   shipin-cut/tools/jianying_draft/sample_draft/
   ```
   或者告诉我完整路径，用 inspect_draft.py 直接分析

9. 然后运行：
   ```bash
   python tools/jianying_draft/inspect_draft.py tools/jianying_draft/sample_draft/
   ```

---

## 已知信息（待验证）

以下内容来自公开文档和社区分析，**必须用真实草稿验证才能使用**。

### 草稿目录结构（推测）

```
<草稿名>/
  draft_content.json       # 主轨道数据（必须）
  draft_meta_info.json     # 草稿元信息（必须）
  <video_id>.mp4           # 或软链接 / 绝对路径引用
  <audio_id>.mp3
```

### 时间单位（待验证）

- 推测：微秒（microseconds），即 1 秒 = 1,000,000
- 根据：剪映 API 相关讨论中普遍提及 `target_timerange` 使用微秒

### draft_content.json 顶层字段（待验证）

```json
{
  "canvas_config": { "width": 1080, "height": 1920, "ratio": "9:16" },
  "color_space": 0,
  "cover": "",
  "duration": 10000000,
  "id": "<uuid>",
  "keyframe_graph_list": [],
  "keyframes": { "adjusts": [] },
  "last_modified_platform": { "app_id": 359289478, "app_version": "...", ... },
  "materials": {
    "videos": [ ... ],
    "audios": [ ... ],
    "texts": [ ... ],
    "stickers": []
  },
  "mutable_config": null,
  "platform": { "app_id": 359289478, "app_version": "...", "os": "windows", ... },
  "relationships": [],
  "render_index_track_mode_on": false,
  "retouch_cover": "",
  "source": "default",
  "static_cover_image_path": "",
  "time_marks": null,
  "tracks": [ ... ],
  "version": 360000
}
```

### tracks 结构（待验证）

```json
{
  "attribute": 0,
  "flag": 0,
  "id": "<uuid>",
  "is_default_name": true,
  "name": "",
  "segments": [
    {
      "cartoon": false,
      "clip": { "alpha": 1.0, "flip": { "horizontal": false, "vertical": false },
                "rotation": 0.0, "scale": { "x": 1.0, "y": 1.0 },
                "translation": { "x": 0.0, "y": 0.0 } },
      "common_keyframes": [],
      "enable_adjust": true,
      "extra_material_refs": [],
      "group_id": "",
      "hdr_settings": null,
      "id": "<uuid>",
      "intensifies_audio": false,
      "is_placeholder": false,
      "is_tone_modify": false,
      "material_id": "<material_uuid>",
      "render_index": 0,
      "reverse": false,
      "source_timerange": { "duration": 10000000, "start": 0 },
      "speed": 1.0,
      "target_timerange": { "duration": 10000000, "start": 0 },
      "template_id": "",
      "template_scene": "default",
      "track_attribute": 0,
      "track_render_index": 0,
      "uniform_scale": null,
      "visible": true,
      "volume": 1.0
    }
  ],
  "type": "video"
}
```

### materials.videos 单条字段（待验证）

```json
{
  "aigc_type": "none",
  "audio_fade": null,
  "cartoon_path": "",
  "category_id": "",
  "category_name": "local",
  "check_flag": 63487,
  "crop": { "lower_left_x": 0.0, "lower_left_y": 1.0, "lower_right_x": 1.0, "lower_right_y": 1.0,
            "upper_left_x": 0.0, "upper_left_y": 0.0, "upper_right_x": 1.0, "upper_right_y": 0.0 },
  "crop_ratio": "free",
  "crop_scale": 1.0,
  "duration": 10000000,
  "extra_type_option": 0,
  "file_Path": "C:/absolute/path/to/video.mp4",
  "formula_id": "",
  "freeze": null,
  "has_audio": true,
  "height": 1080,
  "id": "<uuid>",
  "import_time": 1234567890,
  "import_time_ms": 1234567890123,
  "is_ai_matting_valid_cache": false,
  "is_unified_beauty_valid_cache": false,
  "local_material_id": "<uuid>",
  "material_id": "<uuid>",
  "material_name": "video_filename.mp4",
  "material_url": "",
  "matting": { ... },
  "media_path": "",
  "object_file_key": "",
  "path": "C:/absolute/path/to/video.mp4",
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
  "video_algorithm": { ... },
  "width": 1920
}
```

### materials.texts 单条字段（待验证）

```json
{
  "alignment": 1,
  "background_alpha": 0.0,
  "background_color": "",
  "background_height": 0.14,
  "background_horizontal_offset": 0.0,
  "background_round_radius": 0.0,
  "background_style": 0,
  "background_vertical_offset": 0.0,
  "background_width": 0.14,
  "base_content": "",
  "bold_width": 0.0,
  "border_alpha": 0.0,
  "border_color": "",
  "border_width": 0.08,
  "content": "{\"styles\": [{\"fill\": {\"content\": {\"render_type\": \"solid\", \"solid\": {\"alpha\": 1.0, \"color\": [1.0, 1.0, 1.0]}}}, \"range\": [0, <text_len>], \"useStyle\": \"\"}], \"text\": \"<字幕文字>\"}",
  "font_category_id": "",
  "font_category_name": "",
  "font_id": "",
  "font_name": "",
  "font_path": "",
  "font_size": 8.0,
  "fonts": [],
  "id": "<uuid>",
  "italic": false,
  "letter_spacing": 0.0,
  "line_feed": 1,
  "line_max_width": 0.82,
  "line_spacing": 0.02,
  "name": "",
  "original_size": [],
  "preset_id": "",
  "recognize_task_id": "",
  "recognize_type": 0,
  "relevance_segment": [],
  "shadow_alpha": 0.0,
  "shadow_angle": -45.0,
  "shadow_color": "",
  "shadow_distance": 5.0,
  "shadow_point": { "x": 0.6364, "y": -0.6364 },
  "shadow_smoothing": 1.0,
  "shape_clip_x": false,
  "shape_clip_y": false,
  "source_from": "",
  "style_name": "",
  "sub_type": 0,
  "text_alpha": 1.0,
  "text_color": "#FFFFFF",
  "text_curve": null,
  "text_preset_resource_id": "",
  "text_size": 30,
  "text_to_audio_ids": [],
  "tts_auto_update": false,
  "type": "text",
  "typesetting": 0,
  "underline": false,
  "underline_offset": 0.22,
  "underline_width": 0.05,
  "use_effect_default_color": true,
  "words": { "end_time": [], "start_time": [], "text": [] }
}
```

---

## 验证日志

（inspect_draft.py 输出结果粘贴于此）

---

## 最小草稿生成测试日志

（create_minimal_draft.py 输出结果粘贴于此）

---

## 结论

待填写。
