/**
 * 批量视频字幕识别
 * 运行: npm run batch:transcribe
 * 指定目录: npm run batch:transcribe -- "D:/videos"
 * 指定单文件: npm run batch:transcribe -- "D:/videos/test.mp4"
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv'])

// ─── 参数解析 ───────────────────────────────────────────────────────────────

const argPath  = process.argv[2]
const inputArg = argPath ? path.resolve(argPath) : path.join(ROOT, 'input-videos')

let videoFiles = []

if (argPath && !fs.existsSync(inputArg)) {
  console.error(`✗ 路径不存在: ${inputArg}`)
  process.exit(1)
}

if (fs.statSync(inputArg).isFile()) {
  const ext = path.extname(inputArg).toLowerCase()
  if (!VIDEO_EXTS.has(ext)) {
    console.error(`✗ 不支持的视频格式: ${ext}`)
    process.exit(1)
  }
  videoFiles = [inputArg]
} else {
  // 扫描目录
  videoFiles = fs.readdirSync(inputArg)
    .filter(f => VIDEO_EXTS.has(path.extname(f).toLowerCase()))
    .sort()
    .map(f => path.join(inputArg, f))
}

if (videoFiles.length === 0) {
  console.log(`⚠  在 ${inputArg} 中未找到视频文件`)
  console.log(`   支持格式: ${[...VIDEO_EXTS].join(' ')}`)
  process.exit(0)
}

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
const absModel = path.isAbsolute(modelPath) ? modelPath : path.resolve(ROOT, modelPath)

// ─── 环境检测 ────────────────────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════')
console.log('  批量视频字幕识别  (shipin-cut v0.5)')
console.log('═══════════════════════════════════════════════════════')
console.log(`输入目录: ${path.dirname(videoFiles[0])}`)
console.log(`共找到  : ${videoFiles.length} 个视频\n`)

function checkBin(name) {
  try { execSync(`"${name}" -version 2>&1`, { shell: true, stdio: 'pipe' }); return true } catch { return false }
}

process.stdout.write('检测 FFmpeg ... ')
if (!checkBin('ffmpeg') || !checkBin('ffprobe')) {
  console.log('✗')
  console.error('✗ FFmpeg / ffprobe 不可用，请安装后重试')
  process.exit(1)
}
console.log('✓')

process.stdout.write('检测 whisper-cli ... ')
let whisperOk = false
try {
  execSync(`"${whisperCliPath}" --help 2>&1 || "${whisperCliPath}" -h 2>&1`, { shell: true, stdio: 'pipe' })
  whisperOk = true
  console.log('✓')
} catch { console.log('✗') }

process.stdout.write('检测模型文件 ... ')
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

// ─── 输出目录 ────────────────────────────────────────────────────────────────

const audioDir    = path.join(ROOT, 'local-output', 'audio')
const subtitleDir = path.join(ROOT, 'local-output', 'subtitles')
fs.mkdirSync(audioDir,    { recursive: true })
fs.mkdirSync(subtitleDir, { recursive: true })

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function srtTimeToSec(str) {
  if (!str) return null
  const m = str.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return null
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000
}

function parseSrt(content) {
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

// ─── 处理单个视频（返回 manifest item） ────────────────────────────────────

function processVideo(absInput, index, total) {
  const baseName  = path.basename(absInput, path.extname(absInput))
  const audioPath = path.join(audioDir, `${baseName}.wav`)
  const outPrefix = path.join(subtitleDir, baseName)
  const srtPath   = outPrefix + '.srt'
  const txtPath   = outPrefix + '.txt'
  const jsonOut   = outPrefix + '.subtitles.json'

  const relInput = path.relative(ROOT, absInput).replace(/\\/g, '/')
  const relAudio = path.relative(ROOT, audioPath).replace(/\\/g, '/')
  const relJson  = path.relative(ROOT, jsonOut).replace(/\\/g, '/')

  console.log(`\n${'─'.repeat(55)}`)
  console.log(`[${index}/${total}] 正在处理 ${path.basename(absInput)}`)
  console.log(`${'─'.repeat(55)}`)

  // Step A: 检测音频轨
  let hasAudio = false
  try {
    const probeOut = execSync(
      `ffprobe -v quiet -print_format json -show_streams "${absInput}"`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
    const streams = JSON.parse(probeOut).streams || []
    hasAudio = streams.some(s => s.codec_type === 'audio')
  } catch {
    hasAudio = true
  }

  if (!hasAudio) {
    console.log('  ✗ 无音频轨，跳过')
    return { videoFilename: path.basename(absInput), baseName, status: 'failed', error: '无音频轨' }
  }

  // Step B: 抽取音频
  process.stdout.write('  抽取音频 ... ')
  try {
    execSync(
      `ffmpeg -y -i "${absInput}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}"`,
      { stdio: 'pipe' }
    )
    const mb = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(2)
    console.log(`✓ (${mb} MB)`)
  } catch (e) {
    const msg = (e.message || '').split('\n')[0]
    console.log('✗')
    console.log(`  错误: ${msg}`)
    return { videoFilename: path.basename(absInput), baseName, status: 'failed', error: '音频抽取失败: ' + msg }
  }

  // Step C: whisper 识别
  process.stdout.write('  字幕识别 (whisper) ... ')
  const cmdParts = [
    `"${whisperCliPath}"`,
    `-m "${absModel}"`,
    `-f "${audioPath}"`,
    `-l ${language}`,
  ]
  if (threads) cmdParts.push(`-t ${threads}`)
  cmdParts.push('-osrt', '-otxt', `-of "${outPrefix}"`)
  const cmd = cmdParts.join(' ')

  try {
    execSync(cmd, { encoding: 'utf8', shell: true, maxBuffer: 50 * 1024 * 1024, stdio: 'pipe' })
    console.log('✓')
  } catch (e) {
    const msg = ((e.stderr || e.stdout || e.message || '').split('\n').slice(0, 3).join(' ')).trim()
    console.log('✗')
    console.log(`  错误: ${msg}`)
    return { videoFilename: path.basename(absInput), baseName, status: 'failed', error: 'whisper 识别失败: ' + msg }
  }

  // Step D: 解析 SRT → JSON
  let segments = []
  if (fs.existsSync(srtPath)) {
    try {
      const srtContent = fs.readFileSync(srtPath, 'utf8').replace(/^﻿/, '')
      segments = parseSrt(srtContent)
      console.log(`  字幕条数: ${segments.length}`)
    } catch (e) {
      console.log(`  ⚠ SRT 解析失败: ${e.message}`)
    }
  } else {
    console.log(`  ⚠ 未生成 SRT 文件`)
  }

  const result = {
    sourceVideo:  relInput,
    sourceAudio:  relAudio,
    language,
    segmentCount: segments.length,
    segments,
    createdAt:    new Date().toISOString(),
  }
  fs.writeFileSync(jsonOut, JSON.stringify(result, null, 2), 'utf8')
  console.log(`  JSON: ${relJson}`)

  return {
    videoFilename: path.basename(absInput),
    baseName,
    status:        'success',
    subtitleJson:  relJson,
    srt:           path.relative(ROOT, srtPath).replace(/\\/g, '/'),
    txt:           path.relative(ROOT, txtPath).replace(/\\/g, '/'),
    segments:      segments.length,
  }
}

// ─── 主循环 ──────────────────────────────────────────────────────────────────

const items = []
const total = videoFiles.length

for (let i = 0; i < videoFiles.length; i++) {
  const item = processVideo(videoFiles[i], i + 1, total)
  items.push(item)
}

// ─── 写入 manifest ───────────────────────────────────────────────────────────

const manifest = {
  createdAt:  new Date().toISOString(),
  sourceDir:  path.relative(ROOT, path.dirname(videoFiles[0])).replace(/\\/g, '/') || 'input-videos',
  items,
}
const manifestPath = path.join(subtitleDir, 'subtitle-manifest.json')
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

// ─── 汇总 ────────────────────────────────────────────────────────────────────

const succeeded = items.filter(x => x.status === 'success')
const failed    = items.filter(x => x.status === 'failed')

console.log('\n' + '═'.repeat(55))
console.log('  批量识别完成')
console.log('═'.repeat(55))
console.log(`成功: ${succeeded.length} 个  失败: ${failed.length} 个`)

if (succeeded.length > 0) {
  console.log('\n已生成 subtitles.json:')
  succeeded.forEach(x => console.log(`  ✓ [${x.segments}条] ${x.subtitleJson}`))
}

if (failed.length > 0) {
  console.log('\n失败列表:')
  failed.forEach(x => console.log(`  ✗ ${x.videoFilename}: ${x.error}`))
}

console.log(`\n清单文件: ${path.relative(ROOT, manifestPath).replace(/\\/g, '/')}`)
console.log()
