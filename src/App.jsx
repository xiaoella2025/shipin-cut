import { useState, useEffect, useRef, useMemo, Fragment } from 'react'

// ─── constants ───────────────────────────────────────────────────────────────

const TOTAL = 30

const SCENES = [
  { start: 0,    end: 7,    name: '素材_01',   num: 1, bg: 'linear-gradient(160deg,#0f0c29,#1e1060,#0a0728)', color: '#4f46e5' },
  { start: 7.5,  end: 13.5, name: '素材_02-A', num: 2, bg: 'linear-gradient(160deg,#032218,#04422a,#021510)', color: '#059669' },
  { start: 14,   end: 22,   name: '素材_03',   num: 3, bg: 'linear-gradient(160deg,#1c0a00,#3c1a00,#150700)', color: '#b45309' },
  { start: 22.5, end: 27.5, name: '素材_01-B', num: 4, bg: 'linear-gradient(160deg,#0f0c29,#1e1060,#0a0728)', color: '#4f46e5' },
  { start: 27.5, end: 30,   name: '片尾图',    num: 5, bg: 'linear-gradient(160deg,#050505,#0d0d0d,#050505)', color: '#6b7280', isEnd: true },
]

const SUBTITLE_TEXTS = [
  { start: 1,  end: 6,  text: '感受不一样的创意视角' },
  { start: 8,  end: 14, text: '精心混剪，呈现最佳效果' },
  { start: 16, end: 23, text: '智能去重，轻松二创发布' },
]

const WAVE_L = Array.from({ length: 36 }, (_, i) =>
  18 + Math.sin(i * 0.85) * 11 + Math.sin(i * 0.3) * 5 + (i % 7 === 0 ? 6 : 0)
)
const WAVE_MINI = Array.from({ length: 50 }, (_, i) =>
  4 + Math.abs(Math.sin(i * 0.65) * 6) + Math.abs(Math.sin(i * 0.2) * 2)
)

const SUB_TICKS = Array.from({ length: 29 }, (_, i) => i + 1).filter(t => t % 5 !== 0)

const TRACKS_INIT = {
  video:    [],
  image:    [ { id:'i1', name:'片尾图', start:25, dur:5, color:'#0c4a6e' } ],
  audio:    [ { id:'a1', name:'BGM · 背景音乐', start:0, dur:30, color:'#064e3b' } ],
  subtitle: [],
  dedup:    [],
}

const TRACKS_GEN = {
  video:    [
    { id:'v1', name:'素材_01',   start:0,    dur:7,  color:'#3730a3' },
    { id:'v2', name:'素材_02-A', start:7.5,  dur:6,  color:'#5b21b6' },
    { id:'v3', name:'素材_03',   start:14,   dur:8,  color:'#4c1d95' },
    { id:'v4', name:'素材_01-B', start:22.5, dur:5,  color:'#3730a3' },
  ],
  image:    [
    { id:'i1', name:'装饰贴图', start:5,  dur:4, color:'#0c4a6e' },
    { id:'i2', name:'背景底图', start:14, dur:8, color:'#075985' },
    { id:'i3', name:'片尾图',   start:25, dur:5, color:'#0369a1' },
  ],
  audio:    [ { id:'a1', name:'BGM · 背景音乐', start:0, dur:30, color:'#064e3b' } ],
  subtitle: [
    { id:'s1', name:'字幕片段 1', start:1,  dur:5, color:'#78350f' },
    { id:'s2', name:'字幕片段 2', start:8,  dur:6, color:'#92400e' },
    { id:'s3', name:'字幕片段 3', start:16, dur:7, color:'#a16207' },
  ],
  dedup:    [
    { id:'d1', name:'镜像翻转',  start:0,    dur:7, color:'#831843' },
    { id:'d2', name:'变速 0.9×', start:7.5,  dur:6, color:'#9d174d' },
    { id:'d3', name:'裁剪边缘',  start:14,   dur:8, color:'#7f1d1d' },
    { id:'d4', name:'轻微旋转',  start:22.5, dur:5, color:'#831843' },
  ],
}

const TIME_MARKS = [0, 5, 10, 15, 20, 25, 30]
const GEN_STEPS = ['分析素材中…', '计算混剪节点…', '生成轨道布局…', '应用去重处理…', '方案生成完成']

const DEDUP_META = {
  crop:       { label:'裁剪边缘',   ico:'◰', desc:'画面边缘裁剪 4%，规避水印' },
  scale:      { label:'轻微缩放',   ico:'⊞', desc:'整体放大 103%，改变画面边界' },
  mirror:     { label:'镜像翻转',   ico:'⇔', desc:'水平镜像，左右对称变换' },
  speed:      { label:'变速处理',   ico:'⏩', desc:'整体 0.9× 变速，改变节奏' },
  bgImage:    { label:'背景底图',   ico:'▣', desc:'竖屏边缘添加模糊底图' },
  picInPic:   { label:'可见画中画', ico:'⧉', desc:'画面角落添加可见小窗' },
  subDistort: { label:'字幕扰动',   ico:'T',  desc:'字幕时间轴微调，防相似度' },
  endImage:   { label:'片尾图片',   ico:'⬜', desc:'结尾插入品牌片尾图' },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`
}
function fmtMs(s) {
  return `${fmt(s)}.${String(Math.floor((s%1)*10))}`
}
function pct(v) { return `${(v/TOTAL)*100}%` }

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function readVideoMeta(url) {
  return new Promise(resolve => {
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => resolve({ dur: v.duration, width: v.videoWidth, height: v.videoHeight })
    v.onerror = () => resolve({ dur: 0, width: 0, height: 0 })
    v.src = url
  })
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on?'on':''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  )
}

const TRACK_META = {
  video:    { label:'视频轨道', cls:'tl-label-video' },
  image:    { label:'图片轨道', cls:'tl-label-image' },
  audio:    { label:'音频轨道', cls:'tl-label-audio' },
  subtitle: { label:'字幕轨道', cls:'tl-label-sub' },
  dedup:    { label:'去重处理', cls:'tl-label-dedup' },
}

function TrackRow({ type, segments, isAudio, isDedup, currentTime }) {
  const { label, cls } = TRACK_META[type]
  return (
    <div className="tl-row">
      <div className={`tl-label ${cls}`}><span>{label}</span></div>
      <div className="tl-track-wrap">
        <div className="tl-track">
          <div className="tl-track-playhead" style={{ left: pct(currentTime) }} />
          {segments.map(seg => (
            <div
              key={seg.id}
              className={`tl-seg${isAudio?' tl-seg-audio':''}${isDedup?' tl-seg-dedup':''}`}
              style={{ left:pct(seg.start), width:pct(seg.dur), '--seg-color':seg.color }}
            >
              <span className="seg-name">{seg.name}</span>
              {!isAudio && !isDedup && <span className="seg-dur">{fmt(seg.dur)}</span>}
              {isAudio && (
                <div className="wave-mini-wrap">
                  {WAVE_MINI.map((h,i) => <div key={i} className="wave-mini-bar" style={{height:h}} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── export modal ─────────────────────────────────────────────────────────────

function ExportModal({ phase, prog, exportRes, exportFps, ratio, dedup, onConfirm, onClose }) {
  const enabledDedup = Object.entries(dedup).filter(([,v])=>v).map(([k])=>DEDUP_META[k])
  const EXPORT_STEPS = ['初始化编码器','处理视频轨道','混合音频','应用去重处理','封装 MP4']
  const stepIdx = Math.min(Math.floor(prog / 22), EXPORT_STEPS.length - 1)

  return (
    <div className="overlay" onClick={phase==='confirm' && prog===0 ? onClose : undefined}>
      <div className="export-modal" onClick={e => e.stopPropagation()}>

        {phase === 'confirm' && (
          <>
            <div className="export-modal-header">
              <div className="export-modal-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                导出视频
              </div>
              <button className="import-close" onClick={onClose}>✕</button>
            </div>
            <div className="export-settings-summary">
              {[
                ['格式', 'MP4 (H.264)'],
                ['分辨率', exportRes==='1080p'?'1920×1080':'1280×720'],
                ['帧率', exportFps],
                ['比例', ratio],
                ['时长', '00:30'],
                ['预计大小', `~${exportRes==='1080p'?'148':'64'} MB`],
              ].map(([l,v]) => (
                <div key={l} className="export-setting-card">
                  <span className="esc-label">{l}</span>
                  <span className="esc-val">{v}</span>
                </div>
              ))}
            </div>
            <div className="export-dedup-section">
              <div className="export-dedup-title">已应用去重处理（{enabledDedup.length} 项）</div>
              <div className="export-dedup-list">
                {enabledDedup.map(d => (
                  <div key={d.label} className="export-dedup-item">
                    <span className="export-dedup-ico">{d.ico}</span>
                    <div>
                      <div className="export-dedup-name">{d.label}</div>
                      <div className="export-dedup-desc">{d.desc}</div>
                    </div>
                  </div>
                ))}
                {enabledDedup.length === 0 && <div className="export-dedup-empty">未选择任何去重方式</div>}
              </div>
            </div>
            <div className="export-proto-notice">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              当前为原型模拟导出，不会生成真实 MP4 文件
            </div>
            <div className="export-action-row">
              <button className="export-cancel-btn" onClick={onClose}>取消</button>
              <button className="export-confirm-btn" onClick={onConfirm}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                确认导出
              </button>
            </div>
          </>
        )}

        {phase === 'exporting' && (
          <div className="export-progress-view">
            <div className="export-prog-icon">
              <svg className="export-prog-ring" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bdr-md)" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#10b981" strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*18*Math.min(prog,100)/100} ${2*Math.PI*18}`}
                  strokeLinecap="round"
                  style={{transformOrigin:'center',transform:'rotate(-90deg)',transition:'stroke-dasharray 0.2s'}}
                />
              </svg>
              <span className="export-prog-pct">{Math.round(prog)}%</span>
            </div>
            <h3>正在导出…</h3>
            <p className="export-prog-step">{EXPORT_STEPS[stepIdx]}</p>
            <div className="export-prog-bar-wrap">
              <div className="export-prog-bar-fill" style={{width:`${prog}%`}} />
            </div>
            <p className="export-proto-note">原型模拟导出 · 不生成真实 MP4 文件</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="export-done-view">
            <div className="export-done-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h3>导出完成（模拟）</h3>
            <p>当前为原型模拟，不会生成真实 MP4 文件。在真实版本中，视频将保存至本地。</p>
            <div className="export-done-file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              混剪成品_{new Date().toISOString().slice(0,10)}.mp4 · {exportRes} · {exportFps}
            </div>
            <button className="import-done-btn" style={{marginTop:16}} onClick={onClose}>关闭</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── main app ────────────────────────────────────────────────────────────────

export default function App() {
  // ── workflow step ──
  const [step, setStep]         = useState(1)
  const [previewVid, setPreviewVid] = useState(null)

  // ── core settings ──
  const [ratio, setRatio]         = useState('9:16')
  const [intensity, setIntensity] = useState('medium')
  const [isGenerating, setGen]    = useState(false)
  const [isGenerated, setDone]    = useState(false)
  const [genProgress, setGenProg] = useState(0)
  const [genStep, setGenStep]     = useState(GEN_STEPS[0])
  const [tlFlash, setTlFlash]     = useState(false)

  // ── playback ──
  const [isPlaying, setPlaying]   = useState(false)
  const [currentTime, setCurrent] = useState(0)

  // ── uploaded videos ──
  const [uploadedVideos, setUploadedVideos] = useState([])
  const [selectedVideoId, setSelectedVideoId] = useState(null)

  // ── export ──
  const [showExport, setShowExport]   = useState(false)
  const [exportPhase, setExportPhase] = useState('confirm')
  const [exportProg, setExportProg]   = useState(0)
  const [exportRes, setExportRes]     = useState('1080p')
  const [exportFps, setExportFps]     = useState('30fps')

  // ── content settings ──
  const [keepAudio, setKeepAudio]   = useState(true)
  const [addMusic, setAddMusic]     = useState(true)
  const [autoSub, setAutoSub]       = useState(true)
  const [subStyle, setSubStyle]     = useState('bold')
  const [subPos, setSubPos]         = useState('bottom')
  const [subStroke, setSubStroke]   = useState(true)
  const [dedup, setDedup] = useState({
    crop:true, scale:true, mirror:false, speed:true,
    bgImage:false, picInPic:false, subDistort:false, endImage:true,
  })
  const [toast, setToast] = useState('')

  const timerRef    = useRef(null)
  const fileInputRef = useRef(null)
  const videoRef    = useRef(null)

  const tracks = isGenerated ? TRACKS_GEN : TRACKS_INIT

  // ── derived ──
  const selectedVideo = useMemo(
    () => uploadedVideos.find(v => v.id === selectedVideoId) || uploadedVideos[0] || null,
    [uploadedVideos, selectedVideoId]
  )

  const effectiveDuration = isGenerated ? TOTAL : (selectedVideo?.dur || 0)

  const totalDuration = useMemo(
    () => uploadedVideos.reduce((s, v) => s + (v.dur || 0), 0),
    [uploadedVideos]
  )

  const dominantRes = useMemo(() => {
    if (!uploadedVideos.length) return '—'
    if (uploadedVideos.some(v => v.res?.startsWith('1920') || v.res?.startsWith('3840'))) return '1080p+'
    if (uploadedVideos.some(v => v.res?.startsWith('1280'))) return '720p'
    if (uploadedVideos.some(v => v.res !== '—')) return '混合'
    return '—'
  }, [uploadedVideos])

  const currentScene = useMemo(() => {
    if (!isGenerated) return null
    return SCENES.find(s => currentTime >= s.start && currentTime < s.end) || null
  }, [isGenerated, currentTime])

  const currentSubText = useMemo(() => {
    if (!isGenerated) return ''
    return SUBTITLE_TEXTS.find(s => currentTime >= s.start && currentTime < s.end)?.text || ''
  }, [isGenerated, currentTime])

  const dedupSelected = Object.values(dedup).filter(Boolean).length
  const enabledDedupKeys = Object.entries(dedup).filter(([,v])=>v).map(([k])=>k)

  // ── effects ──

  useEffect(() => {
    if (!isGenerated) return
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setCurrent(t => {
          if (t >= TOTAL) { setPlaying(false); return 0 }
          return Math.min(t + 0.1, TOTAL)
        })
      }, 100)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isPlaying, isGenerated])

  useEffect(() => {
    if (isGenerated) { clearInterval(timerRef.current); return }
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => setPlaying(false))
    } else {
      video.pause()
    }
    return () => { video.pause() }
  }, [isPlaying, isGenerated])

  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
  }, [selectedVideoId])

  // ── handlers ──

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function canGoToStep(n) {
    if (n === step) return false
    if (n === 3 && !isGenerated) return false
    return true
  }

  function goToStep(n) {
    if (!canGoToStep(n)) return
    if (n < step) setPlaying(false)
    setStep(n)
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    const idBase = Date.now()
    const newVideos = await Promise.all(files.map(async (file, i) => {
      const url = URL.createObjectURL(file)
      const meta = await readVideoMeta(url)
      return {
        id: idBase + i,
        name: file.name,
        sizeStr: formatSize(file.size),
        dur: meta.dur || 0,
        durStr: meta.dur > 0 ? fmt(meta.dur) : '—',
        res: meta.width > 0 ? `${meta.width}×${meta.height}` : '—',
        url,
      }
    }))
    setUploadedVideos(prev => [...prev, ...newVideos])
    setSelectedVideoId(prev => prev ?? (newVideos[0]?.id ?? null))
    e.target.value = ''
  }

  function handleRemoveVideo(id) {
    const vid = uploadedVideos.find(v => v.id === id)
    if (vid) URL.revokeObjectURL(vid.url)
    if (previewVid?.id === id) setPreviewVid(null)
    setUploadedVideos(prev => {
      const next = prev.filter(v => v.id !== id)
      if (selectedVideoId === id) setSelectedVideoId(next[0]?.id ?? null)
      return next
    })
  }

  function handleGenerate() {
    if (isGenerating) return
    setPlaying(false)
    setGen(true); setDone(false); setGenProg(0); setGenStep(GEN_STEPS[0])
    let p = 0, si = 0
    const iv = setInterval(() => {
      p += Math.random() * 14 + 4
      si = Math.min(Math.floor(p / 22), GEN_STEPS.length - 1)
      setGenStep(GEN_STEPS[si])
      if (p >= 100) {
        clearInterval(iv); setGenProg(100)
        setTimeout(() => {
          setGen(false); setDone(true)
          setCurrent(0)
          setTlFlash(true)
          setTimeout(() => setTlFlash(false), 800)
        }, 400)
      } else {
        setGenProg(p)
      }
    }, 220)
  }

  function handleExportOpen() {
    setShowExport(true); setExportPhase('confirm'); setExportProg(0)
  }

  function handleExportConfirm() {
    setExportPhase('exporting'); setExportProg(0)
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 6 + 2
      if (p >= 100) {
        p = 100; clearInterval(iv); setExportProg(100)
        setTimeout(() => setExportPhase('done'), 300)
      } else { setExportProg(p) }
    }, 200)
  }

  function handleExportClose() {
    setShowExport(false)
    setTimeout(() => { setExportPhase('confirm'); setExportProg(0) }, 300)
  }

  function handleSeek(newTime) {
    const clamped = Math.max(0, Math.min(newTime, effectiveDuration))
    setCurrent(clamped)
    if (!isGenerated && videoRef.current) videoRef.current.currentTime = clamped
  }

  function toggleDedup(k) { setDedup(d => ({ ...d, [k]: !d[k] })) }

  // ── reusable setting blocks (used in Step 2 and Step 3) ──

  const ratioBlock = (
    <div className="ratio-group">
      {[['9:16','竖屏'],['1:1','方形'],['16:9','横屏']].map(([r,desc]) => (
        <button key={r} className={`ratio-btn ${ratio===r?'active':''}`} onClick={() => setRatio(r)}>
          <div className={`ratio-icon ri-${r.replace(':','-')}`}/>
          <span>{r}</span><small>{desc}</small>
        </button>
      ))}
    </div>
  )

  const intensityBlock = (
    <div className="intensity-group">
      {[
        ['light','轻度混剪','轻微裁剪，画面连贯'],
        ['medium','中度混剪','平衡去重与流畅度'],
        ['strong','强力混剪','最大差异化处理'],
      ].map(([k,label,desc]) => (
        <button key={k} className={`intensity-btn ${intensity===k?'active':''}`} onClick={() => setIntensity(k)}>
          <div className="ib-left">
            <div className={`ib-dot ${k===intensity?'on':''}`}/>
            <span>{label}</span>
          </div>
          <small>{desc}</small>
        </button>
      ))}
    </div>
  )

  const dedupBlock = (
    <div className="dedup-grid">
      {[
        ['crop','裁剪边缘','◰'],['scale','轻微缩放','⊞'],
        ['mirror','镜像翻转','⇔'],['speed','变速处理','⏩'],
        ['bgImage','背景底图','▣'],['picInPic','可见画中画','⧉'],
        ['subDistort','字幕扰动','T'],['endImage','片尾图片','⬜'],
      ].map(([k,label,ico]) => (
        <label key={k} className={`dedup-chip ${dedup[k]?'on':''}`}>
          <input type="checkbox" checked={dedup[k]} onChange={() => toggleDedup(k)}/>
          <span className="dedup-chip-ico">{ico}</span>
          <span>{label}</span>
        </label>
      ))}
    </div>
  )

  // ════════════════════════════════════════════════════════ RENDER

  return (
    <div className="app">

      {/* ── hidden file input ── */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* ── video preview modal ── */}
      {previewVid && (
        <div className="overlay" onClick={() => setPreviewVid(null)}>
          <div className="vid-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="vid-preview-header">
              <span className="vid-preview-name">{previewVid.name}</span>
              <button className="import-close" onClick={() => setPreviewVid(null)}>✕</button>
            </div>
            <video src={previewVid.url} controls autoPlay className="vid-preview-video" />
            <div className="vid-preview-meta">
              {previewVid.res !== '—' && <span>{previewVid.res}</span>}
              <span>{previewVid.durStr}</span>
              <span>{previewVid.sizeStr}</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {showExport && (
        <ExportModal
          phase={exportPhase} prog={exportProg}
          exportRes={exportRes} exportFps={exportFps}
          ratio={ratio} dedup={dedup}
          onConfirm={handleExportConfirm}
          onClose={handleExportClose}
        />
      )}

      {isGenerating && (
        <div className="overlay">
          <div className="gen-box">
            <div className="gen-ring">
              <svg className="gen-ring-svg" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bdr-md)" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*18*Math.min(genProgress,100)/100} ${2*Math.PI*18}`}
                  strokeLinecap="round"
                  style={{transformOrigin:'center',transform:'rotate(-90deg)',transition:'stroke-dasharray 0.22s ease'}}
                />
              </svg>
              <span className="gen-ring-pct">{Math.round(Math.min(genProgress,100))}</span>
            </div>
            <h3>正在生成混剪方案</h3>
            <p className="gen-step">{genStep}</p>
            <div className="gen-steps-row">
              {['素材分析','计算混剪','轨道布局','去重处理','完成'].map((s,i) => (
                <div key={i} className={`gen-dot ${Math.floor(genProgress/22)>=i?'done':''}`} title={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ HEADER */}
      <header className="header">
        <div className="header-l">
          <div className="logo-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/>
              <line x1="14.47" y1="14.48" x2="20" y2="20"/>
              <line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="logo-text">
            <span className="logo-title">视频混剪工具</span>
            <span className="logo-ver">v0.1</span>
          </div>
        </div>

        <nav className="step-nav">
          {[
            { n: 1, label: '素材准备' },
            { n: 2, label: '混剪配置' },
            { n: 3, label: '预览导出' },
          ].flatMap(({ n, label }, i) => {
            const isActive = step === n
            const isDone   = step > n
            const isLocked = n === 3 && !isGenerated && step < 3
            const clickable = canGoToStep(n)
            return [
              i > 0 && (
                <div key={`sep-${n}`} className={`step-nav-sep ${isDone||step>n?'done':''}`} />
              ),
              <div
                key={n}
                className={`step-nav-item ${isActive?'active':''} ${isDone?'done':''} ${isLocked?'locked':''}`}
                onClick={() => clickable && setStep(n)}
                title={isLocked ? '请先完成混剪方案生成' : undefined}
              >
                <div className="step-nav-num">
                  {isDone
                    ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    : n
                  }
                </div>
                <span className="step-nav-label">{label}</span>
              </div>,
            ].filter(Boolean)
          })}
        </nav>

        <div className="header-r">
          <div className="header-actions">
            <button className="btn-ghost btn-sm" onClick={() => showToast('项目保存功能将在后续版本接入')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              保存
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════ STEP 1: 素材准备 */}
      {step === 1 && (
        <div className="step1">
          <div className="s1-bar">
            <button className="s1-upload-btn" onClick={handleImportClick}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              选择本地视频文件
            </button>
            {uploadedVideos.length > 0 && (
              <span className="s1-count">已导入 <strong>{uploadedVideos.length}</strong> 个视频 · 总时长 {fmt(totalDuration)}</span>
            )}
            <span className="s1-hint">支持 MP4 · MOV · AVI · 多选 · 不上传服务器</span>
          </div>

          <div className="s1-content">
            {uploadedVideos.length === 0 ? (
              <div className="s1-empty" onClick={handleImportClick}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2">
                  <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                  <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                <p>点击选择本地视频文件，或拖拽到这里</p>
                <span>支持多选 · 文件仅在本地处理，不会上传到任何服务器</span>
              </div>
            ) : (
              <div className="s1-video-grid">
                {uploadedVideos.map(v => (
                  <div key={v.id} className="s1-video-card">
                    <div className="s1-card-thumb" onClick={() => setPreviewVid(v)}>
                      <video src={v.url} preload="metadata" muted playsInline />
                      <div className="s1-card-overlay">
                        <div className="s1-preview-btn">▶ 预览</div>
                      </div>
                      <span className="s1-card-dur">{v.durStr}</span>
                    </div>
                    <div className="s1-card-body">
                      <div className="s1-card-name" title={v.name}>{v.name}</div>
                      <div className="s1-card-meta">
                        {v.res !== '—' && <span>{v.res}</span>}
                        <span>{v.durStr}</span>
                        <span>{v.sizeStr}</span>
                      </div>
                      <div className="s1-card-actions">
                        <button className="s1-act-btn" onClick={() => setPreviewVid(v)}>▶ 预览</button>
                        <button className="s1-act-btn s1-act-remove" onClick={() => handleRemoveVideo(v.id)}>× 移除</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="s1-add-card" onClick={handleImportClick}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.4">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>继续添加视频</span>
                </div>
              </div>
            )}

            {/* Other assets (mock) */}
            <div className="s1-other-assets">
              <div className="s1-other-title">其他素材（后续版本接入）</div>
              <div className="s1-other-row">
                {[
                  { icon:'🖼', label:'图片 / 贴图', sub:'3 个预置', tip:'图片上传将在后续版本接入' },
                  { icon:'🎵', label:'音乐 / 音效', sub:'背景音乐.mp3', tip:'音频上传将在后续版本接入' },
                  { icon:'T',  label:'字幕 / 文案', sub:'3 条预置', tip:'字幕上传将在后续版本接入' },
                ].map(({ icon, label, sub, tip }) => (
                  <div key={label} className="s1-other-item" onClick={() => showToast(tip)}>
                    <span className="s1-other-icon">{icon}</span>
                    <div>
                      <div className="s1-other-label">{label}</div>
                      <div className="s1-other-sub">{sub}</div>
                    </div>
                    <span className="s1-other-badge">模拟</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="step-footer">
            <div />
            <button
              className={`step-next-btn ${uploadedVideos.length === 0 ? 'disabled' : ''}`}
              onClick={() => uploadedVideos.length === 0 ? showToast('请先上传视频素材') : setStep(2)}
            >
              下一步：配置混剪
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ STEP 2: 混剪配置 */}
      {step === 2 && (
        <div className="step2">
          {/* Summary bar */}
          <div className="s2-summary-bar">
            {[
              { l: '视频数量', v: uploadedVideos.length > 0 ? `${uploadedVideos.length} 个` : '— 未上传' },
              { l: '总时长',   v: totalDuration > 0 ? fmt(totalDuration) : '—' },
              { l: '主分辨率', v: dominantRes },
              { l: '去重方式', v: `已选 ${dedupSelected} 项` },
            ].map(({ l, v }, i) => (
              <Fragment key={l}>
                {i > 0 && <div className="s2-sum-sep" />}
                <div className="s2-sum-item">
                  <span className="s2-sum-l">{l}</span>
                  <span className="s2-sum-v">{v}</span>
                </div>
              </Fragment>
            ))}
            <button className="s2-sum-back" onClick={() => setStep(1)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              修改素材
            </button>
          </div>

          <div className="s2-body">
            <div className="s2-cols">
              {/* Left column */}
              <div className="s2-col">
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#6366f1'}}/>
                    视频比例
                  </div>
                  {ratioBlock}
                </div>
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#8b5cf6'}}/>
                    混剪强度
                  </div>
                  {intensityBlock}
                </div>
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#06b6d4'}}/>
                    导出设置
                  </div>
                  <div className="export-grid">
                    <div className="export-row">
                      <span className="export-label">格式</span>
                      <button className="opt-btn active">MP4</button>
                    </div>
                    <div className="export-row">
                      <span className="export-label">分辨率</span>
                      <div className="btn-row">
                        {['720p','1080p'].map(r => (
                          <button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={() => setExportRes(r)}>{r}</button>
                        ))}
                      </div>
                    </div>
                    <div className="export-row">
                      <span className="export-label">帧率</span>
                      <div className="btn-row">
                        {['24fps','30fps','60fps'].map(f => (
                          <button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={() => setExportFps(f)}>{f}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column */}
              <div className="s2-col">
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#ec4899'}}/>
                    去重方式
                    <span className="r-title-count">{dedupSelected}/8</span>
                  </div>
                  {dedupBlock}
                </div>
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#f59e0b'}}/>
                    字幕设置
                  </div>
                  <div className="settings-col">
                    <div className="setting-row"><span>自动字幕</span><Toggle on={autoSub} onToggle={() => setAutoSub(v=>!v)}/></div>
                    <div className="setting-row"><span>字幕描边</span><Toggle on={subStroke} onToggle={() => setSubStroke(v=>!v)}/></div>
                    <div className="setting-row">
                      <span>样式</span>
                      <select value={subStyle} onChange={e => setSubStyle(e.target.value)}>
                        <option value="bold">粗体</option>
                        <option value="normal">常规</option>
                        <option value="shadow">阴影</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <span>位置</span>
                      <select value={subPos} onChange={e => setSubPos(e.target.value)}>
                        <option value="bottom">底部</option>
                        <option value="middle">中部</option>
                        <option value="top">顶部</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="s2-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#10b981'}}/>
                    音频设置
                  </div>
                  <div className="settings-col">
                    <div className="setting-row"><span>保留原声</span><Toggle on={keepAudio} onToggle={() => setKeepAudio(v=>!v)}/></div>
                    <div className="setting-row"><span>背景音乐</span><Toggle on={addMusic} onToggle={() => setAddMusic(v=>!v)}/></div>
                    {addMusic && (
                      <div className="setting-row">
                        <span>混合音量</span>
                        <input type="range" min="0" max="100" defaultValue="50" className="inline-slider"/>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Generate section */}
            <div className="s2-generate-section">
              {!isGenerated ? (
                <>
                  <p className="s2-gen-hint">配置完成后，点击生成混剪方案（模拟，不处理真实视频）</p>
                  <button
                    className={`btn-primary s2-gen-btn ${uploadedVideos.length === 0 ? 'disabled' : ''}`}
                    onClick={() => uploadedVideos.length === 0 ? showToast('请先在第一步上传素材') : handleGenerate()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                    </svg>
                    生成混剪方案
                  </button>
                </>
              ) : (
                <div className="s2-result-card">
                  <div className="s2-result-header">
                    <div className="s2-result-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    <span>混剪方案已生成</span>
                    <button className="s2-regen-btn" onClick={handleGenerate}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                      </svg>
                      重新生成
                    </button>
                  </div>
                  <div className="plan-stats">
                    {[
                      [4, '视频片段'],
                      [3, '字幕条目'],
                      [dedupSelected, '去重处理'],
                      ['00:30', '总时长'],
                    ].map(([num, lbl]) => (
                      <div key={lbl} className="plan-stat">
                        <span className="plan-stat-num">{num}</span>
                        <span className="plan-stat-label">{lbl}</span>
                      </div>
                    ))}
                  </div>
                  {enabledDedupKeys.length > 0 && (
                    <div className="s2-result-chips">
                      {enabledDedupKeys.map(k => (
                        <span key={k} className="s2-dedup-chip">
                          {DEDUP_META[k].ico} {DEDUP_META[k].label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="s2-result-note">
                    原始素材 {totalDuration > 0 ? `~${fmt(totalDuration)}` : '—'} → 混剪输出 00:30 · 预计文件 ~{exportRes==='1080p'?'148':'64'} MB
                  </div>
                  <button className="step-next-btn s2-next-btn" onClick={() => setStep(3)}>
                    下一步：预览导出
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="step-footer">
            <button className="step-back-btn" onClick={() => setStep(1)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              返回素材准备
            </button>
            <button
              className={`step-next-btn ${!isGenerated ? 'disabled' : ''}`}
              onClick={() => !isGenerated ? showToast('请先生成混剪方案') : setStep(3)}
            >
              下一步：预览导出
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ STEP 3: 预览导出 */}
      {step === 3 && (
        <div className="step3">
          <div className="main">

            {/* Simplified left panel */}
            <aside className="panel-l">
              <div className="s3-mat-header">
                <span className="s3-mat-title">本次使用素材</span>
                <span className="s3-mat-count">{uploadedVideos.length} 个</span>
              </div>
              <div className="s3-mat-list">
                {uploadedVideos.length === 0 ? (
                  <div className="s3-mat-empty">
                    <p>无上传素材</p>
                  </div>
                ) : (
                  uploadedVideos.map(v => (
                    <div key={v.id} className="s3-mat-item" onClick={() => setPreviewVid(v)}>
                      <div className="s3-mat-thumb">
                        <video src={v.url} preload="metadata" muted playsInline />
                      </div>
                      <div className="s3-mat-info">
                        <div className="s3-mat-name">{v.name}</div>
                        <div className="s3-mat-meta">{v.durStr} · {v.sizeStr}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="s3-mat-footer">
                <button className="s3-back-link" onClick={() => { setPlaying(false); setStep(2) }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  返回配置
                </button>
              </div>
            </aside>

            {/* Center panel */}
            <main className="panel-c">
              <div className="preview-wrap">
                <div className={`preview-screen r-${ratio.replace(':','-')}`}>
                  <div className="monitor-corners">
                    <span className="mc tl"/><span className="mc tr"/>
                    <span className="mc bl"/><span className="mc br"/>
                  </div>
                  <div className="preview-hud-top">
                    <span className="preview-timecode">{fmtMs(currentTime)}</span>
                    {isPlaying && <span className="preview-rec"><span className="rec-dot"/>REC</span>}
                    {isGenerated && currentScene && (
                      <span className="preview-scene-badge">
                        {currentScene.isEnd ? '片尾' : `SCENE ${currentScene.num}`}
                      </span>
                    )}
                    <span className="preview-ratio-tag">{ratio}</span>
                  </div>

                  {/* Scene info */}
                  {isGenerated && currentScene && !currentScene.isEnd && (
                    <div className="preview-scene-info">
                      <span className="scene-label">SCENE {currentScene.num} / 4</span>
                      <span className="scene-clip">{currentScene.name}</span>
                    </div>
                  )}

                  {/* Real video (before generation — step 3 always has isGenerated=true, but guard anyway) */}
                  {selectedVideo && !isGenerated && (
                    <video
                      ref={videoRef}
                      key={selectedVideo.id}
                      src={selectedVideo.url}
                      className="preview-video"
                      preload="auto"
                      playsInline
                      onTimeUpdate={() => { if (videoRef.current) setCurrent(videoRef.current.currentTime) }}
                      onEnded={() => { setPlaying(false); setCurrent(0) }}
                    />
                  )}

                  <div
                    className="preview-bg"
                    style={
                      isGenerated && currentScene
                        ? { background: currentScene.bg, transition:'background 0.6s ease' }
                        : {}
                    }
                  />
                  <div className="preview-scanlines" />

                  {isGenerated && currentScene?.isEnd && (
                    <div className="preview-end-card">
                      <div className="end-card-scissors">✂</div>
                      <div className="end-card-brand">品牌名称</div>
                      <div className="end-card-sub">@用户名 · 更多精彩内容</div>
                      <div className="end-card-line" />
                      <div className="end-card-tag">END</div>
                    </div>
                  )}

                  <div className="preview-center-state">
                    {!isGenerated && !selectedVideo && (
                      <div className="preview-idle">
                        <div className="preview-idle-icon">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4">
                            <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                            <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                            <line x1="2" y1="12" x2="22" y2="12"/>
                          </svg>
                        </div>
                        <p>请返回第二步生成混剪方案</p>
                      </div>
                    )}
                    {isGenerated && !currentScene?.isEnd && (
                      <div className="preview-film-grain" />
                    )}
                  </div>

                  {isGenerated && (
                    <div className="preview-storyboard">
                      {SCENES.map(s => (
                        <div
                          key={s.num}
                          className={`preview-sb-seg ${currentScene?.num===s.num?'active':''}`}
                          style={{ flex: s.end - s.start, background: s.color }}
                        />
                      ))}
                    </div>
                  )}

                  {isGenerated && currentSubText && (
                    <div className={`preview-sub-demo sub-style-${subStyle} sub-pos-${subPos} ${subStroke?'sub-stroke':''}`}>
                      {currentSubText}
                    </div>
                  )}
                  {isGenerated && !currentSubText && !currentScene?.isEnd && (
                    <div className={`preview-sub-demo sub-style-${subStyle} sub-pos-${subPos} ${subStroke?'sub-stroke':''} sub-placeholder`}>
                      ·  ·  ·
                    </div>
                  )}
                  <div className="preview-safe-line" />
                </div>
              </div>

              {/* Playback controls */}
              <div className="controls-bar">
                <div className="ctrl-left">
                  <button className="ctrl-btn" onClick={() => handleSeek(0)}>⏮</button>
                  <button className="play-btn" onClick={() => setPlaying(p => !p)} disabled={!isGenerated}>
                    {isPlaying
                      ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                  </button>
                  <button className="ctrl-btn" onClick={() => handleSeek(effectiveDuration)}>⏭</button>
                </div>
                <div className="ctrl-time">
                  <span className="time-cur">{fmtMs(currentTime)}</span>
                  <div className="prog-wrap">
                    <div className="prog-track" onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect()
                      handleSeek(((e.clientX-r.left)/r.width) * effectiveDuration)
                    }}>
                      <div className="prog-fill" style={{width: effectiveDuration > 0 ? `${(currentTime/effectiveDuration)*100}%` : '0%'}} />
                      {isGenerated && SCENES.map(s => (
                        <div key={s.num} className="prog-scene-marker"
                          style={{left:`${(s.start/TOTAL)*100}%`, background:s.color}} />
                      ))}
                      <div className="prog-thumb" style={{left: effectiveDuration > 0 ? `${(currentTime/effectiveDuration)*100}%` : '0%'}} />
                    </div>
                  </div>
                  <span className="time-tot">{effectiveDuration > 0 ? fmt(effectiveDuration) : '--:--'}</span>
                </div>
                <div className="ctrl-right">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt-3)" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                  </svg>
                  <input type="range" min="0" max="100" defaultValue="80" className="vol-slider" />
                </div>
              </div>

              {/* Summary strip */}
              <div className="summary-strip">
                {[
                  { key:'cut',   icon:'✂', label:'裁切片段', val:isGenerated?'4 段':'—',                active:isGenerated },
                  { key:'sub',   icon:'T', label:'字幕轨道', val:isGenerated?'3 条':'—',                active:isGenerated },
                  { key:'music', icon:'♪', label:'背景音乐', val:addMusic?'已启用':'未启用',            active:addMusic },
                  { key:'dedup', icon:'◈', label:'去重处理', val:isGenerated?`${dedupSelected} 项`:'—', active:isGenerated },
                ].map(({ key, icon, label, val, active }) => (
                  <div key={key} className={`summary-item ${active?'sum-active':''}`}>
                    <span className="sum-icon">{icon}</span>
                    <div className="sum-text">
                      <span className="sum-label">{label}</span>
                      <span className="sum-val">{val}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action row */}
              <div className="action-row">
                <button className="btn-ghost" onClick={() => { setPlaying(false); setStep(2) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  重新配置
                </button>
                <button className="btn-ghost" onClick={() => { if(!isGenerated) showToast('请先生成混剪方案'); else setPlaying(true) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  预览效果
                </button>
                <button className="btn-export" style={{flex:1}} onClick={handleExportOpen}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  导出视频
                </button>
              </div>
            </main>

            {/* Right panel — plan summary + export */}
            <aside className="panel-r">
              <div className="r-section">
                <div className="r-section-title">
                  <span className="r-title-dot" style={{'--dot-c':'#22c55e'}}/>
                  方案摘要
                </div>
                <div className="settings-col">
                  {[
                    ['视频比例', ratio],
                    ['混剪强度', {light:'轻度混剪', medium:'中度混剪', strong:'强力混剪'}[intensity]],
                    ['去重方式', `${dedupSelected} 项已启用`],
                    ['字幕样式', subStyle === 'bold' ? '粗体' : subStyle === 'normal' ? '常规' : '阴影'],
                  ].map(([k, v]) => (
                    <div key={k} className="s3-plan-row">
                      <span>{k}</span>
                      <span className="s3-plan-val">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {isGenerated && (
                <div className="r-section">
                  <div className="r-section-title">
                    <span className="r-title-dot" style={{'--dot-c':'#ec4899'}}/>
                    已应用去重
                    <span className="plan-fresh-badge">NEW</span>
                  </div>
                  <div className="plan-dedup-list">
                    {enabledDedupKeys.map(k => (
                      <div key={k} className="plan-dedup-row">
                        <span className="plan-check">✓</span>
                        <span className="plan-dedup-ico">{DEDUP_META[k].ico}</span>
                        <div className="plan-dedup-info">
                          <span className="plan-dedup-name">{DEDUP_META[k].label}</span>
                          <span className="plan-dedup-desc">{DEDUP_META[k].desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="r-section">
                <div className="r-section-title">
                  <span className="r-title-dot" style={{'--dot-c':'#06b6d4'}}/>
                  导出设置
                </div>
                <div className="export-grid">
                  <div className="export-row">
                    <span className="export-label">格式</span>
                    <button className="opt-btn active">MP4</button>
                  </div>
                  <div className="export-row">
                    <span className="export-label">分辨率</span>
                    <div className="btn-row">
                      {['720p','1080p'].map(r => (
                        <button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={() => setExportRes(r)}>{r}</button>
                      ))}
                    </div>
                  </div>
                  <div className="export-row">
                    <span className="export-label">帧率</span>
                    <div className="btn-row">
                      {['24fps','30fps','60fps'].map(f => (
                        <button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={() => setExportFps(f)}>{f}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="s3-export-note">
                  预计大小 ~{exportRes==='1080p'?'148':'64'} MB · 时长 00:30
                </div>
              </div>
            </aside>
          </div>

          {/* Timeline */}
          <div className={`timeline ${tlFlash?'tl-flash':''}`}>
            <div className="tl-head">
              <div className="tl-head-l">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                  <line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
                <span>时间轴</span>
                {isGenerated && <span className="tl-head-badge">5 轨道</span>}
              </div>
              <div className="tl-head-r">
                <span className="tl-cur-time">{fmtMs(currentTime)}</span>
                <span className="tl-sep">/</span>
                <span className="tl-dur-label">00:30.0</span>
              </div>
            </div>
            <div className="tl-body">
              <div className="tl-row tl-ruler-row">
                <div className="tl-label tl-label-ruler"/>
                <div className="tl-track-wrap">
                  <div className="tl-ruler">
                    {SUB_TICKS.map(t => <div key={`sub-${t}`} className="tl-subtick" style={{left:pct(t)}}/>)}
                    {TIME_MARKS.map(t => (
                      <div key={t} className="tl-mark" style={{left:pct(t)}}>
                        <span>{fmt(t)}</span>
                      </div>
                    ))}
                    <div className="playhead" style={{left:pct(currentTime)}}>
                      <div className="playhead-handle"/>
                    </div>
                  </div>
                </div>
              </div>
              <TrackRow type="video"    segments={tracks.video}    currentTime={currentTime}/>
              <TrackRow type="image"    segments={tracks.image}    currentTime={currentTime}/>
              <TrackRow type="audio"    segments={tracks.audio}    isAudio currentTime={currentTime}/>
              <TrackRow type="subtitle" segments={tracks.subtitle} currentTime={currentTime}/>
              <TrackRow type="dedup"    segments={tracks.dedup}    isDedup currentTime={currentTime}/>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
