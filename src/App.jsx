import { useState, useEffect, useRef } from 'react'

// ─── constants ───────────────────────────────────────────────────────────────

const TOTAL = 30

const MOCK_VIDEOS = [
  { name: '素材_01.mp4', dur: '00:15', size: '45.2 MB', fps: '30fps', res: '1080p' },
  { name: '素材_02.mp4', dur: '00:22', size: '67.8 MB', fps: '30fps', res: '1080p' },
  { name: '素材_03.mp4', dur: '00:08', size: '23.1 MB', fps: '24fps', res:  '720p' },
]

const WAVE_L = Array.from({ length: 36 }, (_, i) =>
  18 + Math.sin(i * 0.85) * 11 + Math.sin(i * 0.3) * 5 + (i % 7 === 0 ? 6 : 0)
)
const WAVE_MINI = Array.from({ length: 50 }, (_, i) =>
  4 + Math.abs(Math.sin(i * 0.65) * 6) + Math.abs(Math.sin(i * 0.2) * 2)
)

// Sub-tick positions (every 1s, skip the major 5s marks)
const SUB_TICKS = Array.from({ length: 29 }, (_, i) => i + 1).filter(t => t % 5 !== 0)

const TRACKS_INIT = {
  video: [
    { id: 'v1', name: '素材_01', start: 0,  dur: 8,  color: '#3730a3' },
    { id: 'v2', name: '素材_03', start: 10, dur: 8,  color: '#5b21b6' },
  ],
  image: [
    { id: 'i1', name: '片尾图',  start: 25, dur: 5,  color: '#0c4a6e' },
  ],
  audio: [
    { id: 'a1', name: 'BGM · 背景音乐', start: 0, dur: 30, color: '#064e3b' },
  ],
  subtitle: [],
  dedup: [],
}

const TRACKS_GEN = {
  video: [
    { id: 'v1', name: '素材_01',   start: 0,    dur: 7,  color: '#3730a3' },
    { id: 'v2', name: '素材_02-A', start: 7.5,  dur: 6,  color: '#5b21b6' },
    { id: 'v3', name: '素材_03',   start: 14,   dur: 8,  color: '#4c1d95' },
    { id: 'v4', name: '素材_01-B', start: 22.5, dur: 5,  color: '#3730a3' },
  ],
  image: [
    { id: 'i1', name: '装饰贴图', start: 5,  dur: 4,  color: '#0c4a6e' },
    { id: 'i2', name: '背景底图', start: 14, dur: 8,  color: '#075985' },
    { id: 'i3', name: '片尾图',   start: 25, dur: 5,  color: '#0369a1' },
  ],
  audio: [
    { id: 'a1', name: 'BGM · 背景音乐', start: 0, dur: 30, color: '#064e3b' },
  ],
  subtitle: [
    { id: 's1', name: '字幕片段 1', start: 1,  dur: 5,  color: '#78350f' },
    { id: 's2', name: '字幕片段 2', start: 8,  dur: 6,  color: '#92400e' },
    { id: 's3', name: '字幕片段 3', start: 16, dur: 7,  color: '#a16207' },
  ],
  dedup: [
    { id: 'd1', name: '镜像翻转',  start: 0,    dur: 7,  color: '#831843' },
    { id: 'd2', name: '变速 0.9×', start: 7.5,  dur: 6,  color: '#9d174d' },
    { id: 'd3', name: '裁剪边缘',  start: 14,   dur: 8,  color: '#7f1d1d' },
    { id: 'd4', name: '轻微旋转',  start: 22.5, dur: 5,  color: '#831843' },
  ],
}

const TIME_MARKS = [0, 5, 10, 15, 20, 25, 30]

function fmt(s) {
  const ss = Math.floor(s % 60)
  const mm = Math.floor(s / 60)
  return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}
function fmtMs(s) {
  return `${fmt(s)}.${String(Math.floor((s % 1) * 10)).padStart(1,'0')}`
}
function pct(v) { return `${(v / TOTAL) * 100}%` }

// ─── sub-components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  )
}

const TRACK_META = {
  video:    { label: '视频轨道', cls: 'tl-label-video' },
  image:    { label: '图片轨道', cls: 'tl-label-image' },
  audio:    { label: '音频轨道', cls: 'tl-label-audio' },
  subtitle: { label: '字幕轨道', cls: 'tl-label-sub' },
  dedup:    { label: '去重处理', cls: 'tl-label-dedup' },
}

function TrackRow({ type, segments, isAudio, isDedup, currentTime }) {
  const { label, cls } = TRACK_META[type]
  return (
    <div className="tl-row">
      <div className={`tl-label ${cls}`}>
        <span>{label}</span>
      </div>
      <div className="tl-track-wrap">
        <div className="tl-track">
          {/* Playhead line extending into track */}
          <div className="tl-track-playhead" style={{ left: pct(currentTime) }} />
          {segments.map(seg => (
            <div
              key={seg.id}
              className={`tl-seg${isAudio ? ' tl-seg-audio' : ''}${isDedup ? ' tl-seg-dedup' : ''}`}
              style={{ left: pct(seg.start), width: pct(seg.dur), '--seg-color': seg.color }}
            >
              <span className="seg-name">{seg.name}</span>
              {!isAudio && !isDedup && (
                <span className="seg-dur">{fmt(seg.dur)}</span>
              )}
              {isAudio && (
                <div className="wave-mini-wrap">
                  {WAVE_MINI.map((h, i) => (
                    <div key={i} className="wave-mini-bar" style={{ height: h }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── main app ────────────────────────────────────────────────────────────────

export default function App() {
  const [ratio, setRatio]           = useState('9:16')
  const [intensity, setIntensity]   = useState('medium')
  const [isGenerating, setGen]      = useState(false)
  const [isGenerated, setDone]      = useState(false)
  const [genProgress, setGenProg]   = useState(0)
  const [genStep, setGenStep]       = useState('分析素材中')
  const [isPlaying, setPlaying]     = useState(false)
  const [currentTime, setCurrent]   = useState(4.2)
  const [showExport, setShowExport] = useState(false)
  const [toast, setToast]           = useState('')
  const [exportRes, setExportRes]   = useState('1080p')
  const [exportFps, setExportFps]   = useState('30fps')
  const [keepAudio, setKeepAudio]   = useState(true)
  const [addMusic, setAddMusic]     = useState(true)
  const [autoSub, setAutoSub]       = useState(true)
  const [subStyle, setSubStyle]     = useState('bold')
  const [subPos, setSubPos]         = useState('bottom')
  const [subStroke, setSubStroke]   = useState(true)
  const [dedup, setDedup] = useState({
    crop: true, scale: true, mirror: false, speed: true,
    bgImage: false, picInPic: false, subDistort: false, endImage: true,
  })

  const timerRef = useRef(null)
  const tracks = isGenerated ? TRACKS_GEN : TRACKS_INIT

  const GEN_STEPS = ['分析素材中', '计算混剪点', '生成轨道布局', '应用去重处理', '方案完成']

  useEffect(() => {
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
  }, [isPlaying])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleGenerate() {
    if (isGenerating) return
    setGen(true); setDone(false); setGenProg(0); setGenStep(GEN_STEPS[0])
    let p = 0, stepIdx = 0
    const iv = setInterval(() => {
      p += Math.random() * 14 + 4
      stepIdx = Math.min(Math.floor(p / 22), GEN_STEPS.length - 1)
      setGenStep(GEN_STEPS[stepIdx])
      if (p >= 100) {
        p = 100
        clearInterval(iv)
        setGenProg(100)
        setTimeout(() => { setGen(false); setDone(true) }, 400)
      } else {
        setGenProg(p)
      }
    }, 220)
  }

  function toggleDedup(k) { setDedup(d => ({ ...d, [k]: !d[k] })) }

  const dedupSelected = Object.values(dedup).filter(Boolean).length

  return (
    <div className="app">

      {/* ── toast ── */}
      {toast && <div className="toast">{toast}</div>}

      {/* ── export modal ── */}
      {showExport && (
        <div className="overlay" onClick={() => setShowExport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3>当前为原型版本</h3>
            <p>真实导出功能将在后续版本接入处理引擎。第一阶段目标为确认产品流程与交互逻辑。</p>
            <div className="modal-meta">格式 MP4 · {exportRes} · {exportFps} · {ratio}</div>
            <button className="modal-btn" onClick={() => setShowExport(false)}>知道了</button>
          </div>
        </div>
      )}

      {/* ── generating overlay ── */}
      {isGenerating && (
        <div className="overlay">
          <div className="gen-box">
            <div className="gen-ring">
              <svg className="gen-ring-svg" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border-md)" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 18 * Math.min(genProgress,100) / 100} ${2 * Math.PI * 18}`}
                  strokeLinecap="round"
                  style={{ transformOrigin:'center', transform:'rotate(-90deg)', transition:'stroke-dasharray 0.22s ease' }}
                />
              </svg>
              <span className="gen-ring-pct">{Math.round(Math.min(genProgress,100))}</span>
            </div>
            <h3>正在生成混剪方案</h3>
            <p className="gen-step">{genStep}</p>
            <div className="gen-steps-row">
              {['素材分析','计算混剪','轨道布局','去重处理','完成'].map((s, i) => (
                <div key={i} className={`gen-dot ${Math.floor(genProgress / 22) >= i ? 'done' : ''}`} title={s} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ HEADER */}
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
            <span className="logo-ver">v0.1 原型</span>
          </div>
          <div className="header-divider" />
          <span className="logo-sub">多轨道混剪 · 智能去重 · 一键导出</span>
        </div>
        <div className="header-r">
          <div className="hstat-group">
            <div className="hstat">
              <span className="hstat-l">项目</span>
              <span className="hstat-v">未命名项目</span>
            </div>
            <div className="hstat">
              <span className="hstat-l">素材</span>
              <span className="hstat-v">3 段视频</span>
            </div>
            <div className="hstat">
              <span className="hstat-l">状态</span>
              <span className={`hstat-v ${isGenerated ? 'hstat-ok' : ''}`}>
                {isGenerated ? '✓ 方案已生成' : '待生成'}
              </span>
            </div>
          </div>
          <div className="header-actions">
            <button className="btn-ghost btn-sm" onClick={() => showToast('项目保存功能将在后续版本接入')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
              </svg>
              保存
            </button>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════ MAIN */}
      <div className="main">

        {/* ── LEFT PANEL ── */}
        <aside className="panel-l">

          {/* video materials */}
          <div className="card card-video">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-video" />
                <span>视频素材</span>
                <span className="card-count">3</span>
              </div>
              <button className="btn-add" onClick={() => showToast('视频上传将在后续版本接入，当前为原型演示')}>
                + 上传
              </button>
            </div>
            <div className="mat-list">
              {MOCK_VIDEOS.map((v, i) => (
                <div key={i} className="mat-item">
                  <div className="mat-thumb">
                    <div className="mat-thumb-bars">
                      {[0.3,0.7,0.5,0.9,0.4,0.8].map((h,j)=>(
                        <div key={j} className="mat-thumb-bar" style={{height:`${h*100}%`}} />
                      ))}
                    </div>
                    <span className="mat-play">▶</span>
                    <span className="mat-dur-badge">{v.dur}</span>
                  </div>
                  <div className="mat-info">
                    <div className="mat-name">{v.name}</div>
                    <div className="mat-meta">
                      <span className="mat-tag">{v.res}</span>
                      <span className="mat-tag">{v.fps}</span>
                      <span className="mat-tag">{v.size}</span>
                    </div>
                    <div className="mat-status">
                      <span className="badge-ok">● 就绪</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* images */}
          <div className="card card-image">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-image" />
                <span>图片 / 贴图</span>
              </div>
              <button className="btn-add" onClick={() => showToast('图片上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="img-grid">
              {[
                { icon: '🖼', label: '背景底图', hint: '全幅背景' },
                { icon: '✨', label: '装饰贴图', hint: '叠加层' },
                { icon: '🎬', label: '片尾图片', hint: '结尾帧' },
              ].map(({ icon, label, hint }) => (
                <div key={label} className="img-card">
                  <span className="img-icon">{icon}</span>
                  <span className="img-label">{label}</span>
                  <span className="img-hint">{hint}</span>
                </div>
              ))}
            </div>
          </div>

          {/* audio */}
          <div className="card card-audio">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-audio" />
                <span>音乐 / 音效</span>
              </div>
              <button className="btn-add" onClick={() => showToast('音频上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="audio-item">
              <div className="audio-thumb">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                </svg>
              </div>
              <div className="audio-info">
                <div className="audio-name">背景音乐.mp3</div>
                <div className="audio-dur">03:42 · 128kbps</div>
                <div className="wave-wrap">
                  {WAVE_L.map((h, i) => (
                    <div key={i} className="wave-bar" style={{ height: h }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* subtitles */}
          <div className="card card-sub">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-sub" />
                <span>字幕 / 文案</span>
              </div>
              <button className="btn-add" onClick={() => showToast('字幕上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="sub-entries">
              <div className="sub-btn" onClick={() => showToast('字幕文件上传将在后续版本接入')}>
                <span className="sub-btn-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                  </svg>
                </span>
                上传字幕文件 <span className="sub-btn-ext">.srt / .ass</span>
              </div>
              <div className="sub-btn" onClick={() => showToast('手动输入文案功能将在后续版本接入')}>
                <span className="sub-btn-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </span>
                手动输入文案
              </div>
            </div>
          </div>

        </aside>

        {/* ── CENTER PANEL ── */}
        <main className="panel-c">

          {/* preview */}
          <div className="preview-wrap">
            <div className={`preview-screen r-${ratio.replace(':', '-')}`}>
              {/* monitor corner brackets */}
              <div className="monitor-corners">
                <span className="mc tl" /><span className="mc tr" />
                <span className="mc bl" /><span className="mc br" />
              </div>
              {/* top HUD */}
              <div className="preview-hud-top">
                <span className="preview-timecode">{fmtMs(currentTime)}</span>
                {isPlaying && <span className="preview-rec"><span className="rec-dot" />REC</span>}
                <span className="preview-ratio-tag">{ratio}</span>
              </div>
              {/* scene info */}
              {isGenerated && (
                <div className="preview-scene-info">
                  <span className="scene-label">SCENE 01</span>
                  <span className="scene-clip">素材_01.mp4</span>
                </div>
              )}
              {/* background */}
              <div className="preview-bg" />
              {/* scanlines */}
              <div className="preview-scanlines" />
              {/* center state */}
              <div className="preview-center-state">
                {!isGenerated ? (
                  <div className="preview-idle">
                    <div className="preview-idle-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
                        <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                        <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
                        <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/>
                        <line x1="17" y1="7" x2="22" y2="7"/>
                      </svg>
                    </div>
                    <p>上传素材后点击<br/>「生成混剪方案」</p>
                  </div>
                ) : (
                  <div className="preview-playing-state">
                    <div className="preview-fake-content">
                      <div className="fake-bar" style={{width:'60%', opacity:0.15, height:8, marginBottom:6}} />
                      <div className="fake-bar" style={{width:'80%', opacity:0.08, height:6, marginBottom:4}} />
                      <div className="fake-bar" style={{width:'45%', opacity:0.08, height:6}} />
                    </div>
                  </div>
                )}
              </div>
              {/* subtitle demo */}
              {isGenerated && (
                <div className="preview-sub-demo">这里是示例字幕文字内容</div>
              )}
              {/* bottom safe area line */}
              <div className="preview-safe-line" />
            </div>
          </div>

          {/* playback controls */}
          <div className="controls-bar">
            <div className="ctrl-left">
              <button className="ctrl-btn" title="跳到开头" onClick={() => setCurrent(0)}>⏮</button>
              <button className="play-btn" onClick={() => setPlaying(p => !p)}>
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </button>
              <button className="ctrl-btn" title="跳到末尾" onClick={() => setCurrent(TOTAL)}>⏭</button>
            </div>
            <div className="ctrl-time">
              <span className="time-cur">{fmtMs(currentTime)}</span>
              <div className="prog-wrap">
                <div className="prog-track" onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setCurrent(((e.clientX - r.left) / r.width) * TOTAL)
                }}>
                  <div className="prog-fill" style={{ width: `${(currentTime / TOTAL) * 100}%` }} />
                  <div className="prog-thumb" style={{ left: `${(currentTime / TOTAL) * 100}%` }} />
                </div>
              </div>
              <span className="time-tot">{fmt(TOTAL)}</span>
            </div>
            <div className="ctrl-right">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt-3)" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
              <input type="range" min="0" max="100" defaultValue="80" className="vol-slider" />
            </div>
          </div>

          {/* summary strip */}
          <div className="summary-strip">
            {[
              { key:'cut',   icon:'✂', label:`裁切片段`,  val: isGenerated ? '4 段' : '—',   active: isGenerated },
              { key:'sub',   icon:'T', label:`字幕轨道`,  val: isGenerated ? '3 条' : '—',   active: isGenerated },
              { key:'music', icon:'♪', label:`背景音乐`,  val: addMusic ? '已启用' : '未启用', active: addMusic },
              { key:'dedup', icon:'◈', label:`去重处理`,  val: isGenerated ? `${dedupSelected} 项` : '—', active: isGenerated },
            ].map(({ key, icon, label, val, active }) => (
              <div key={key} className={`summary-item ${active ? 'sum-active' : ''}`}>
                <span className="sum-icon">{icon}</span>
                <div className="sum-text">
                  <span className="sum-label">{label}</span>
                  <span className="sum-val">{val}</span>
                </div>
              </div>
            ))}
          </div>

          {/* action buttons */}
          <div className="action-row">
            <button className="btn-ghost" onClick={() => showToast('请从左侧素材区上传视频')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              上传素材
            </button>
            <button
              className={`btn-primary btn-gen ${isGenerating ? 'disabled' : ''}`}
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><span className="btn-spin" />生成中…</>
              ) : isGenerated ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>重新生成</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>生成混剪方案</>
              )}
            </button>
            <button className="btn-ghost" onClick={() => showToast('预览功能将在接入真实视频后可用')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              预览效果
            </button>
            <button className="btn-export" onClick={() => setShowExport(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              导出视频
            </button>
          </div>

        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="panel-r">

          {/* ratio */}
          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#6366f1'}} />
              视频比例
            </div>
            <div className="ratio-group">
              {[['9:16', '竖屏'], ['1:1', '方形'], ['16:9', '横屏']].map(([r, desc]) => (
                <button key={r} className={`ratio-btn ${ratio === r ? 'active' : ''}`} onClick={() => setRatio(r)}>
                  <div className={`ratio-icon ri-${r.replace(':', '-')}`} />
                  <span>{r}</span>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </div>

          {/* intensity */}
          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#8b5cf6'}} />
              混剪强度
            </div>
            <div className="intensity-group">
              {[
                ['light',  '轻度混剪', '轻微裁剪，画面连贯'],
                ['medium', '中度混剪', '平衡去重与流畅度'],
                ['strong', '强力混剪', '最大差异化处理'],
              ].map(([k, label, desc]) => (
                <button key={k} className={`intensity-btn ${intensity === k ? 'active' : ''}`} onClick={() => setIntensity(k)}>
                  <div className="ib-left">
                    <div className={`ib-dot ${k === intensity ? 'on' : ''}`} />
                    <span>{label}</span>
                  </div>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </div>

          {/* dedup */}
          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#ec4899'}} />
              去重方式
              <span className="r-title-count">{dedupSelected}/8</span>
            </div>
            <div className="dedup-grid">
              {[
                ['crop',       '裁剪边缘',   '◰'],
                ['scale',      '轻微缩放',   '⊞'],
                ['mirror',     '镜像翻转',   '⇔'],
                ['speed',      '变速处理',   '⏩'],
                ['bgImage',    '背景底图',   '▣'],
                ['picInPic',   '可见画中画', '⧉'],
                ['subDistort', '字幕扰动',   'T'],
                ['endImage',   '片尾图片',   '⬜'],
              ].map(([k, label, ico]) => (
                <label key={k} className={`dedup-chip ${dedup[k] ? 'on' : ''}`}>
                  <input type="checkbox" checked={dedup[k]} onChange={() => toggleDedup(k)} />
                  <span className="dedup-chip-ico">{ico}</span>
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* subtitle + audio combined */}
          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#f59e0b'}} />
              字幕设置
            </div>
            <div className="settings-col">
              <div className="setting-row">
                <span>自动字幕</span>
                <Toggle on={autoSub} onToggle={() => setAutoSub(v => !v)} />
              </div>
              <div className="setting-row">
                <span>字幕描边</span>
                <Toggle on={subStroke} onToggle={() => setSubStroke(v => !v)} />
              </div>
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

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#10b981'}} />
              音频设置
            </div>
            <div className="settings-col">
              <div className="setting-row">
                <span>保留原声</span>
                <Toggle on={keepAudio} onToggle={() => setKeepAudio(v => !v)} />
              </div>
              <div className="setting-row">
                <span>背景音乐</span>
                <Toggle on={addMusic} onToggle={() => setAddMusic(v => !v)} />
              </div>
              {addMusic && (
                <div className="setting-row">
                  <span>混合音量</span>
                  <input type="range" min="0" max="100" defaultValue="50" className="inline-slider" />
                </div>
              )}
            </div>
          </div>

          {/* export settings */}
          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#06b6d4'}} />
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
                  {['720p', '1080p'].map(r => (
                    <button key={r} className={`opt-btn ${exportRes === r ? 'active' : ''}`} onClick={() => setExportRes(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="export-row">
                <span className="export-label">帧率</span>
                <div className="btn-row">
                  {['24fps', '30fps', '60fps'].map(f => (
                    <button key={f} className={`opt-btn ${exportFps === f ? 'active' : ''}`} onClick={() => setExportFps(f)}>{f}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════ TIMELINE */}
      <div className="timeline">
        <div className="tl-head">
          <div className="tl-head-l">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
            <span>时间轴</span>
          </div>
          <div className="tl-head-r">
            <span className="tl-cur-time">{fmtMs(currentTime)}</span>
            <span className="tl-sep">/</span>
            <span className="tl-dur-label">00:30.0</span>
          </div>
        </div>
        <div className="tl-body">

          {/* ruler */}
          <div className="tl-row tl-ruler-row">
            <div className="tl-label tl-label-ruler" />
            <div className="tl-track-wrap">
              <div className="tl-ruler">
                {/* sub-ticks */}
                {SUB_TICKS.map(t => (
                  <div key={`sub-${t}`} className="tl-subtick" style={{ left: pct(t) }} />
                ))}
                {/* major marks */}
                {TIME_MARKS.map(t => (
                  <div key={t} className="tl-mark" style={{ left: pct(t) }}>
                    <span>{fmt(t)}</span>
                  </div>
                ))}
                {/* ruler playhead */}
                <div className="playhead" style={{ left: pct(currentTime) }}>
                  <div className="playhead-handle" />
                </div>
              </div>
            </div>
          </div>

          <TrackRow type="video"    segments={tracks.video}    currentTime={currentTime} />
          <TrackRow type="image"    segments={tracks.image}    currentTime={currentTime} />
          <TrackRow type="audio"    segments={tracks.audio}    isAudio currentTime={currentTime} />
          <TrackRow type="subtitle" segments={tracks.subtitle} currentTime={currentTime} />
          <TrackRow type="dedup"    segments={tracks.dedup}    isDedup currentTime={currentTime} />

        </div>
      </div>

    </div>
  )
}
