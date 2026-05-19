/**
 * 用 ffprobe 读取视频信息并生成 analysis.json
 * 运行: npm run analyze:video -- "视频文件路径"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run analyze:video -- "视频文件路径"')
  console.error('示例: npm run analyze:video -- "D:/videos/test.mp4"')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`✗ 文件不存在: ${inputPath}`)
  process.exit(1)
}

console.log(`正在分析: ${path.basename(inputPath)}`)

const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${inputPath}"`
let probe
try {
  const raw = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  probe = JSON.parse(raw)
} catch (e) {
  console.error('✗ ffprobe 执行失败:', e.message.split('\n')[0])
  process.exit(1)
}

const fmt     = probe.format  || {}
const streams = probe.streams || []
const vStream = streams.find(s => s.codec_type === 'video')
const aStream = streams.find(s => s.codec_type === 'audio')

function safeNum(v) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function parseFps(s) {
  if (!s) return null
  const p = s.split('/')
  if (p.length === 2 && +p[1]) return Math.round(+p[0] / +p[1] * 100) / 100
  return safeNum(s)
}

const analysis = {
  filename:    path.basename(inputPath),
  sourcePath:  path.resolve(inputPath),
  fileSize:    safeNum(fmt.size),
  duration:    safeNum(fmt.duration),
  width:       vStream?.width  ?? null,
  height:      vStream?.height ?? null,
  fps:         parseFps(vStream?.r_frame_rate),
  videoCodec:  vStream?.codec_name ?? null,
  audioCodec:  aStream?.codec_name ?? null,
  hasAudio:    !!aStream,
  bitrate:     safeNum(fmt.bit_rate),
  format:      fmt.format_name ?? null,
  createdAt:   new Date().toISOString(),
}

// Save JSON
const outDir  = path.join(__dirname, '..', 'local-output', 'analysis')
fs.mkdirSync(outDir, { recursive: true })
const baseName = path.basename(inputPath, path.extname(inputPath))
const outPath  = path.join(outDir, `${baseName}.analysis.json`)
fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2), 'utf8')

// Print summary
console.log('\n── 视频信息 ────────────────────────────')
console.log(`文件名:   ${analysis.filename}`)
console.log(`时长:     ${analysis.duration != null ? analysis.duration.toFixed(2) + ' 秒' : '未知'}`)
console.log(`分辨率:   ${analysis.width ?? '?'} × ${analysis.height ?? '?'}`)
console.log(`帧率:     ${analysis.fps ?? '?'} fps`)
console.log(`视频编码: ${analysis.videoCodec ?? '未知'}`)
console.log(`音频编码: ${analysis.audioCodec ?? '无'}`)
console.log(`有音频:   ${analysis.hasAudio ? '是' : '否'}`)
console.log(`码率:     ${analysis.bitrate ? Math.round(analysis.bitrate / 1000) + ' kbps' : '未知'}`)
console.log(`格式:     ${analysis.format ?? '未知'}`)
console.log(`文件大小: ${analysis.fileSize ? (analysis.fileSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}`)
console.log('────────────────────────────────────────')
console.log(`\n✓ analysis.json 已保存:\n  ${outPath}`)

module.exports = { analysis, outPath }
