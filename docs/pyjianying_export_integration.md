# pyJianYingDraft 导出集成报告

> 日期：2026/06/08
> 状态：✅ 已验证通过，已接入主流程
> 目标：将 shipin-cut 成品视频/字幕导出为剪映草稿

---

## 最终结论

**真实 mp4 + 真实 srt → 剪映可打开草稿 链路已验证成功。**

---

## 已验证通过的草稿列表

| 草稿名 | 生成方式 | 剪映验证结果 |
|--------|----------|-------------|
| PYJIANYING_TEST_1V1T | pyJianYingDraft 原始测试 | ✅ 可显示 ✅ 可打开 ✅ 有视频 ✅ 有字幕 |
| MIXCUT_EXPORT_TEST_20260608_001 | export_with_pyjianying.py | ✅ 可显示 ✅ 可打开 ✅ 有视频 ✅ 有3条测试字幕 |
| MIXCUT_REAL_EXPORT_TEST_001 | export_with_pyjianying.py + 真实素材 | ✅ 可显示 ✅ 可打开 ✅ 视频正常 ✅ 时间线约01:16 ✅ 字幕轨中文正常 |
| MIXCUT_MAINFLOW_TEST_001 | tools/export_with_jianying.py 主流程接入点 | ✅ 可显示 ✅ 可打开 ✅ 视频正常 ✅ 时间线约01:16 ✅ 字幕轨中文正常 |

---

## 成功链路

```
shipin-cut 成品视频 mp4
    +
    真实 srt 字幕
        ↓
    tools/export_with_jianying.py    （主流程接入点）
        ↓
    tools/jianying_draft/export_with_pyjianying.py   （核心导出脚本）
        ↓
    剪映可打开草稿
```

---

## 核心文件

| 文件 | 说明 |
|------|------|
| `tools/jianying_draft/export_with_pyjianying.py` | 核心导出脚本，使用 `DraftFolder.create_draft()` + `sf.save()` |
| `tools/export_with_jianying.py` | shipin-cut 主流程最小接入点，可独立调用 |

---

## 使用命令示例

```bash
# 通过主流程接入点（推荐）
F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/python tools/export_with_jianying.py \
  --mp4 F:/shipin-cut/export_workspace/videos/2.mp4 \
  --srt F:/shipin-cut/local-output/subtitles/2.srt \
  --name MIXCUT_MAINFLOW_TEST_001

# 直接调用核心脚本
F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/python tools/jianying_draft/export_with_pyjianying.py \
  --video F:/shipin-cut/export_workspace/videos/2.mp4 \
  --srt F:/shipin-cut/local-output/subtitles/2.srt \
  --name MIXCUT_REAL_EXPORT_TEST_001
```

---

## 依赖环境

- Python 解释器：`F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/python`
- 依赖包：`pyJianYingDraft`

安装方式：
```bash
python -m venv F:/shipin-cut/tmp/pyjianying_probe/.venv
F:/shipin-cut/tmp/pyjianying_probe/.venv/Scripts/pip install pyJianYingDraft
```

---

## 验证方法

1. 关闭剪映
2. 任务管理器确认没有 `JianyingPro.exe`
3. 重新打开剪映专业版
4. 在草稿列表查找草稿名
5. 打开草稿，检查：
   - 视频画面是否正常播放
   - 时间线是否有视频片段
   - 字幕轨是否有字幕文字
   - 字幕时间是否和视频对得上

---

## 脚本稳定要求（必须遵守）

**必须使用 `DraftFolder.create_draft()` + `sf.save()` 组合**：
- ✅ `DraftFolder.create_draft()` 创建目录 + `draft_meta_info.json`
- ✅ `sf.save()` 写入 `draft_content.json`
- ❌ 禁止使用只写 `draft_content.json` 的 `sf.dump()` 方式

**每次生成草稿必须包含 4 个文件**：

| 文件 | 必须包含 |
|------|---------|
| `draft_content.json` | ✅ 由 `sf.save()` 写入 |
| `draft_meta_info.json` | ✅ 由 `create_draft()` 从模板复制，后续手动更新 |
| `timeline_layout.json` | ✅ 脚本手动写入 |
| `draft_settings` | ✅ 脚本手动写入 |

---

## 当前限制（第一阶段）

- **只支持一个成品 mp4 + 一个 srt → 一个剪映草稿**
- 不支持多片段模式
- 不支持批量导出
- 不支持 UI 接入
- 不做滤镜 / 贴纸 / 去重
- 不做剪映二进制研究
- 固定分辨率 1920x1080
- 无音频轨（当前只支持视频轨+字幕轨）

---

## 不再继续的方向

以下方向已确认放弃，不再研究：
- ❌ `capcut-cli` — 生成 CapCut 明文 JSON，不兼容剪映专业版
- ❌ `draft_content.json` 二进制/base64 格式研究
- ❌ `template-2.tmp` 结构研究
- ❌ 剪映草稿槽位替换（视频内嵌在 base64 二进制中，无法外部替换）
- ❌ Storybound 草稿格式研究
- ❌ 手动写 draft_content 二进制
- ❌ 多片段模式
- ❌ 批量导出
- ❌ UI 接入

---

## 下一阶段建议

1. **先用 3-5 个真实成品 mp4 + srt 连续验证稳定性**，确认不同视频都能正常生成草稿
2. **再考虑接 UI 按钮**，在 shipin-cut 界面加"导出到剪映草稿"按钮
3. **再考虑批量**，一次处理多个成品视频
4. **多片段模式放后续**，不要现在做，等单片段稳定后再研究
5. **优先保证草稿可被剪映正常打开**，不追求功能复杂，先稳定再扩展