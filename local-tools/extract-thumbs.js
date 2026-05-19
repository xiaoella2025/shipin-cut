/**
 * 用 FFmpeg 截取视频缩略图（20% / 50% / 80% 位置）
 * 运行: npm run extract:thumbs -- "视频文件路径"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run extract:thumbs -- "视频文件路径"')
  console.error('示例: npm run extract:thumbs -- "D:/videos/test.mp4"')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`✗ 文件不存在: ${inputPath}`)
  process.exit(1)
}

// 读取时长
const probeCmd = `ffprobe -v quiet -print_format json -show_format "${inputPath}"`
let duration = 30
try {
  const raw  = execSync(probeCmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const fmt  = JSON.parse(raw).format || {}
  const d    = parseFloat(fmt.duration)
  if (!isNaN(d) && d > 0) duration = d
} catch {
  console.warn('⚠  无法读取时长，使用默认 30s')
}

// 计算安全时间点：视频 20% / 50% / 80% 位置，至少距首尾 0.5 秒
const margin = Math.min(0.5, duration * 0.05)
const positions = [0.2, 0.5, 0.8].map(p =>
  Math.min(Math.max(p * duration, margin), duration - margin)
)

const outDir   = path.join(__dirname, '..', 'local-output', 'thumbs')
fs.mkdirSync(outDir, { recursive: true })

const baseName  = path.basename(inputPath, path.extname(inputPath))
const thumbPaths = []

console.log(`正在截取缩略图: ${path.basename(inputPath)} (时长 ${duration.toFixed(1)}s)`)

for (let i = 0; i < positions.length; i++) {
  const ts      = positions[i].toFixed(3)
  const outFile = path.join(outDir, `${baseName}_${String(i + 1).padStart(3, '0')}.jpg`)
  const cmd     = `ffmpeg -y -ss ${ts} -i "${inputPath}" -frames:v 1 -q:v 2 "${outFile}"`
  try {
    execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
    thumbPaths.push(outFile)
    const pct = Math.round(positions[i] / duration * 100)
    console.log(`  ✓ thumb ${i + 1}: ${ts}s (${pct}%) → ${path.basename(outFile)}`)
  } catch (e) {
    console.warn(`  ⚠  缩略图 ${i + 1} 截取失败 (ts=${ts}s)`)
  }
}

if (thumbPaths.length > 0) {
  console.log(`\n✓ 共截取 ${thumbPaths.length}/3 张缩略图，保存在:\n  ${outDir}`)
} else {
  console.log('\n⚠  没有成功截取任何缩略图，请检查视频文件。')
  process.exit(1)
}

module.exports = { thumbPaths }
