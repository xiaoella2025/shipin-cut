# 本地视频工具 (v0.3 whisper.cpp 字幕识别)

这组脚本在本机开发环境中运行，用于通过 Node.js 调用本地 FFmpeg 和 whisper.cpp 完成视频分析、抽音频、截缩略图、字幕识别等操作。

**这些脚本与前端页面完全独立，不影响 GitHub Pages 部署。**

---

## 前置条件

### 需要本机安装

| 工具 | 说明 | 下载 |
|------|------|------|
| Node.js      | 运行脚本           | https://nodejs.org |
| FFmpeg       | 视频处理           | https://ffmpeg.org/download.html |
| whisper.cpp  | 本地语音识别（v0.3）| https://github.com/ggerganov/whisper.cpp |

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

---

## whisper.cpp 安装说明

### 编译 whisper.cpp（推荐）

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
make
# 下载中文识别模型（base，约 142 MB）
bash models/download-ggml-model.sh base
```

编译后会生成 `whisper-cli`（Windows 上为 `whisper-cli.exe`）。

### 配置 whisper.config.json

编辑 `local-tools/whisper.config.json`：

```json
{
  "whisperCliPath": "/path/to/whisper.cpp/whisper-cli",
  "modelPath": "/path/to/whisper.cpp/models/ggml-base.bin",
  "language": "zh",
  "threads": 4
}
```

| 字段 | 说明 |
|------|------|
| `whisperCliPath` | whisper-cli 可执行文件路径（可以是绝对路径或 PATH 中的命令名） |
| `modelPath`      | ggml 模型文件路径（绝对路径或相对于项目根目录） |
| `language`       | 识别语言，`zh` 为中文，`auto` 为自动检测 |
| `threads`        | CPU 线程数，建议 4–8 |

---

## 检测 whisper.cpp 环境

```
npm run check:whisper
```

验证 `whisperCliPath` 可执行、`modelPath` 文件存在。

**成功输出示例：**
```
── 检测 whisper.cpp 环境 ──

配置文件: local-tools/whisper.config.json
  whisperCliPath : /usr/local/bin/whisper-cli
  modelPath      : models/ggml-base.bin
  ...

检测 whisper-cli 可执行文件... ✓ 可用
检测模型文件... ✓ 存在 (141.1 MB): /home/user/models/ggml-base.bin

✓ 检测通过，可以运行字幕识别脚本。
```

---

## 识别音频字幕

```
npm run transcribe:audio -- "local-output/audio/test.wav"
```

对指定 WAV 文件调用 whisper.cpp，输出 SRT 和 JSON。

**要求：** 音频须为 16kHz 单声道 WAV（用 `npm run extract:audio` 生成）。

**输出文件：**
```
local-output/subtitles/test.srt             ← SRT 字幕文件
local-output/subtitles/test.subtitles.json  ← 统一格式 JSON
```

**subtitles.json 格式：**
```json
{
  "sourceAudio": "local-output/audio/test.wav",
  "language": "zh",
  "segmentCount": 12,
  "segments": [
    { "id": 1, "start": 0.0,  "end": 3.2,  "text": "大家好，今天我们来聊一聊" },
    { "id": 2, "start": 3.5,  "end": 6.1,  "text": "这个话题非常有趣" }
  ],
  "createdAt": "2026-05-19T00:00:00.000Z"
}
```

---

## 一键视频字幕识别（推荐）

```
npm run local:transcribe -- "D:/videos/test.mp4"
```

依次执行：

1. 检测 FFmpeg 环境
2. 检测 whisper.cpp 环境（读取 whisper.config.json）
3. 用 FFmpeg 抽取音频（WAV 16kHz 单声道）
4. 调用 whisper.cpp 进行语音识别
5. 生成 `subtitles.srt` 和 `subtitles.json`

**输出文件：**
```
local-output/
├── audio/
│   └── test.wav
└── subtitles/
    ├── test.srt                ← SRT 字幕
    └── test.subtitles.json     ← 统一 JSON（含 sourceVideo / sourceAudio / segments）
```

---

## 当前能力范围

| 功能 | 状态 |
|------|------|
| FFmpeg / ffprobe 检测 | ✓ 已完成 |
| 视频信息读取（ffprobe） | ✓ 已完成 |
| 音频抽取（16kHz WAV） | ✓ 已完成 |
| 缩略图截取（JPG） | ✓ 已完成 |
| analysis.json 生成 | ✓ 已完成 |
| whisper.cpp 字幕识别 | ✓ 已完成（v0.3） |
| 真实视频混剪导出 | ✗ 尚未实现（待 FFmpeg 合成阶段） |
| 真实 MP4 合成 | ✗ 尚未实现 |
| 前端与本地工具联动 | ✗ 尚未实现（需要本地服务层） |

---

## 脚本文件

```
local-tools/
├── package.json          ← 声明 CommonJS 模式（仅供本地脚本使用）
├── whisper.config.json   ← whisper.cpp 配置（路径、模型、语言、线程数）
├── check-ffmpeg.js       ← FFmpeg 环境检测
├── analyze-video.js      ← 视频信息分析
├── extract-audio.js      ← 抽取音频
├── extract-thumbs.js     ← 截取缩略图
├── local-analyze.js      ← 一键综合分析（v0.2）
├── check-whisper.js      ← whisper.cpp 环境检测（v0.3）
├── transcribe-audio.js   ← 音频字幕识别（v0.3）
└── local-transcribe.js   ← 一键视频字幕识别（v0.3）
```

这些脚本仅依赖 Node.js 内置模块（`child_process`、`fs`、`path`），无需安装额外 npm 包。
