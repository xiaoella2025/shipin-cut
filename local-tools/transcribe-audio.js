/**
 * 调用本地 whisper.cpp 对 WAV 音频进行字幕识别
 * 输出: local-output/subtitles/{basename}.srt + {basename}.txt + {basename}.subtitles.json
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
const absModel = path.isAbsolute(modelPath)
  ? modelPath
  : path.resolve(process.cwd(), modelPath)

// ─── 准备输出目录 ─────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '..', 'local-output', 'subtitles')
fs.mkdirSync(outDir, { recursive: true })

const outPrefix = path.join(outDir, baseName)
const srtPath   = outPrefix + '.srt'
const txtPath   = outPrefix + '.txt'
const jsonOut   = outPrefix + '.subtitles.json'

console.log('═══════════════════════════════════════════')
console.log('  whisper.cpp 字幕识别  (shipin-cut v0.3)')
console.log('═══════════════════════════════════════════')
console.log(`音频: ${path.relative(process.cwd(), absInput)}`)
console.log(`模型: ${absModel}`)
console.log(`语言: ${language}  线程: ${threads}`)
console.log()

// ─── 调用 whisper-cli ─────────────────────────────────────────────────────────
// 与手动验证命令保持一致: whisper-cli -m model -f audio -l zh -osrt -otxt -of prefix

const parts = [
  `"${whisperCliPath}"`,
  `-m "${absModel}"`,
  `-f "${absInput}"`,
  `-l ${language}`,
]
if (threads) parts.push(`-t ${threads}`)
parts.push('-osrt', '-otxt', `-of "${outPrefix}"`)

const cmd = parts.join(' ')

console.log('── 正在识别字幕（可能需要数十秒）... ──')
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
  console.log('✓ whisper-cli 执行完成')
} catch (e) {
  console.error('✗ whisper-cli 执行失败:')
  const errMsg = (e.stderr || e.stdout || e.message || '').split('\n').slice(0, 5).join('\n  ')
  console.error('  ' + errMsg)
  console.error()
  console.error('  请确认:')
  console.error('    1. whisperCliPath 路径正确 (运行 npm run check:whisper 检测)')
  console.error('    2. 模型文件存在: ' + absModel)
  console.error('    3. 音频文件为 16kHz 单声道 WAV (用 npm run extract:audio 生成)')
  process.exit(1)
}

// ─── 诊断：列出 whisper 实际生成的文件 ───────────────────────────────────────

console.log()
console.log('whisper 生成的文件:')
try {
  const allFiles = fs.readdirSync(outDir)
  const myFiles  = allFiles.filter(f => f.startsWith(baseName))
  if (myFiles.length === 0) {
    console.log('  (无)')
  } else {
    myFiles.forEach(f => {
      const full = path.join(outDir, f)
      const size = fs.statSync(full).size
      console.log(`  ${f}  (${size} bytes)`)
    })
  }
} catch (e) {
  console.warn('  无法读取目录:', e.message)
}
console.log()

// ─── 解析 SRT → segments ─────────────────────────────────────────────────────

let segments = []

if (!fs.existsSync(srtPath)) {
  console.warn(`⚠  未找到 SRT 文件: ${path.relative(process.cwd(), srtPath)}`)
  console.warn('   whisper-cli 可能未正确输出到该路径，请检查命令输出')
} else {
  const srtContent = fs.readFileSync(srtPath, 'utf8').replace(/^﻿/, '')  // 去除 BOM
  segments = parseSrt(srtContent)
  if (segments.length > 0) {
    console.log(`✓ 从 SRT 解析 ${segments.length} 条字幕`)
  } else {
    console.warn('⚠  SRT 文件存在但解析出 0 条字幕（文件可能为空或格式异常）')
    // 打印文件开头帮助诊断
    const preview = srtContent.slice(0, 300)
    if (preview.trim()) {
      console.log('SRT 文件内容预览:')
      console.log(preview.split('\n').map(l => '  ' + l).join('\n'))
    }
  }
}

// ─── 生成统一 subtitles.json ──────────────────────────────────────────────────

const result = {
  sourceAudio:  path.relative(process.cwd(), absInput).replace(/\\/g, '/'),
  language,
  segmentCount: segments.length,
  segments,
  createdAt:    new Date().toISOString(),
}

fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2), 'utf8')

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
    console.log(`  [${s.id}] ${secToHms(s.start)} --> ${secToHms(s.end)}`)
    console.log(`       ${s.text}`)
  })
}

console.log()
console.log('输出文件:')
if (fs.existsSync(srtPath)) console.log(`  SRT:  ${path.relative(process.cwd(), srtPath)}`)
if (fs.existsSync(txtPath)) console.log(`  TXT:  ${path.relative(process.cwd(), txtPath)}`)
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
  const h  = Math.floor(sec / 3600)
  const mi = Math.floor((sec % 3600) / 60)
  const s  = Math.floor(sec % 60)
  const ms = Math.round((sec - Math.floor(sec)) * 1000)
  return `${String(h).padStart(2,'0')}:${String(mi).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(ms).padStart(3,'0')}`
}

function parseSrt(content) {
  // 统一换行符
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const blocks = normalized.trim().split(/\n{2,}/)
  const result  = []

  for (const block of blocks) {
    const lines    = block.trim().split('\n')
    if (lines.length < 3) continue

    const idLine   = lines[0].trim()
    const timeLine = lines[1].trim()
    const text     = lines.slice(2).map(l => l.trim()).filter(Boolean).join(' ')

    const id = parseInt(idLine, 10)
    const tm = timeLine.match(/(\d+:\d+:\d+[,.]\d+)\s*-->\s*(\d+:\d+:\d+[,.]\d+)/)
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

module.exports = { segments, jsonOut, srtPath, txtPath }
