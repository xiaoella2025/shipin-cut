# 本地视频工具 (v0.2 FFmpeg 能力验证)

这组脚本在本机开发环境中运行，用于通过 Node.js 调用本地 FFmpeg 完成视频分析、抽音频、截缩略图等操作。

**这些脚本与前端页面完全独立，不影响 GitHub Pages 部署。**

---

## 前置条件

### 需要本机安装

| 工具 | 说明 | 下载 |
|------|------|------|
| Node.js | 运行脚本 | https://nodejs.org |
| FFmpeg  | 视频处理 | https://ffmpeg.org/download.html |

### FFmpeg 安装说明（Windows）

1. 从 https://ffmpeg.org/download.html 下载 Windows 版本
2. 解压到例如 `C:\ffmpeg\`
3. 将 `C:\ffmpeg\bin` 加入系统环境变量 `PATH`
4. 打开新的命令行，运行 `ffmpeg -version` 验证

---

## 检测 FFmpeg 环境

```
npm run check:ffmpeg
```

检查本机 ffmpeg 和 ffprobe 是否可用，输出版本信息。

**成功输出示例：**
```
✓ FFmpeg  可用
  ffmpeg version 6.1 ...
✓ ffprobe 可用
  ffprobe version 6.1 ...

✓ 检测通过，可以运行本地视频分析脚本。
```

**失败时：** 会提示安装方式，不会继续执行。

---

## 分析视频信息

```
npm run analyze:video -- "D:/videos/test.mp4"
```

使用 ffprobe 读取视频的真实参数，输出：文件名、时长、分辨率、帧率、视频/音频编码、码率、格式等。

生成文件：`local-output/analysis/test.analysis.json`

**输出 JSON 示例：**
```json
{
  "filename": "test.mp4",
  "sourcePath": "D:/videos/test.mp4",
  "fileSize": 52428800,
  "duration": 45.3,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "videoCodec": "h264",
  "audioCodec": "aac",
  "hasAudio": true,
  "bitrate": 9000000,
  "format": "mov,mp4,m4a,3gp,3g2,mj2",
  "createdAt": "2026-05-19T00:00:00.000Z"
}
```

读取不到的字段填 `null`，不会报错崩溃。

---

## 抽取音频

```
npm run extract:audio -- "D:/videos/test.mp4"
```

从视频中抽取音频，输出 WAV 文件（16kHz，单声道，pcm_s16le 格式）。

输出文件：`local-output/audio/test.wav`

**说明：**
- 视频没有音频轨时，会给出提示并安全退出（不报错）
- 当前只抽取音频，**尚未接入 Whisper 字幕识别**

---

## 截取缩略图

```
npm run extract:thumbs -- "D:/videos/test.mp4"
```

截取视频 20%、50%、80% 位置的帧，保存为 JPG 图片。

输出文件：
```
local-output/thumbs/test_001.jpg   ← 约 20% 位置
local-output/thumbs/test_002.jpg   ← 约 50% 位置
local-output/thumbs/test_003.jpg   ← 约 80% 位置
```

**说明：**
- 视频较短时会自动选择安全时间点，不会截到黑帧边缘
- 输出格式为 JPG

---

## 一键本地分析（推荐）

```
npm run local:analyze -- "D:/videos/test.mp4"
```

依次执行以下步骤：

1. 检测 FFmpeg / ffprobe 环境
2. 用 ffprobe 分析视频信息
3. 用 FFmpeg 抽取音频（WAV 16kHz）
4. 用 FFmpeg 截取缩略图（3 张）
5. 生成完整的 `analysis.json`

**生成的 JSON 示例：**
```json
{
  "filename": "test.mp4",
  "sourcePath": "D:/videos/test.mp4",
  "duration": 45.3,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "videoCodec": "h264",
  "audioCodec": "aac",
  "hasAudio": true,
  "bitrate": 9000000,
  "format": "mov,mp4,m4a,3gp,3g2,mj2",
  "audioPath": "local-output/audio/test.wav",
  "thumbnails": [
    "local-output/thumbs/test_001.jpg",
    "local-output/thumbs/test_002.jpg",
    "local-output/thumbs/test_003.jpg"
  ],
  "createdAt": "2026-05-19T00:00:00.000Z"
}
```

---

## 输出文件位置

```
local-output/
├── audio/
│   └── test.wav              ← 抽取的音频（16kHz mono WAV）
├── thumbs/
│   ├── test_001.jpg          ← 缩略图 1（20% 位置）
│   ├── test_002.jpg          ← 缩略图 2（50% 位置）
│   └── test_003.jpg          ← 缩略图 3（80% 位置）
└── analysis/
    └── test.analysis.json    ← 视频分析结果
```

**这些输出文件已加入 `.gitignore`，不会提交到仓库。**

---

## 当前能力范围

| 功能 | 状态 |
|------|------|
| FFmpeg / ffprobe 检测 | ✓ 已完成 |
| 视频信息读取（ffprobe） | ✓ 已完成 |
| 音频抽取（16kHz WAV） | ✓ 已完成 |
| 缩略图截取（JPG） | ✓ 已完成 |
| analysis.json 生成 | ✓ 已完成 |
| Whisper 字幕识别 | ✗ 尚未接入（v0.3 计划） |
| 真实视频混剪导出 | ✗ 尚未实现（待 FFmpeg 合成阶段） |
| 真实 MP4 合成 | ✗ 尚未实现 |
| 前端与本地工具联动 | ✗ 尚未实现（需要本地服务层） |

---

## 脚本文件

```
local-tools/
├── package.json          ← 声明 CommonJS 模式（仅供本地脚本使用）
├── check-ffmpeg.js       ← FFmpeg 环境检测
├── analyze-video.js      ← 视频信息分析
├── extract-audio.js      ← 抽取音频
├── extract-thumbs.js     ← 截取缩略图
└── local-analyze.js      ← 一键综合分析
```

这些脚本仅依赖 Node.js 内置模块（`child_process`、`fs`、`path`），无需安装额外 npm 包。
