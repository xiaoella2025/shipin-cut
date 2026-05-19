/**
 * 本地视频一键分析：检测环境 → 分析信息 → 抽音频 → 截缩略图 → 生成 analysis.json
 * 运行: npm run local:analyze -- "视频文件路径"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

// ─── 参数检查 ────────────────────────────────────────────────────────────────

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run local:analyze -- "视频文件路径"')
  console.error('示例: npm run local:analyze -- "D:/videos/test.mp4"')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`✗ 文件不存在: ${inputPath}`)
  process.exit(1)
}

const absInput = path.resolve(inputPath)
const baseName = path.basename(absInput, path.extname(absInput))

console.log('═══════════════════════════════════════════')
console.log('  本地视频一键分析  (shipin-cut v0.2)')
console.log('═══════════════════════════════════════════')
console.log(`文件: ${path.basename(absInput)}\n`)

// ─── Step 1: 检测 FFmpeg ────────────────────────────────────────────────────

console.log('── Step 1: 检测 FFmpeg 环境 ──')
function checkBin(name) {
  try { execSync(`${name} -version`, { stdio: 'pipe' }); return true } catch { return false }
}
const ok = checkBin('ffmpeg') && checkBin('ffprobe')
if (!ok) {
  console.error('✗ FFmpeg / ffprobe 不可用，请安装后重试。')
  console.error('  下载: https://ffmpeg.org/download.html')
  process.exit(1)
}
console.log('✓ FFmpeg 可用  ✓ ffprobe 可用\n')

// ─── Step 2: 分析视频信息 ──────────────────────────────────────────────────

console.log('── Step 2: 分析视频信息 (ffprobe) ──')
const probeCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${absInput}"`
let probe
try {
  probe = JSON.parse(execSync(probeCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }))
} catch (e) {
  console.error('✗ ffprobe 失败:', e.message.split('\n')[0])
  process.exit(1)
}

const fmt     = probe.format  || {}
const streams = probe.streams || []
const vStream = streams.find(s => s.codec_type === 'video')
const aStream = streams.find(s => s.codec_type === 'audio')

function safeNum(v) { const n = parseFloat(v); return isNaN(n) ? null : n }
function parseFps(s) {
  if (!s) return null
  const p = s.split('/')
  if (p.length === 2 && +p[1]) return Math.round(+p[0] / +p[1] * 100) / 100
  return safeNum(s)
}

const duration = safeNum(fmt.duration)
console.log(`✓ 时长: ${duration != null ? duration.toFixed(2) + 's' : '?'} | ` +
            `${vStream?.width ?? '?'}×${vStream?.height ?? '?'} | ` +
            `${parseFps(vStream?.r_frame_rate) ?? '?'}fps | ` +
            `${vStream?.codec_name ?? '?'} / ${aStream?.codec_name ?? '无音频'}\n`)

// ─── Step 3: 抽取音频 ──────────────────────────────────────────────────────

console.log('── Step 3: 抽取音频 (WAV 16kHz mono) ──')
let audioPath = null
const audioDir = path.join(__dirname, '..', 'local-output', 'audio')
fs.mkdirSync(audioDir, { recursive: true })

if (!aStream) {
  console.log('⚠  无音频轨，跳过\n')
} else {
  audioPath = path.join(audioDir, `${baseName}.wav`)
  try {
    execSync(
      `ffmpeg -y -i "${absInput}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}"`,
      { stdio: 'pipe' }
    )
    const mb = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)
    console.log(`✓ 音频已保存 (${mb} MB): ${path.relative(process.cwd(), audioPath)}\n`)
  } catch (e) {
    console.warn('⚠  音频抽取失败:', e.message.split('\n')[0])
    audioPath = null
    console.log()
  }
}

// ─── Step 4: 截取缩略图 ────────────────────────────────────────────────────

console.log('── Step 4: 截取缩略图 (20% / 50% / 80%) ──')
const thumbDir = path.join(__dirname, '..', 'local-output', 'thumbs')
fs.mkdirSync(thumbDir, { recursive: true })

const dur    = duration || 30
const margin = Math.min(0.5, dur * 0.05)
const times  = [0.2, 0.5, 0.8].map(p => Math.min(Math.max(p * dur, margin), dur - margin))
const thumbPaths = []

for (let i = 0; i < times.length; i++) {
  const ts      = times[i].toFixed(3)
  const outFile = path.join(thumbDir, `${baseName}_${String(i + 1).padStart(3, '0')}.jpg`)
  try {
    execSync(`ffmpeg -y -ss ${ts} -i "${absInput}" -frames:v 1 -q:v 2 "${outFile}"`, { stdio: 'pipe' })
    thumbPaths.push(outFile)
    console.log(`  ✓ thumb ${i + 1}: ${ts}s → ${path.basename(outFile)}`)
  } catch {
    console.warn(`  ⚠  thumb ${i + 1} 失败 (ts=${ts}s)`)
  }
}
console.log()

// ─── Step 5: 生成 analysis.json ────────────────────────────────────────────

console.log('── Step 5: 生成 analysis.json ──')
const analysis = {
  filename:    path.basename(absInput),
  sourcePath:  absInput,
  fileSize:    safeNum(fmt.size),
  duration,
  width:       vStream?.width  ?? null,
  height:      vStream?.height ?? null,
  fps:         parseFps(vStream?.r_frame_rate),
  videoCodec:  vStream?.codec_name ?? null,
  audioCodec:  aStream?.codec_name ?? null,
  hasAudio:    !!aStream,
  bitrate:     safeNum(fmt.bit_rate),
  format:      fmt.format_name ?? null,
  audioPath:   audioPath
    ? path.relative(process.cwd(), audioPath).replace(/\\/g, '/')
    : null,
  thumbnails:  thumbPaths.map(p => path.relative(process.cwd(), p).replace(/\\/g, '/')),
  createdAt:   new Date().toISOString(),
}

const analysisDir  = path.join(__dirname, '..', 'local-output', 'analysis')
fs.mkdirSync(analysisDir, { recursive: true })
const analysisPath = path.join(analysisDir, `${baseName}.analysis.json`)
fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf8')
console.log(`✓ 已保存: ${path.relative(process.cwd(), analysisPath)}\n`)

// ─── 完成摘要 ──────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════')
console.log('  一键分析完成')
console.log('═══════════════════════════════════════════')
console.log()
console.log('输出文件:')
if (audioPath)        console.log(`  音频:     ${path.relative(process.cwd(), audioPath)}`)
thumbPaths.forEach(p  => console.log(`  缩略图:   ${path.relative(process.cwd(), p)}`))
console.log(`  JSON:     ${path.relative(process.cwd(), analysisPath)}`)
console.log()
console.log('JSON 内容:')
console.log(JSON.stringify(analysis, null, 2))
console.log()
console.log('说明: 当前为 v0.2 FFmpeg 能力验证，尚未接入 Whisper 字幕识别或真实视频合成。')
