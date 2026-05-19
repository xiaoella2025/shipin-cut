/**
 * 检测本机 FFmpeg / ffprobe 是否可用
 * 运行: npm run check:ffmpeg
 */
const { execSync } = require('child_process')

function checkBin(name) {
  try {
    const out = execSync(`${name} -version`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const firstLine = out.split('\n')[0].trim()
    return { ok: true, version: firstLine }
  } catch {
    return { ok: false }
  }
}

console.log('─────────────────────────────────────')
console.log('  FFmpeg 环境检测')
console.log('─────────────────────────────────────')

const ffmpeg  = checkBin('ffmpeg')
const ffprobe = checkBin('ffprobe')

if (ffmpeg.ok) {
  console.log('✓ FFmpeg  可用')
  console.log('  ' + ffmpeg.version)
} else {
  console.log('✗ FFmpeg  未找到')
}

if (ffprobe.ok) {
  console.log('✓ ffprobe 可用')
  console.log('  ' + ffprobe.version)
} else {
  console.log('✗ ffprobe 未找到')
}

if (!ffmpeg.ok || !ffprobe.ok) {
  console.log('\n请确认 FFmpeg 已安装并加入系统 PATH。')
  console.log('下载地址: https://ffmpeg.org/download.html')
  process.exit(1)
}

console.log('\n✓ 检测通过，可以运行本地视频分析脚本。')
