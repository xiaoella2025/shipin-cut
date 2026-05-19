/**
 * 用 FFmpeg 从视频中抽取音频 (16kHz mono WAV)
 * 运行: npm run extract:audio -- "视频文件路径"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run extract:audio -- "视频文件路径"')
  console.error('示例: npm run extract:audio -- "D:/videos/test.mp4"')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`✗ 文件不存在: ${inputPath}`)
  process.exit(1)
}

// 检查是否有音频轨
const probeCmd = `ffprobe -v quiet -print_format json -show_streams "${inputPath}"`
let streams = []
try {
  const raw = execSync(probeCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  streams = JSON.parse(raw).streams || []
} catch (e) {
  console.error('✗ ffprobe 执行失败:', e.message.split('\n')[0])
  process.exit(1)
}

const hasAudio = streams.some(s => s.codec_type === 'audio')
if (!hasAudio) {
  console.log('⚠  该视频没有音频轨，跳过音频抽取。')
  process.exit(0)
}

const outDir   = path.join(__dirname, '..', 'local-output', 'audio')
fs.mkdirSync(outDir, { recursive: true })

const baseName = path.basename(inputPath, path.extname(inputPath))
const outPath  = path.join(outDir, `${baseName}.wav`)

console.log(`正在抽取音频: ${path.basename(inputPath)}`)
console.log(`输出格式: WAV 16kHz mono (pcm_s16le)`)

const cmd = `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${outPath}"`
try {
  execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
} catch (e) {
  console.error('✗ FFmpeg 抽取音频失败:')
  console.error(e.stderr?.toString().split('\n').slice(-5).join('\n') || e.message)
  process.exit(1)
}

const sizeMB = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2)
console.log(`\n✓ 音频已保存 (${sizeMB} MB):\n  ${outPath}`)
console.log('\n说明: 当前只抽取音频，暂未接入 Whisper 字幕识别。')

module.exports = { audioPath: outPath }
