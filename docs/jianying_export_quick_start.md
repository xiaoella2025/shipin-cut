# 剪映草稿导出快速入门

> 适用于：普通用户 / 助理

---

## 这个功能是做什么的

将 shipin-cut 生成的成品视频（mp4）和字幕（srt）自动转换为**剪映专业版可打开的草稿**，方便在剪映里做进一步编辑。

---

## 输入需要什么

| 输入 | 是否必填 | 说明 |
|------|----------|------|
| 成品 mp4 | 必填 | shipin-cut 导出的视频文件 |
| srt 字幕 | 可选 | 对应的字幕文件 |

---

## 输出是什么

一个剪映专业版草稿，可直接在剪映里打开、编辑、导出。

---

## 运行命令

```bash
# 完整指定视频 + 字幕 + 草稿名
F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/python tools/export_with_jianying.py --mp4 F:/shipin-cut/export_workspace/videos/2.mp4 --srt F:/shipin-cut/local-output/subtitles/2.srt --name MY_DRAFT_001
```

**参数说明：**
- `--mp4`：成品视频路径
- `--srt`：字幕文件路径（可选）
- `--name`：草稿名称（可选，不填则自动带时间戳）

---

## 剪映里怎么验证

1. **关闭剪映**（重要）
2. 打开**任务管理器**，确认没有 `JianyingPro.exe`
3. 重新打开剪映专业版
4. 在草稿列表找到你的草稿名
5. 点击打开，检查：
   - 视频画面是否正常播放
   - 时间线是否有视频片段
   - 字幕轨是否有字幕文字
   - 字幕时间是否和视频对得上

---

## 常见问题

### 草稿列表没显示新草稿
- 确认剪映已**完全关闭**（任务管理器里没有 JianyingPro.exe）
- 草稿存在路径：`C:/Users/Admin/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/`
- 重新打开剪映试试

### 视频显示"媒体丢失"
- 视频文件路径变了，需要重新指定 `--mp4`
- 检查视频文件是否还在原位置

### 字幕乱码
- 确认 srt 文件是 UTF-8 编码（带 BOM）
- 用记事本打开 srt 确认内容正确

### 字幕不对齐
- 检查 srt 文件里的时间轴是否正确
- 确认视频时长和字幕时长大致吻合

### 同名草稿怎么办
- 脚本会自动**删除同名草稿后重建**
- 如果需要保留旧草稿，给新草稿取不同的名字

---

## 重要提醒

**请勿删除以下草稿和目录：**
- `PYJIANYING_TEST_1V1T`
- `MIXCUT_EMPTY_TEMPLATE`
- `Storybound` 相关样本草稿
- `docs/` 目录下的研究文档

**请勿：**
- 手动修改 `draft_content.json`（会损坏草稿）
- 使用 `capcut-cli`（生成的草稿不兼容剪映专业版）
- 继续研究草稿二进制格式（已验证通过，不需要再研究）

---

## 技术支持

如遇问题，请检查：
1. `F:/shipin-cut/docs/pyjianying_export_integration.md` — 详细技术文档
2. `F:/shipin-cut/tools/export_with_jianying.py` — 主流程接入点脚本
3. `F:/shipin-cut/tools/jianying_draft/export_with_pyjianying.py` — 核心导出脚本