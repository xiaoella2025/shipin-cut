# 剪映/CapCut 草稿生成开源项目调研报告

> 调研日期：2026/06/08
> 目标：找到能接入 shipin-cut 的草稿生成库

---

## 推荐排序

| 排名 | 项目 | 语言 | GitHub Stars | 最后更新 | 推荐理由 |
|------|------|------|-------------|----------|---------|
| 1 | **capcut-cli** | Node.js | 53 | 2026-06-08 | 零依赖、纯 CLI、Windows 可用、支持jianying命名空间 |
| 2 | **pyJianYingDraft** | Python | 3,409 | 2026-06-01 | 最成熟、中文剪映专用、模板替换功能完善 |
| 3 | **VectCutAPI** | Python | 1,970 | 2026-06-05 | 云端渲染 + 草稿生成、MCP 协议支持 |
| 4 | **capcut-mate** | Python | 1,133 | 2026-06-08 | REST API + FastAPI、Docker部署、Coze 集成 |
| 5 | **pyCapCut** | Python | 523 | 2025-09-12 | CapCut 国际版对应版、同作者维护中 |
| 6 | **JyDraft** | C# | 81 | 2026-02-11 | C# 唯一选项、支持加密草稿解密、云渲染 |

---

## 各项目详情

### 1. capcut-cli⭐ 最推荐

**GitHub：** https://github.com/renezander030/capcut-cli

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持（本地文件/Wikimedia Commons） |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持（SRT 导入 + Whisper 自动字幕） |
| 贴纸/特效 | ✅ 支持（keyframe/transition/mask/bubble text 等） |
| 生成可编辑草稿 | ✅ 生成 `draft_content.json`，CapCut/Jianying 可直接打开 |
| 版本要求 | 无明确版本限制，支持 `--jianying` 切换命名空间 |
| 导出 MP4 | 需要打开 CapCut/Jianying 客户端 |

**接入成本：** 低
- 零运行时依赖（Node.js >= 18 内置 API）
- 全局安装：`npm install -g capcut-cli`
- 或构建源码：`npm install && npm run build`
- 纯 CLI，可在脚本中调用

**独特优势：**
-零额外依赖，解压即用
-包含 ffmpeg 代理渲染预览（无需打开剪映）
- 内置 6 个模板，支持模板保存/应用
- `compile` 命令：从声明式 JSON 规范生成草稿
- 支持 `set-text` / `shift` / `speed` / `volume` / `trim` 等编辑操作
- 支持 MCP 协议（可被 AI Agent 驱动）
- 支持 JSONL job runner（n8n/Make/Coze 自动化）
- Windows/Mac/Linux 跨平台

**风险：**
- Stars 仅 53，项目较新（2026 年4 月创建）
- 2026-06-08 有更新，但长期稳定性待观察

---

### 2. pyJianYingDraft

**GitHub：** https://github.com/GuanYixuan/pyJianYingDraft

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持 |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持（SRT 导入、自动换行） |
| 贴纸/特效 | ✅ 支持（keyframe/transition/mask/filter） |
| 生成可编辑草稿 | ✅ 生成 `draft_content.json`（Jianying 可打开） |
| 版本要求 | Jianying 5+ 通用的草稿可生成；模板替换仅支持 5.9 及以下（6+ 加密） |
| 导出 MP4 | 需要 Jianying 客户端打开并手动导出 |

**接入成本：** 低
- `pip install pyJianYingDraft`
- Python 3.8+ / 3.11 推荐
- 无系统级依赖

**独特优势：**
- **3,409 Stars**，最成熟项目
- 来自同一作者有 **pyCapCut**（国际版对应）
- 模板模式：加载现有 `draft_content.json`，替换材料/文本，导入轨道
- 批量导出控制（需打开 Jianying 客户端）
- 支持视频旋转/缩放/亮度调整，关键帧动画
- 音频淡入淡出，音量关键帧
- Apache 2.0 许可证

**风险：**
- **Jianying 6+ 的草稿已加密**，模板替换功能受限
- 批量导出需要 Jianying 客户端保持打开
- Stars3,409 但模板功能有版本限制

---

### 3. VectCutAPI

**GitHub：** https://github.com/sun-guannan/VectCutAPI

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持 |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持（SRT 导入） |
| 贴纸/特效 | ✅ 支持（视觉特效/滤镜/转场动画） |
| 生成可编辑草稿 | ✅ 生成 Jianying/CapCut 草稿文件 |
| 版本要求 | 无明确版本限制 |
| 导出 MP4 | **支持云端渲染**（无需客户端） |

**接入成本：** 中
- Python 3.10+
- 需要 FFmpeg
- HTTP API 服务器（端口 9001）
- 可选 MCP 协议支持

**独特优势：**
- **云端渲染**：无需安装剪映，直接从草稿生成最终视频
- MCP 协议支持（AI Agent 集成）
- RESTful API（`/docs` 自动生成文档）
- 支持 Coze / Dify / n8n / Claude Code / Trae 集成
- 1,970 Stars，活跃维护

**风险：**
- 云端渲染可能涉及 API成本（需确认定价）
- 需要部署 HTTP 服务（增加运维复杂度）

---

### 4. capcut-mate

**GitHub：** https://github.com/Hommy-master/capcut-mate

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持 |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持 |
| 贴纸/特效 | ✅ 支持 |
| 生成可编辑草稿 | ✅ 支持 |
| 版本要求 | 无明确版本限制 |
| 导出 MP4 | **支持云端渲染** |

**接入成本：** 中
- Python 3.11+
- FastAPI + Pydantic
- Docker部署支持
- uv 包管理器

**独特优势：**
- RESTful API + 自动文档
- Coze 插件集成
- Docker 一键部署
-1,133 Stars，最新更新就在今天（2026-06-08）
-关键帧控制、文本样式、动画效果

**风险：**
- 依赖较多（FastAPI/Pydantic/Uvicorn/uv）
- Docker部署有额外复杂度

---

### 5. pyCapCut

**GitHub：** https://github.com/GuanYixuan/pyCapCut

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持 |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持 |
| 生成可编辑草稿 | ✅ 生成 `draft_content.json`（CapCut 可打开） |
| 版本要求 | 非加密 CapCut 草稿 |
| 导出 MP4 | 需要 CapCut 客户端 |

**接入成本：** 低
- `pip install pycapcut`
- Python 3.8+ / 3.11 推荐

**风险：**
- Stars 仅 523，最后更新 2025-09-12（相对较旧）
- 主要维护精力在 pyJianYingDraft

---

### 6. JyDraft

**GitHub：** https://github.com/HTWMedia/JyDraft

**能力矩阵：**

| 能力 | 支持情况 |
|------|---------|
| 视频轨 | ✅ 支持 |
| 音频轨 | ✅ 支持 |
| 字幕轨 | ✅ 支持 |
| 生成可编辑草稿 | ✅ 生成 `draft_content.json` |
| 版本要求 | 支持加密草稿自动解密 |
| 导出 MP4 | **云端渲染**（无需 Jianying） |

**接入成本：** 中
- C# / .NET
- 提供预编译二进制（Releases页面）

**风险：**
- Stars 仅 81，活跃度最低
- C# 项目，接入 shipin-cut（Python）需跨语言调用
- 最后更新 2026-02-11

---

## 接入 shipin-cut 的可行性分析

### shipin-cut 现状况
- 主语言：Python（纯 Python 项目）
- 现有草稿工具：`tools/jianying_draft/` 下多个脚本
- 已有 `create_from_real_template.py`、`create_1v1a1t.py`、`template_slot_replace_draft.py`

### 推荐接入方案

**首选：capcut-cli**

理由：
1. **零额外依赖** — Node.js >= 18 自带，无需安装 pip 包
2. **纯 CLI 调用** — `subprocess.run()` 即可集成到 Python 项目
3. **支持 jianying 命名空间** — `--jianying` 标志切换
4. **声明式草稿生成** — `capcut compile` 从 JSON spec 生成草稿
5. **Windows兼容** — Node.js 在 Windows 上运行良好
6. **可被 AI Agent 驱动** — 支持 MCP 协议，符合 shipin-cut 的 Agent 设计方向

**次选：pyJianYingDraft**

理由：
1. **pip 安装** — `pip install pyJianYingDraft`，与 shipin-cut 无缝集成
2. **模板替换模式** — 加载现有草稿，替换材料/文本，最接近 shipin-cut 现有流程
3. **最成熟** — 3,409 Stars，长期维护
4. **中文剪映专用** — 针对剪映而非国际版 CapCut

### 不推荐的方案

- **VectCutAPI / capcut-mate 云渲染** — 需要部署 HTTP 服务，增加运维复杂度
- **JyDraft** — C#，跨语言调用成本高
- **pyCapCut** — 国际版，shipin-cut 应针对中文剪映

---

## 降级方案

如果开源库均无法满足需求：

**降级方案："导出素材包 + 手动导入剪映"**

1. shipin-cut 导出时生成一个**素材包目录**：
   ```
   output/
     assets/
       video/clip1.mp4
       audio/bgm.mp3
     manifest.json   ← 包含时间线信息（文本格式）
   ```
2. 用户手动将 `assets/` 下的文件导入剪映
3. manifest.json 记录的时间线信息用于用户手动重建时间线

**优点**：完全不依赖剪映草稿文件格式
**缺点**：需要用户手动操作，非自动化

---

## 总结

| 项目 | 推荐度 | 接入成本 | 版本风险 | 草稿可编辑 | 云端导出 |
|------|--------|----------|----------|------------|---------|
| **capcut-cli** | ⭐⭐⭐ 首选 | 低 | 低 | ✅ | ❌ 需客户端 |
| **pyJianYingDraft** | ⭐⭐⭐ 首选 | 低 | 中（Jianying 6+ 加密） | ✅ | ❌ 需客户端 |
| **VectCutAPI** | ⭐⭐ | 中 | 低 | ✅ | ✅ 云渲染 |
| **capcut-mate** | ⭐⭐ | 中 | 低 | ✅ | ✅ 云渲染 |
| **pyCapCut** | ⭐ | 低 | 低 | ✅ | ❌ 需客户端 |
| **JyDraft** | ⭐ | 高 | 低 | ✅ | ✅ 云渲染 |

**最推荐：capcut-cli + pyJianYingDraft 双轨并行**

- 先用 capcut-cli 验证草稿生成和打开流程（最快验证）
- 后续如有复杂时间线需求，再用 pyJianYingDraft 的模板替换功能

---

## 下一步建议

1. **立即测试 capcut-cli** — 在 Windows 上 `npm install -g capcut-cli`，验证能否生成可打开的剪映草稿
2. **测试 pyJianYingDraft 模板模式** — 用 `pip install pyJianYingDraft`，基于真实草稿测试模板替换
3. **不要继续手写二进制** — 当前 `draft_content.json` 的 opaque格式研究应暂停，交给成熟库处理
4. **如果两个库都验证成功** — 在 `tools/jianying_draft/` 下新增 `capcut_cli_wrapper.py` 或 `pyjianying_wrapper.py`，封装 CLI/Python 调用