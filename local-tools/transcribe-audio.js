/**
 * 调用本地 whisper.cpp 对 WAV 音频进行字幕识别
 * 输出: local-output/subtitles/{basename}.srt + {basename}.subtitles.json
 * 运行: npm run transcribe:audio -- "local-output/audio/test.wav"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

// ─── 参数检查 ────────────────────────────────────────────────────────────────

const inputPath = process.argv[2]
if (!inputPath) {
  console.error('用法: npm run transcribe:audio -- "音频文件路径"')
  console.error('示例: npm run transcribe:audio -- "local-output/audio/test.wav"')
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

// ─── 准备输出目录 ─────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'local-output', 'subtitles')
fs.mkdirSync(outDir, { recursive: true })

const outPrefix = path.join(outDir, baseName)
const srtPath   = outPrefix + '.srt'
const jsonOut   = outPrefix + '.subtitles.json'

console.log('═══════════════════════════════════════════')
console.log('  whisper.cpp 字幕识别  (shipin-cut v0.3)')
console.log('═══════════════════════════════════════════')
console.log(`音频: ${path.basename(absInput)}`)
console.log(`模型: ${absModel}`)
console.log(`语言: ${language}  线程: ${threads}`)
console.log()

// ─── 调用 whisper-cli ─────────────────────────────────────────────────────────

console.log('── 正在识别字幕（可能需要数十秒）... ──')

const cmd = [
  `"${whisperCliPath}"`,
  `-m "${absModel}"`,
  `-f "${absInput}"`,
  `-l ${language}`,
  `-t ${threads}`,
  `-osrt`,
  `-ojson`,
  `-of "${outPrefix}"`,
].join(' ')

let whisperFailed = false
let whisperOutput = ''

try {
  whisperOutput = execSync(cmd, {
    encoding: 'utf8',
    shell: true,
    maxBuffer: 50 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  console.log('✓ whisper-cli 执行完成\n')
} catch (e) {
  whisperFailed = true
  console.error('✗ whisper-cli 执行失败:')
  console.error('  ' + e.message.split('\n')[0])
  console.error()
  console.error('  请确认:')
  console.error('    1. whisperCliPath 路径正确 (运行 npm run check:whisper 检测)')
  console.error('    2. 模型文件存在: ' + absModel)
  console.error('    3. 音频文件为 16kHz 单声道 WAV (用 npm run extract:audio 生成)')
  process.exit(1)
}

// ─── 解析 whisper.cpp JSON 输出 ───────────────────────────────────────────────

const whisperJsonPath = outPrefix + '.json'
let segments = []

if (fs.existsSync(whisperJsonPath)) {
  try {
    const raw = JSON.parse(fs.readFileSync(whisperJsonPath, 'utf8'))
    const items = raw.transcription || raw.segments || []
    segments = items.map((item, idx) => {
      // whisper.cpp JSON 格式: { timestamps: { from, to }, offsets: { from, to }, text }
      // offsets 单位为毫秒
      let start = null
      let end   = null

      if (item.offsets) {
        start = item.offsets.from / 1000
        end   = item.offsets.to   / 1000
      } else if (item.timestamps) {
        start = srtTimeToSec(item.timestamps.from)
        end   = srtTimeToSec(item.timestamps.to)
      } else if (item.start != null) {
        start = item.start
        end   = item.end
      }

      return {
        id:    idx + 1,
        start: start != null ? Math.round(start * 1000) / 1000 : null,
        end:   end   != null ? Math.round(end   * 1000) / 1000 : null,
        text:  (item.text || '').trim(),
      }
    }).filter(s => s.text)

    console.log(`✓ 从 JSON 解析 ${segments.length} 条字幕`)
  } catch (e) {
    console.warn('⚠  解析 whisper JSON 失败，尝试读取 SRT 文件:', e.message.split('\n')[0])
  }
}

// ─── 回退：解析 SRT 文件 ──────────────────────────────────────────────────────

if (segments.length === 0 && fs.existsSync(srtPath)) {
  try {
    segments = parseSrt(fs.readFileSync(srtPath, 'utf8'))
    console.log(`✓ 从 SRT 解析 ${segments.length} 条字幕`)
  } catch (e) {
    console.error('✗ SRT 解析也失败:', e.message)
    process.exit(1)
  }
}

if (segments.length === 0) {
  console.warn('⚠  未识别到任何字幕（音频可能无语音，或模型不匹配语言）')
}

// ─── 生成统一 subtitles.json ──────────────────────────────────────────────────

const result = {
  sourceAudio: path.relative(process.cwd(), absInput).replace(/\\/g, '/'),
  language,
  segmentCount: segments.length,
  segments,
  createdAt: new Date().toISOString(),
}

fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2), 'utf8')
console.log(`✓ 已保存: ${path.relative(process.cwd(), jsonOut)}`)

// 保留 whisper 生成的 SRT 文件
if (fs.existsSync(srtPath)) {
  console.log(`✓ 已保存: ${path.relative(process.cwd(), srtPath)}`)
}

// ─── 摘要 ─────────────────────────────────────────────────────────────────────

console.log()
console.log('═══════════════════════════════════════════')
console.log('  字幕识别完成')
console.log('═══════════════════════════════════════════')
console.log()
console.log(`共识别 ${segments.length} 条字幕`)
if (segments.length > 0) {
  console.log()
  console.log('前 5 条预览:')
  segments.slice(0, 5).forEach(s => {
    const ts = `${secToHms(s.start)} --> ${secToHms(s.end)}`
    console.log(`  [${s.id}] ${ts}`)
    console.log(`       ${s.text}`)
  })
}
console.log()
console.log('输出文件:')
if (fs.existsSync(srtPath)) console.log(`  SRT:  ${path.relative(process.cwd(), srtPath)}`)
console.log(`  JSON: ${path.relative(process.cwd(), jsonOut)}`)

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function srtTimeToSec(str) {
  if (!str) return null
  // 格式: HH:MM:SS,mmm 或 HH:MM:SS.mmm
  const m = str.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return null
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
}

function secToHms(sec) {
  if (sec == null) return '??:??:??.???'
  const h   = Math.floor(sec / 3600)
  const m   = Math.floor((sec % 3600) / 60)
  const s   = Math.floor(sec % 60)
  const ms  = Math.round((sec - Math.floor(sec)) * 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
}

function parseSrt(content) {
  const blocks = content.trim().split(/\n\s*\n/)
  const result = []
  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue
    const idLine   = lines[0].trim()
    const timeLine = lines[1].trim()
    const text     = lines.slice(2).join(' ').trim()
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

module.exports = { segments, jsonOut, srtPath }
