/**
 * 检测本机 whisper.cpp CLI 是否可用，读取 whisper.config.json 验证配置
 * 运行: npm run check:whisper
 */
const { execSync } = require('child_process')
const fs   = require('fs')
const path = require('path')

const configPath = path.join(__dirname, 'whisper.config.json')

console.log('── 检测 whisper.cpp 环境 ──\n')

// ─── 读取配置 ──────────────────────────────────────────────────────────────

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

const { whisperCliPath, modelPath, language, threads } = config

console.log('配置文件: local-tools/whisper.config.json')
console.log(`  whisperCliPath : ${whisperCliPath}`)
console.log(`  modelPath      : ${modelPath}`)
console.log(`  language       : ${language}`)
console.log(`  threads        : ${threads}`)
console.log()

let hasError = false

// ─── 检测 whisper-cli 可执行文件 ──────────────────────────────────────────

process.stdout.write('检测 whisper-cli 可执行文件... ')
// 1) 配置里的路径（绝对或 PATH 中）；2) tools/whisper/；3) local-tools/whisper/
const cliCandidates = []
if (whisperCliPath) {
  if (path.isAbsolute(whisperCliPath)) cliCandidates.push(whisperCliPath)
  cliCandidates.push(whisperCliPath) // PATH / shell 解析
}
for (const sub of ['tools', 'local-tools']) {
  for (const name of ['whisper-cli.exe', 'whisper-cli', 'main.exe', 'main']) {
    cliCandidates.push(path.resolve(__dirname, '..', sub, 'whisper', name))
  }
}
let cliFound = null
let lastErr = null
for (const c of cliCandidates) {
  try {
    const out = execSync(`"${c}" --help 2>&1 || "${c}" -h 2>&1`, {
      encoding: 'utf8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    if (out.toLowerCase().includes('usage') || out.toLowerCase().includes('whisper') || out.length > 0) {
      cliFound = c; break
    }
  } catch (e) { lastErr = e; continue }
}
if (cliFound) {
  console.log(`✓ 可用: ${cliFound}`)
} else {
  console.log('✗ 不可用')
  if (lastErr) console.error(`  错误: ${lastErr.message.split('\n')[0]}`)
  console.error('  请确认 whisperCliPath 路径正确，whisper.cpp 已编译或已安装')
  console.error('  参考: https://github.com/ggerganov/whisper.cpp')
  hasError = true
}

// ─── 检测模型文件 ──────────────────────────────────────────────────────────

process.stdout.write('检测模型文件... ')
let absModel = null
const candidates = []
if (path.isAbsolute(modelPath)) {
  candidates.push(modelPath)
} else {
  candidates.push(path.resolve(process.cwd(), modelPath))
  candidates.push(path.resolve(__dirname, '..', modelPath))
  // 兜底：tools/whisper/models/ 与 local-tools/whisper/models/
  candidates.push(path.resolve(__dirname, '..', 'tools', 'whisper', 'models', path.basename(modelPath)))
  candidates.push(path.resolve(__dirname, '..', 'local-tools', 'whisper', 'models', path.basename(modelPath)))
}
for (const c of candidates) {
  if (fs.existsSync(c)) { absModel = c; break }
}
if (absModel) {
  const sizeMB = (fs.statSync(absModel).size / 1024 / 1024).toFixed(1)
  console.log(`✓ 存在 (${sizeMB} MB): ${absModel}`)
} else {
  console.log('✗ 不存在')
  console.error(`  路径: ${absModel}`)
  console.error('  请下载模型文件，例如:')
  console.error('    bash models/download-ggml-model.sh base')
  console.error('  或手动下载: https://huggingface.co/ggerganov/whisper.cpp')
  hasError = true
}

console.log()

if (hasError) {
  console.error('✗ 检测未通过，请按照上述提示修复后重试。')
  process.exit(1)
} else {
  console.log('✓ 检测通过，可以运行字幕识别脚本。')
  console.log()
  console.log('下一步:')
  console.log('  npm run transcribe:audio -- "local-output/audio/test.wav"')
  console.log('  npm run local:transcribe -- "D:/videos/test.mp4"')
}
