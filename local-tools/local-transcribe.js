/**
 * 一键视频字幕识别：检测环境 → 抽取音频 → 调用 whisper.cpp → 输出 SRT + JSON
 * 运行: npm run local:transcribe -- "视频文件路径"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

// ─── 参数检查 ────────────────────────────────────────────────────────────────

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run local:transcribe -- "视频文件路径"')
  console.error('示例: npm run local:transcribe -- "D:/videos/test.mp4"')
  process.exit(1)
}

if (!fs.existsSync(inputPath)) {
  console.error(`✗ 文件不存在: ${inputPath}`)
  process.exit(1)
}

const absInput = path.resolve(inputPath)
const baseName = path.basename(absInput, path.extname(absInput))

// ─── 读取配置 ────────────────────────────────────────────────────────────────

const configPath = path.join(__dirname, 'whisper.config.json')
if (!fs.existsSync(configPath)) {
  console.error('✗ 找不到配置文件: local-tools/whisper.config.json')
  console.error('  请先创建配置文件，参考 LOCAL_VIDEO_TOOLS.md')
  process.exit(1)
}

let config
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
} catch (e) {
  console.error('✗ 配置文件解析失败:', e.message)
  process.exit(1)
}

const { whisperCliPath, modelPath, language = 'zh', threads = 4 } = config
const absModel = path.isAbsolute(modelPath) ? modelPath : path.resolve(process.cwd(), modelPath)

console.log('═══════════════════════════════════════════')
console.log('  本地视频字幕识别  (shipin-cut v0.3)')
console.log('═══════════════════════════════════════════')
console.log(`文件: ${path.basename(absInput)}\n`)

// ─── Step 1: 检测 FFmpeg ────────────────────────────────────────────────────

console.log('── Step 1: 检测 FFmpeg ──')
function checkBin(name) {
  try { execSync(`"${name}" -version 2>&1`, { shell: true, stdio: 'pipe' }); return true } catch { return false }
}
if (!checkBin('ffmpeg') || !checkBin('ffprobe')) {
  console.error('✗ FFmpeg / ffprobe 不可用，请安装后重试')
  console.error('  下载: https://ffmpeg.org/download.html')
  process.exit(1)
}
console.log('✓ FFmpeg 可用\n')

// ─── Step 2: 检测 whisper.cpp ─────────────────────────────────────────────

console.log('── Step 2: 检测 whisper.cpp ──')

process.stdout.write('  whisper-cli... ')
let whisperOk = false
try {
  execSync(`"${whisperCliPath}" --help 2>&1 || "${whisperCliPath}" -h 2>&1`, {
    shell: true, encoding: 'utf8', stdio: 'pipe'
  })
  whisperOk = true
  console.log('✓')
} catch {
  console.log('✗')
}

process.stdout.write('  模型文件... ')
const modelOk = fs.existsSync(absModel)
if (modelOk) {
  const mb = (fs.statSync(absModel).size / 1024 / 1024).toFixed(1)
  console.log(`✓ (${mb} MB)`)
} else {
  console.log('✗')
}

if (!whisperOk || !modelOk) {
  console.error('\n✗ whisper.cpp 环境未就绪，请运行 npm run check:whisper 查看详情')
  process.exit(1)
}
console.log()

// ─── Step 3: 检测音频轨，抽取音频 ─────────────────────────────────────────

console.log('── Step 3: 抽取音频 (WAV 16kHz mono) ──')

// 用 ffprobe 检查是否有音频流
let hasAudio = false
try {
  const probeOut = execSync(
    `ffprobe -v quiet -print_format json -show_streams "${absInput}"`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
  const streams = JSON.parse(probeOut).streams || []
  hasAudio = streams.some(s => s.codec_type === 'audio')
} catch {
  console.warn('⚠  无法读取视频流信息，尝试继续...')
  hasAudio = true  // 乐观尝试
}

if (!hasAudio) {
  console.error('✗ 视频无音频轨，无法进行字幕识别')
  process.exit(1)
}

const audioDir = path.join(__dirname, '..', 'local-output', 'audio')
fs.mkdirSync(audioDir, { recursive: true })
const audioPath = path.join(audioDir, `${baseName}.wav`)

try {
  execSync(
    `ffmpeg -y -i "${absInput}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}"`,
    { stdio: 'pipe' }
  )
  const mb = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)
  console.log(`✓ 音频已保存 (${mb} MB): ${path.relative(process.cwd(), audioPath)}\n`)
} catch (e) {
  console.error('✗ 音频抽取失败:', e.message.split('\n')[0])
  process.exit(1)
}

// ─── Step 4: whisper.cpp 字幕识别 ────────────────────────────────────────

console.log('── Step 4: whisper.cpp 字幕识别（可能需要数十秒）──')

const subtitleDir = path.join(__dirname, '..', 'local-output', 'subtitles')
fs.mkdirSync(subtitleDir, { recursive: true })

const outPrefix = path.join(subtitleDir, baseName)
const srtPath   = outPrefix + '.srt'
const txtPath   = outPrefix + '.txt'
const jsonOut   = outPrefix + '.subtitles.json'

// 与手动验证命令保持一致: whisper-cli -m model -f audio -l zh -osrt -otxt -of prefix
const cmdParts = [
  `"${whisperCliPath}"`,
  `-m "${absModel}"`,
  `-f "${audioPath}"`,
  `-l ${language}`,
]
if (threads) cmdParts.push(`-t ${threads}`)
cmdParts.push('-osrt', '-otxt', `-of "${outPrefix}"`)
const cmd = cmdParts.join(' ')

console.log('命令:')
console.log('  ' + cmd)
console.log()

try {
  execSync(cmd, {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
    stdio: 'pipe',
  })
  console.log('✓ 识别完成\n')
} catch (e) {
  const errMsg = (e.stderr || e.stdout || e.message || '').split('\n').slice(0, 5).join('\n  ')
  console.error('✗ whisper-cli 执行失败:')
  console.error('  ' + errMsg)
  process.exit(1)
}

// ─── Step 5: 解析 SRT → 生成统一 JSON ────────────────────────────────────

console.log('── Step 5: 生成 subtitles.json ──')

let segments = []

if (fs.existsSync(srtPath)) {
  try {
    const srtContent = fs.readFileSync(srtPath, 'utf8').replace(/^﻿/, '')  // 去除 BOM
    segments = parseSrt(srtContent)
    console.log(`✓ 从 SRT 解析 ${segments.length} 条字幕`)
  } catch (e) {
    console.warn('⚠  SRT 解析失败:', e.message)
  }
} else {
  console.warn(`⚠  未找到 SRT 文件: ${path.relative(process.cwd(), srtPath)}`)
}

const result = {
  sourceVideo:  path.relative(process.cwd(), absInput).replace(/\\/g, '/'),
  sourceAudio:  path.relative(process.cwd(), audioPath).replace(/\\/g, '/'),
  language,
  segmentCount: segments.length,
  segments,
  createdAt:    new Date().toISOString(),
}

fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2), 'utf8')
console.log(`✓ 已保存: ${path.relative(process.cwd(), jsonOut)}\n`)

// ─── 完成摘要 ──────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════')
console.log('  字幕识别完成')
console.log('═══════════════════════════════════════════')
console.log()
console.log(`共识别 ${segments.length} 条字幕`)

if (segments.length > 0) {
  console.log()
  console.log('前 5 条预览:')
  segments.slice(0, 5).forEach(s => {
    console.log(`  [${s.id}] ${secToHms(s.start)} --> ${secToHms(s.end)}`)
    console.log(`       ${s.text}`)
  })
}

console.log()
console.log('输出文件:')
console.log(`  音频:    ${path.relative(process.cwd(), audioPath)}`)
if (fs.existsSync(srtPath)) console.log(`  SRT:     ${path.relative(process.cwd(), srtPath)}`)
if (fs.existsSync(txtPath)) console.log(`  TXT:     ${path.relative(process.cwd(), txtPath)}`)
console.log(`  JSON:    ${path.relative(process.cwd(), jsonOut)}`)
console.log()
console.log('说明: 当前为 v0.3 whisper.cpp 能力验证，尚未接入前端或真实视频合成。')

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function srtTimeToSec(str) {
  if (!str) return null
  const m = str.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return null
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
}

function secToHms(sec) {
  if (sec == null) return '??:??:??.???'
  const h  = Math.floor(sec / 3600)
  const mi = Math.floor((sec % 3600) / 60)
  const s  = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
}

function parseSrt(content) {
  // 统一换行符，兼容 Windows \r\n
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n{2,}/)
  const result  = []
  for (const block of blocks) {
    const lines    = block.trim().split('\n')
    if (lines.length < 3) continue
    const idLine   = lines[0].trim()
    const timeLine = lines[1].trim()
    const text     = lines.slice(2).map(l => l.trim()).filter(Boolean).join(' ')
    const id       = parseInt(idLine, 10)
    const tm       = timeLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/)
    if (!tm || !text) continue
    result.push({
      id:    isNaN(id) ? result.length + 1 : id,
      start: srtTimeToSec(tm[1]),
      end:   srtTimeToSec(tm[2]),
      text,
    })
  }
  return result
}
