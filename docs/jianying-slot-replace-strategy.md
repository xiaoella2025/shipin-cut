# 剪映草稿模板槽位替换策略

## 背景

前几轮验证表明，只修改 `draft_info.json` 的明文时间线并不足以让剪映 GUI 按新结构恢复草稿。脚本层可以把草稿检查成 `3V/1A/3T`、5 秒时间线，但剪映打开后仍可能读取原 Storybound 的 11:52 时间线。

这个现象说明剪映 GUI 恢复时间线时，不只依赖 `draft_info.json`。`draft_content.json`、`template-2.tmp`、`Timelines` 下的文件等 opaque 内容仍然参与控制 GUI 看到的时间线拓扑。当前我们还没有掌握这些 opaque 文件的正确编码和重建方式，所以继续从零重建 `tracks` / `materials` / `segments` 只会造成“脚本检查通过，GUI 打开失败或读取旧时间线”。

## 新策略

v0.9.9-step3 改为模板槽位替换法：

1. 使用一个剪映或 Storybound 已经能打开的草稿作为模板。
2. 完整复制模板目录到新草稿目录。
3. 不重写 `draft_content.json`。
4. 不重写根目录 `template-2.tmp`。
5. 不重写 `Timelines/<id>/template-2.tmp`。
6. 不重写 `draft_meta_info.json`。
7. 不新增或删除 track。
8. 不新增或删除 segment。
9. 不改变 track、segment、material 之间的 id 引用关系。
10. 只在根目录 `draft_info.json` 中替换已有 video/audio/text material 槽位的明文字段。

槽位替换的核心是保留模板已有的时间线拓扑和 opaque 文件，只把已有槽位里的素材路径、素材名称和字幕文本替换成测试内容。这样更接近 Storybound 的稳定生成方式：基于可用模板替换内容，而不是重新发明剪映草稿编码。

## 成功标准

本阶段不要求把原始 11:52 时间线改成 5 秒，也不要求减少轨道或片段数量。成功标准是：

1. 剪映草稿列表能看到新草稿。
2. 剪映 GUI 能打开新草稿。
3. 打开后不出现 Media Not Found。
4. 视频槽位的素材被替换为测试 mp4。
5. 音频槽位的素材被替换为测试 mp3。
6. 前三条字幕槽位显示：
   - `CLEAN 字幕 1`
   - `CLEAN 字幕 2`
   - `CLEAN 字幕 3`

如果这一步成功，再让用户在剪映里手工创建一个 5 秒、3 视频、1 音频、3 字幕的专用模板草稿。随后用同样的槽位替换法生成最终目标草稿。

## 失败判定

如果槽位替换后的草稿仍然不能打开，或者打开后素材/字幕替换完全不生效，则说明剪映 GUI 可能连这些 `draft_info.json` 明文字段也不作为真实数据源。这时必须转向研究 opaque 文件编码，或者放弃直写剪映草稿路线，改用剪映导入能力、自动化 GUI、或其他官方/半官方接口。

## 当前脚本边界

`tools/jianying_draft/template_slot_replace_draft.py` 只做以下事情：

1. 复制模板草稿目录到输出草稿目录。
2. 把输入 mp4 复制到 `output/assets/video/`。
3. 把输入 mp3 复制到 `output/assets/audio/`。
4. 替换已有 `materials.videos` 槽位的路径和名称。
5. 替换已有 `materials.audios` 槽位的路径和名称。
6. 替换已有 `materials.texts` 的前三条字幕文本。
7. 对结构包模板中原本缺失的剩余媒体路径，用测试素材补齐，避免 GUI 出现 Media Not Found。

脚本不会重建 timeline，不会清空 Storybound 原始时间线，也不会修改 opaque 文件。
