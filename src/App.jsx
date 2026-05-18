import { useState, useEffect, useRef, useMemo } from 'react'

// ─── constants ───────────────────────────────────────────────────────────────

const TOTAL = 30

const MOCK_VIDEOS_BASE = [
  { id: 1, name: '素材_01.mp4', dur: '00:15', size: '45.2 MB', fps: '30fps', res: '1080p' },
  { id: 2, name: '素材_02.mp4', dur: '00:22', size: '67.8 MB', fps: '30fps', res: '1080p' },
  { id: 3, name: '素材_03.mp4', dur: '00:08', size: '23.1 MB', fps: '24fps', res:  '720p' },
]

const IMPORT_MOCK = [
  { name: '素材_04.mp4', size: '52.1 MB', dur: '00:18', res: '1080p', fps: '30fps' },
  { name: '素材_05.mp4', size: '38.6 MB', dur: '00:12', res:  '720p', fps: '24fps' },
]

// Scenes mapped to TRACKS_GEN video segments
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
  video:    [ { id:'v1', name:'素材_01', start:0, dur:8, color:'#3730a3' }, { id:'v2', name:'素材_03', start:10, dur:8, color:'#5b21b6' } ],
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
  crop:       { label:'裁剪边缘', ico:'◰', desc:'画面边缘裁剪 4%，规避水印' },
  scale:      { label:'轻微缩放', ico:'⊞', desc:'整体放大 103%，改变画面边界' },
  mirror:     { label:'镜像翻转', ico:'⇔', desc:'水平镜像，左右对称变换' },
  speed:      { label:'变速处理', ico:'⏩', desc:'整体 0.9× 变速，改变节奏' },
  bgImage:    { label:'背景底图', ico:'▣', desc:'竖屏边缘添加模糊底图' },
  picInPic:   { label:'可见画中画', ico:'⧉', desc:'画面角落添加可见小窗' },
  subDistort: { label:'字幕扰动', ico:'T',  desc:'字幕时间轴微调，防相似度' },
  endImage:   { label:'片尾图片', ico:'⬜', desc:'结尾插入品牌片尾图' },
}

function fmt(s) {
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`
}
function fmtMs(s) {
  return `${fmt(s)}.${String(Math.floor((s%1)*10))}`
}
function pct(v) { return `${(v/TOTAL)*100}%` }

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

// ─── import modal ─────────────────────────────────────────────────────────────

function ImportModal({ phase, progs, onClose }) {
  return (
    <div className="overlay" onClick={phase==='done' ? onClose : undefined}>
      <div className="import-box" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <div className="import-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            导入素材
          </div>
          {phase !== 'scanning' && (
            <button className="import-close" onClick={onClose}>✕</button>
          )}
        </div>

        {phase === 'scanning' && (
          <div className="import-scanning">
            <div className="import-spinner" />
            <p>正在扫描文件系统…</p>
            <span>检索可导入的视频素材</span>
          </div>
        )}

        {(phase === 'importing' || phase === 'done') && (
          <div className="import-files">
            {IMPORT_MOCK.map((f, i) => (
              <div key={i} className="import-file-item">
                <div className="import-file-thumb">
                  <div className="import-file-icon">
                    {progs[i] >= 100
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <div className="import-file-spin" />
                    }
                  </div>
                </div>
                <div className="import-file-info">
                  <div className="import-file-name">{f.name}</div>
                  <div className="import-file-meta">
                    <span>{f.res}</span><span>{f.fps}</span><span>{f.dur}</span><span>{f.size}</span>
                  </div>
                  <div className="import-prog-wrap">
                    <div className="import-prog-bar" style={{ width:`${Math.min(progs[i],100)}%`, background: progs[i]>=100 ? '#10b981' : '#5b6af0' }} />
                  </div>
                  <div className="import-prog-label">
                    {progs[i] >= 100 ? '✓ 导入完成' : `解析中 ${Math.round(progs[i])}%`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === 'done' && (
          <div className="import-done">
            <div className="import-done-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p>已成功导入 <strong>2 个素材</strong>，素材库共 5 段视频</p>
            <button className="import-done-btn" onClick={onClose}>添加到素材区</button>
          </div>
        )}
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
              <div className="export-setting-card">
                <span className="esc-label">格式</span>
                <span className="esc-val">MP4 (H.264)</span>
              </div>
              <div className="export-setting-card">
                <span className="esc-label">分辨率</span>
                <span className="esc-val">{exportRes === '1080p' ? '1920×1080' : '1280×720'}</span>
              </div>
              <div className="export-setting-card">
                <span className="esc-label">帧率</span>
                <span className="esc-val">{exportFps}</span>
              </div>
              <div className="export-setting-card">
                <span className="esc-label">比例</span>
                <span className="esc-val">{ratio}</span>
              </div>
              <div className="export-setting-card">
                <span className="esc-label">时长</span>
                <span className="esc-val">00:30</span>
              </div>
              <div className="export-setting-card">
                <span className="esc-label">预计大小</span>
                <span className="esc-val">~{exportRes==='1080p'?'148':'64'} MB</span>
              </div>
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
              当前为原型版本，导出流程为模拟演示，不生成真实文件
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
            <p className="export-proto-note">模拟导出演示，不生成真实文件</p>
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
            <p>在真实版本中，视频将保存至本地或上传至云端存储。</p>
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
  const [ratio, setRatio]         = useState('9:16')
  const [intensity, setIntensity] = useState('medium')
  const [isGenerating, setGen]    = useState(false)
  const [isGenerated, setDone]    = useState(false)
  const [genProgress, setGenProg] = useState(0)
  const [genStep, setGenStep]     = useState(GEN_STEPS[0])
  const [tlFlash, setTlFlash]     = useState(false)

  const [isPlaying, setPlaying]   = useState(false)
  const [currentTime, setCurrent] = useState(4.2)

  // import flow
  const [showImport, setShowImport]   = useState(false)
  const [importPhase, setImportPhase] = useState('idle')
  const [importProgs, setImportProgs] = useState([0, 0])
  const [totalVideos, setTotalVideos] = useState(3)

  // export flow
  const [showExport, setShowExport]   = useState(false)
  const [exportPhase, setExportPhase] = useState('confirm')
  const [exportProg, setExportProg]   = useState(0)
  const [exportRes, setExportRes]     = useState('1080p')
  const [exportFps, setExportFps]     = useState('30fps')

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

  const timerRef = useRef(null)
  const tracks = isGenerated ? TRACKS_GEN : TRACKS_INIT

  // computed: current scene and subtitle
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

  // mock video list for left panel
  const allVideos = useMemo(() => {
    const extra = totalVideos > 3
      ? IMPORT_MOCK.slice(0, totalVideos - 3)
      : []
    return [...MOCK_VIDEOS_BASE, ...extra.map((f,i) => ({...f, id: 4+i}))]
  }, [totalVideos])

  // playback timer
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

  // ── import flow ──
  function handleImportClick() {
    setShowImport(true)
    setImportPhase('scanning')
    setImportProgs([0, 0])
    setTimeout(() => {
      setImportPhase('importing')
      let p = [0, 0]
      const iv = setInterval(() => {
        p = p.map(v => Math.min(v + Math.random() * 22 + 8, 100))
        setImportProgs([...p])
        if (p.every(v => v >= 100)) {
          clearInterval(iv)
          setImportPhase('done')
        }
      }, 140)
    }, 1000)
  }

  function handleImportClose() {
    if (importPhase === 'done') setTotalVideos(v => Math.min(v + 2, 5))
    setShowImport(false)
    setTimeout(() => setImportPhase('idle'), 300)
  }

  // ── generate flow ──
  function handleGenerate() {
    if (isGenerating) return
    setGen(true); setDone(false); setGenProg(0); setGenStep(GEN_STEPS[0])
    let p = 0, si = 0
    const iv = setInterval(() => {
      p += Math.random() * 14 + 4
      si = Math.min(Math.floor(p / 22), GEN_STEPS.length - 1)
      setGenStep(GEN_STEPS[si])
      if (p >= 100) {
        clearInterval(iv)
        setGenProg(100)
        setTimeout(() => {
          setGen(false); setDone(true)
          setTlFlash(true)
          setTimeout(() => setTlFlash(false), 800)
        }, 400)
      } else {
        setGenProg(p)
      }
    }, 220)
  }

  // ── export flow ──
  function handleExportOpen() {
    setShowExport(true)
    setExportPhase('confirm')
    setExportProg(0)
  }

  function handleExportConfirm() {
    setExportPhase('exporting')
    setExportProg(0)
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 6 + 2
      if (p >= 100) {
        p = 100; clearInterval(iv)
        setExportProg(100)
        setTimeout(() => setExportPhase('done'), 300)
      } else {
        setExportProg(p)
      }
    }, 200)
  }

  function handleExportClose() {
    setShowExport(false)
    setTimeout(() => { setExportPhase('confirm'); setExportProg(0) }, 300)
  }

  function toggleDedup(k) { setDedup(d => ({ ...d, [k]: !d[k] })) }

  return (
    <div className="app">

      {toast && <div className="toast">{toast}</div>}

      {showImport && (
        <ImportModal
          phase={importPhase}
          progs={importProgs}
          onClose={handleImportClose}
        />
      )}

      {showExport && (
        <ExportModal
          phase={exportPhase}
          prog={exportProg}
          exportRes={exportRes}
          exportFps={exportFps}
          ratio={ratio}
          dedup={dedup}
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

      {/* ════════════════════════════════════════════════ HEADER */}
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
              <span className={`hstat-v ${totalVideos>3?'hstat-changed':''}`}>{totalVideos} 段视频</span>
            </div>
            <div className="hstat">
              <span className="hstat-l">轨道</span>
              <span className={`hstat-v ${isGenerated?'hstat-changed':''}`}>
                {isGenerated ? '5 轨道 · 已布局' : '2 轨道'}
              </span>
            </div>
            <div className="hstat">
              <span className="hstat-l">状态</span>
              <span className={`hstat-v ${isGenerated?'hstat-ok':''}`}>
                {isGenerated ? '✓ 方案已生成' : '待生成'}
              </span>
            </div>
          </div>
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

      {/* ════════════════════════════════════════════════ MAIN */}
      <div className="main">

        {/* ── LEFT PANEL ── */}
        <aside className="panel-l">

          <div className="card card-video">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-video" />
                <span>视频素材</span>
                <span className="card-count">{totalVideos}</span>
              </div>
              <button className="btn-add" onClick={handleImportClick}>+ 导入</button>
            </div>
            <div className="mat-list">
              {allVideos.map((v, i) => (
                <div key={v.id} className={`mat-item ${i>=3?'mat-item-new':''}`}>
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
                      {i>=3
                        ? <span className="badge-new">● 新导入</span>
                        : <span className="badge-ok">● 就绪</span>
                      }
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-image">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-image" /><span>图片 / 贴图</span>
              </div>
              <button className="btn-add" onClick={() => showToast('图片上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="img-grid">
              {[{icon:'🖼',label:'背景底图',hint:'全幅背景'},{icon:'✨',label:'装饰贴图',hint:'叠加层'},{icon:'🎬',label:'片尾图片',hint:'结尾帧'}].map(({icon,label,hint}) => (
                <div key={label} className="img-card">
                  <span className="img-icon">{icon}</span>
                  <span className="img-label">{label}</span>
                  <span className="img-hint">{hint}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card card-audio">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-audio" /><span>音乐 / 音效</span>
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
                  {WAVE_L.map((h,i) => <div key={i} className="wave-bar" style={{height:h}} />)}
                </div>
              </div>
            </div>
          </div>

          <div className="card card-sub">
            <div className="card-head">
              <div className="card-head-l">
                <div className="card-dot dot-sub" /><span>字幕 / 文案</span>
              </div>
              <button className="btn-add" onClick={() => showToast('字幕上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="sub-entries">
              <div className="sub-btn" onClick={() => showToast('字幕文件上传将在后续版本接入')}>
                <span className="sub-btn-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
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

          <div className="preview-wrap">
            <div className={`preview-screen r-${ratio.replace(':','-')}`}>
              <div className="monitor-corners">
                <span className="mc tl"/><span className="mc tr"/>
                <span className="mc bl"/><span className="mc br"/>
              </div>

              {/* top HUD */}
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

              {/* scene info */}
              {isGenerated && currentScene && !currentScene.isEnd && (
                <div className="preview-scene-info">
                  <span className="scene-label">SCENE {currentScene.num} / 4</span>
                  <span className="scene-clip">{currentScene.name}</span>
                </div>
              )}

              {/* background — changes per scene */}
              <div
                className="preview-bg"
                style={currentScene ? { background: currentScene.bg, transition:'background 0.6s ease' } : {}}
              />
              <div className="preview-scanlines" />

              {/* end card overlay */}
              {isGenerated && currentScene?.isEnd && (
                <div className="preview-end-card">
                  <div className="end-card-scissors">✂</div>
                  <div className="end-card-brand">品牌名称</div>
                  <div className="end-card-sub">@用户名 · 更多精彩内容</div>
                  <div className="end-card-line" />
                  <div className="end-card-tag">END</div>
                </div>
              )}

              {/* idle / content state */}
              <div className="preview-center-state">
                {!isGenerated ? (
                  <div className="preview-idle">
                    <div className="preview-idle-icon">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4">
                        <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                        <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                      </svg>
                    </div>
                    <p>上传素材后点击<br/>「生成混剪方案」</p>
                  </div>
                ) : (
                  !currentScene?.isEnd && (
                    <div className="preview-film-grain" />
                  )
                )}
              </div>

              {/* storyboard strip */}
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

              {/* subtitle */}
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

          {/* playback controls */}
          <div className="controls-bar">
            <div className="ctrl-left">
              <button className="ctrl-btn" onClick={() => setCurrent(0)}>⏮</button>
              <button className="play-btn" onClick={() => setPlaying(p => !p)}>
                {isPlaying
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                }
              </button>
              <button className="ctrl-btn" onClick={() => setCurrent(TOTAL)}>⏭</button>
            </div>
            <div className="ctrl-time">
              <span className="time-cur">{fmtMs(currentTime)}</span>
              <div className="prog-wrap">
                <div className="prog-track" onClick={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setCurrent(((e.clientX-r.left)/r.width)*TOTAL)
                }}>
                  <div className="prog-fill" style={{width:`${(currentTime/TOTAL)*100}%`}} />
                  {/* scene color markers */}
                  {isGenerated && SCENES.map(s => (
                    <div key={s.num} className="prog-scene-marker"
                      style={{left:`${(s.start/TOTAL)*100}%`, background:s.color}} />
                  ))}
                  <div className="prog-thumb" style={{left:`${(currentTime/TOTAL)*100}%`}} />
                </div>
              </div>
              <span className="time-tot">{fmt(TOTAL)}</span>
            </div>
            <div className="ctrl-right">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt-3)" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
              <input type="range" min="0" max="100" defaultValue="80" className="vol-slider" />
            </div>
          </div>

          {/* summary strip */}
          <div className="summary-strip">
            {[
              { key:'cut',   icon:'✂', label:'裁切片段', val:isGenerated?'4 段':'—',           active:isGenerated },
              { key:'sub',   icon:'T', label:'字幕轨道', val:isGenerated?'3 条':'—',           active:isGenerated },
              { key:'music', icon:'♪', label:'背景音乐', val:addMusic?'已启用':'未启用',        active:addMusic },
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

          {/* action buttons */}
          <div className="action-row">
            <button className="btn-ghost" onClick={handleImportClick}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              上传素材
            </button>
            <button
              className={`btn-primary btn-gen ${isGenerating?'disabled':''}`}
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <><span className="btn-spin"/>生成中…</>
              ) : isGenerated ? (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>重新生成</>
              ) : (
                <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>生成混剪方案</>
              )}
            </button>
            <button className="btn-ghost" onClick={() => { if(!isGenerated){showToast('请先生成混剪方案')} else {setPlaying(true)} }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              预览效果
            </button>
            <button className="btn-export" onClick={handleExportOpen}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              导出视频
            </button>
          </div>

        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="panel-r">

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#6366f1'}}/>
              视频比例
            </div>
            <div className="ratio-group">
              {[['9:16','竖屏'],['1:1','方形'],['16:9','横屏']].map(([r,desc]) => (
                <button key={r} className={`ratio-btn ${ratio===r?'active':''}`} onClick={() => setRatio(r)}>
                  <div className={`ratio-icon ri-${r.replace(':','-')}`}/>
                  <span>{r}</span><small>{desc}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#8b5cf6'}}/>
              混剪强度
            </div>
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
          </div>

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#ec4899'}}/>
              去重方式
              <span className="r-title-count">{dedupSelected}/8</span>
            </div>
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
          </div>

          {/* plan details — shown after generation */}
          {isGenerated && (
            <div className="r-section plan-section">
              <div className="r-section-title">
                <span className="r-title-dot" style={{'--dot-c':'#22c55e'}}/>
                本次方案详情
                <span className="plan-fresh-badge">NEW</span>
              </div>
              <div className="plan-stats">
                <div className="plan-stat">
                  <span className="plan-stat-num">4</span>
                  <span className="plan-stat-label">视频片段</span>
                </div>
                <div className="plan-stat">
                  <span className="plan-stat-num">3</span>
                  <span className="plan-stat-label">字幕条目</span>
                </div>
                <div className="plan-stat">
                  <span className="plan-stat-num">{dedupSelected}</span>
                  <span className="plan-stat-label">去重处理</span>
                </div>
                <div className="plan-stat">
                  <span className="plan-stat-num">00:30</span>
                  <span className="plan-stat-label">总时长</span>
                </div>
              </div>
              <div className="plan-dedup-title">已应用的去重处理</div>
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
              <div className="plan-note">
                原始素材 ~00:45 → 混剪输出 00:30 · 预计文件 ~148 MB
              </div>
            </div>
          )}

          <div className="r-section">
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
                  <option value="bold">粗体</option><option value="normal">常规</option><option value="shadow">阴影</option>
                </select>
              </div>
              <div className="setting-row">
                <span>位置</span>
                <select value={subPos} onChange={e => setSubPos(e.target.value)}>
                  <option value="bottom">底部</option><option value="middle">中部</option><option value="top">顶部</option>
                </select>
              </div>
            </div>
          </div>

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#10b981'}}/>
              音频设置
            </div>
            <div className="settings-col">
              <div className="setting-row"><span>保留原声</span><Toggle on={keepAudio} onToggle={() => setKeepAudio(v=>!v)}/></div>
              <div className="setting-row"><span>背景音乐</span><Toggle on={addMusic} onToggle={() => setAddMusic(v=>!v)}/></div>
              {addMusic && (
                <div className="setting-row"><span>混合音量</span><input type="range" min="0" max="100" defaultValue="50" className="inline-slider"/></div>
              )}
            </div>
          </div>

          <div className="r-section">
            <div className="r-section-title">
              <span className="r-title-dot" style={{'--dot-c':'#06b6d4'}}/>
              导出设置
            </div>
            <div className="export-grid">
              <div className="export-row"><span className="export-label">格式</span><button className="opt-btn active">MP4</button></div>
              <div className="export-row">
                <span className="export-label">分辨率</span>
                <div className="btn-row">
                  {['720p','1080p'].map(r=>(
                    <button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={()=>setExportRes(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="export-row">
                <span className="export-label">帧率</span>
                <div className="btn-row">
                  {['24fps','30fps','60fps'].map(f=>(
                    <button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={()=>setExportFps(f)}>{f}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </aside>
      </div>

      {/* ════════════════════════════════════════════════ TIMELINE */}
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
                {SUB_TICKS.map(t => (
                  <div key={`sub-${t}`} className="tl-subtick" style={{left:pct(t)}}/>
                ))}
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
  )
}
