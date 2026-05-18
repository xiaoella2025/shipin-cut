import { useState, useEffect, useRef } from 'react'

// ─── constants ───────────────────────────────────────────────────────────────

const TOTAL = 30

const MOCK_VIDEOS = [
  { name: '素材_01.mp4', dur: '00:15', size: '45.2 MB' },
  { name: '素材_02.mp4', dur: '00:22', size: '67.8 MB' },
  { name: '素材_03.mp4', dur: '00:08', size: '23.1 MB' },
]

const WAVE_L = Array.from({ length: 32 }, (_, i) =>
  20 + Math.sin(i * 0.9) * 10 + (i % 5 === 0 ? 6 : i % 3 === 0 ? -4 : 0)
)
const WAVE_MINI = Array.from({ length: 44 }, (_, i) =>
  5 + Math.abs(Math.sin(i * 0.7) * 5)
)

const TRACKS_INIT = {
  video: [
    { id: 'v1', name: '素材_01', start: 0,  dur: 8,  color: '#4f46e5' },
    { id: 'v2', name: '素材_03', start: 10, dur: 8,  color: '#7c3aed' },
  ],
  image: [
    { id: 'i1', name: '片尾图',  start: 25, dur: 5,  color: '#0369a1' },
  ],
  audio: [
    { id: 'a1', name: 'BGM · 背景音乐', start: 0, dur: 30, color: '#065f46' },
  ],
  subtitle: [],
  dedup: [],
}

const TRACKS_GEN = {
  video: [
    { id: 'v1', name: '素材_01',   start: 0,    dur: 7,  color: '#4f46e5' },
    { id: 'v2', name: '素材_02-A', start: 7.5,  dur: 6,  color: '#7c3aed' },
    { id: 'v3', name: '素材_03',   start: 14,   dur: 8,  color: '#6d28d9' },
    { id: 'v4', name: '素材_01-B', start: 22.5, dur: 5,  color: '#4f46e5' },
  ],
  image: [
    { id: 'i1', name: '装饰贴图', start: 5,  dur: 4,  color: '#0e7490' },
    { id: 'i2', name: '背景底图', start: 14, dur: 8,  color: '#0891b2' },
    { id: 'i3', name: '片尾图',   start: 25, dur: 5,  color: '#0369a1' },
  ],
  audio: [
    { id: 'a1', name: 'BGM · 背景音乐', start: 0, dur: 30, color: '#065f46' },
  ],
  subtitle: [
    { id: 's1', name: '字幕片段 1', start: 1,  dur: 5,  color: '#92400e' },
    { id: 's2', name: '字幕片段 2', start: 8,  dur: 6,  color: '#b45309' },
    { id: 's3', name: '字幕片段 3', start: 16, dur: 7,  color: '#d97706' },
  ],
  dedup: [
    { id: 'd1', name: '镜像翻转',  start: 0,    dur: 7,  color: '#9d174d' },
    { id: 'd2', name: '变速 0.9×', start: 7.5,  dur: 6,  color: '#be185d' },
    { id: 'd3', name: '裁剪边缘',  start: 14,   dur: 8,  color: '#881337' },
    { id: 'd4', name: '轻微旋转',  start: 22.5, dur: 5,  color: '#9d174d' },
  ],
}

const TIME_MARKS = [0, 5, 10, 15, 20, 25, 30]

function fmt(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}
function pct(v) { return `${(v / TOTAL) * 100}%` }

// ─── sub-components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on ? 'on' : ''}`} onClick={onToggle}>
      <div className="toggle-thumb" />
    </div>
  )
}

function TrackRow({ icon, label, segments, isAudio, isDedup }) {
  return (
    <div className="tl-row">
      <div className="tl-label">
        <span className="tl-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="tl-track-wrap">
        <div className="tl-track">
          {segments.map(seg => (
            <div
              key={seg.id}
              className={`tl-seg${isAudio ? ' tl-seg-audio' : ''}${isDedup ? ' tl-seg-dedup' : ''}`}
              style={{ left: pct(seg.start), width: pct(seg.dur), background: seg.color }}
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
  const [isPlaying, setPlaying]     = useState(false)
  const [currentTime, setCurrent]   = useState(0)
  const [showExport, setShowExport] = useState(false)
  const [toast, setToast]           = useState('')
  const [exportRes, setExportRes]   = useState('1080p')
  const [exportFps, setExportFps]   = useState('30fps')
  const [keepAudio, setKeepAudio]   = useState(true)
  const [addMusic, setAddMusic]     = useState(false)
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

  function handleGenerate() {
    if (isGenerating) return
    setGen(true); setDone(false); setGenProg(0)
    let p = 0
    const iv = setInterval(() => {
      p += Math.random() * 18 + 5
      if (p >= 100) {
        p = 100
        clearInterval(iv)
        setTimeout(() => { setGen(false); setDone(true) }, 300)
      }
      setGenProg(p)
    }, 200)
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
            <div className="modal-icon">⚠</div>
            <h3>当前为原型版本</h3>
            <p>真实导出功能将在后续版本中接入处理引擎。<br />第一阶段目标为确认产品流程与交互逻辑。</p>
            <button className="modal-btn" onClick={() => setShowExport(false)}>知道了</button>
          </div>
        </div>
      )}

      {/* ── generating overlay ── */}
      {isGenerating && (
        <div className="overlay">
          <div className="gen-box">
            <div className="spinner" />
            <h3>正在生成混剪方案…</h3>
            <div className="gen-bar-wrap">
              <div className="gen-bar" style={{ width: `${Math.min(genProgress, 100)}%` }} />
            </div>
            <p>{Math.round(Math.min(genProgress, 100))}% · 分析素材中</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ HEADER */}
      <header className="header">
        <div className="header-l">
          <div className="logo-badge">✂</div>
          <div>
            <div className="logo-title">视频混剪工具</div>
            <div className="logo-sub">一键生成混剪方案，支持画面、字幕、音频、贴图等多轨道编辑</div>
          </div>
        </div>
        <div className="header-r">
          <div className="hstat">
            <span className="hstat-l">当前项目</span>
            <span className="hstat-v">未命名项目</span>
          </div>
          <div className="hstat">
            <span className="hstat-l">素材数量</span>
            <span className="hstat-v">3 个视频</span>
          </div>
          <div className="hstat">
            <span className="hstat-l">导出状态</span>
            <span className={`hstat-v ${isGenerated ? 'hstat-ok' : ''}`}>
              {isGenerated ? '方案已生成' : '未导出'}
            </span>
          </div>
          <button className="btn-ghost" onClick={() => showToast('项目保存功能将在后续版本接入')}>保存项目</button>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════ MAIN */}
      <div className="main">

        {/* ── LEFT PANEL ── */}
        <aside className="panel-l">

          {/* video materials */}
          <div className="card">
            <div className="card-head">
              <span>视频素材</span>
              <button className="btn-add" onClick={() => showToast('视频上传将在后续版本接入，当前为原型演示')}>+ 上传</button>
            </div>
            <div className="mat-list">
              {MOCK_VIDEOS.map((v, i) => (
                <div key={i} className="mat-item">
                  <div className="mat-thumb">▶</div>
                  <div className="mat-info">
                    <div className="mat-name">{v.name}</div>
                    <div className="mat-meta">
                      <span>{v.dur}</span>
                      <span>{v.size}</span>
                      <span className="badge-ok">就绪</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* images */}
          <div className="card">
            <div className="card-head">
              <span>图片 / 贴图</span>
              <button className="btn-add" onClick={() => showToast('图片上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="img-grid">
              {[['🖼', '底图'], ['✨', '装饰贴图'], ['🎬', '片尾图']].map(([icon, label]) => (
                <div key={label} className="img-card">
                  <span className="img-icon">{icon}</span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* audio */}
          <div className="card">
            <div className="card-head">
              <span>音乐 / 音效</span>
              <button className="btn-add" onClick={() => showToast('音频上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="audio-row">
              <span className="audio-note">♪</span>
              <div className="audio-info">
                <div className="audio-name">背景音乐.mp3</div>
                <div className="wave-wrap">
                  {WAVE_L.map((h, i) => (
                    <div key={i} className="wave-bar" style={{ height: h }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* subtitles */}
          <div className="card">
            <div className="card-head">
              <span>字幕 / 文案</span>
              <button className="btn-add" onClick={() => showToast('字幕上传将在后续版本接入')}>+ 上传</button>
            </div>
            <div className="sub-entries">
              <div className="sub-btn" onClick={() => showToast('字幕文件上传（.srt / .ass）将在后续版本接入')}>
                📄 上传字幕文件 (.srt / .ass)
              </div>
              <div className="sub-btn" onClick={() => showToast('手动输入文案功能将在后续版本接入')}>
                ✏️ 手动输入文案
              </div>
            </div>
          </div>

        </aside>

        {/* ── CENTER PANEL ── */}
        <main className="panel-c">

          {/* preview */}
          <div className="preview-wrap">
            <div className={`preview-screen r-${ratio.replace(':', '-')}`}>
              <div className="ratio-badge">{ratio}</div>
              <div className="preview-bg" />
              <div className="preview-center-txt">
                {isGenerated ? '混剪方案预览' : '上传素材后开始'}
              </div>
              {isGenerated && (
                <div className="preview-sub-demo">这里是字幕示例文字</div>
              )}
            </div>
          </div>

          {/* playback controls */}
          <div className="controls-bar">
            <button className="play-btn" onClick={() => setPlaying(p => !p)}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <span className="time-cur">{fmt(currentTime)}</span>
            <div className="prog-wrap">
              <div className="prog-track">
                <div className="prog-fill" style={{ width: `${(currentTime / TOTAL) * 100}%` }} />
                <div className="prog-thumb" style={{ left: `${(currentTime / TOTAL) * 100}%` }} />
              </div>
            </div>
            <span className="time-tot">{fmt(TOTAL)}</span>
            <div className="vol-ctrl">
              <span className="vol-icon">🔊</span>
              <input type="range" min="0" max="100" defaultValue="80" className="vol-slider" />
            </div>
          </div>

          {/* summary strip */}
          <div className="summary-strip">
            {[
              { icon: '✂', label: `已裁切 ${isGenerated ? 4 : 0} 片段`, active: isGenerated },
              { icon: 'T', label: `已添加 ${isGenerated ? 3 : 0} 条字幕`, active: isGenerated },
              { icon: '♪', label: addMusic ? '已添加背景音乐' : '未添加背景音乐', active: addMusic },
              { icon: '🛡', label: `去重处理：${isGenerated ? `已应用 ${dedupSelected} 项` : '未处理'}`, active: isGenerated },
            ].map(({ icon, label, active }) => (
              <div key={label} className={`summary-item ${active ? 'sum-active' : ''}`}>
                <span className="sum-icon">{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* action buttons */}
          <div className="action-row">
            <button className="btn-ghost" onClick={() => showToast('上传入口：请从左侧素材区上传视频')}>上传素材</button>
            <button
              className={`btn-primary btn-gen ${isGenerating ? 'disabled' : ''}`}
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? '生成中…' : isGenerated ? '重新生成' : '生成混剪方案'}
            </button>
            <button className="btn-ghost" onClick={() => showToast('预览功能将在接入真实视频后可用')}>预览效果</button>
            <button className="btn-export" onClick={() => setShowExport(true)}>导出视频</button>
          </div>

        </main>

        {/* ── RIGHT PANEL ── */}
        <aside className="panel-r">

          {/* ratio */}
          <div className="card">
            <div className="setting-title">视频比例</div>
            <div className="ratio-group">
              {[['9:16', '竖屏'], ['1:1', '方形'], ['16:9', '横屏']].map(([r, desc]) => (
                <button
                  key={r}
                  className={`ratio-btn ${ratio === r ? 'active' : ''}`}
                  onClick={() => setRatio(r)}
                >
                  <div className={`ratio-icon ri-${r.replace(':', '-')}`} />
                  <span>{r}</span>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </div>

          {/* intensity */}
          <div className="card">
            <div className="setting-title">混剪强度</div>
            <div className="intensity-group">
              {[
                ['light',  '轻度混剪', '最小改动'],
                ['medium', '中度混剪', '平衡效果'],
                ['strong', '强力混剪', '最大差异'],
              ].map(([k, label, desc]) => (
                <button
                  key={k}
                  className={`intensity-btn ${intensity === k ? 'active' : ''}`}
                  onClick={() => setIntensity(k)}
                >
                  <span>{label}</span>
                  <small>{desc}</small>
                </button>
              ))}
            </div>
          </div>

          {/* dedup */}
          <div className="card">
            <div className="setting-title">去重方式</div>
            <div className="dedup-list">
              {[
                ['crop',       '裁剪边缘'],
                ['scale',      '轻微缩放'],
                ['mirror',     '镜像翻转'],
                ['speed',      '变速处理'],
                ['bgImage',    '添加背景底图'],
                ['picInPic',   '添加可见画中画'],
                ['subDistort', '添加字幕扰动'],
                ['endImage',   '添加片尾图片'],
              ].map(([k, label]) => (
                <label key={k} className="dedup-item">
                  <input type="checkbox" checked={dedup[k]} onChange={() => toggleDedup(k)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* subtitle settings */}
          <div className="card">
            <div className="setting-title">字幕设置</div>
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
                <span>字幕样式</span>
                <select value={subStyle} onChange={e => setSubStyle(e.target.value)}>
                  <option value="bold">粗体</option>
                  <option value="normal">常规</option>
                  <option value="shadow">阴影</option>
                </select>
              </div>
              <div className="setting-row">
                <span>字幕位置</span>
                <select value={subPos} onChange={e => setSubPos(e.target.value)}>
                  <option value="bottom">底部</option>
                  <option value="middle">中部</option>
                  <option value="top">顶部</option>
                </select>
              </div>
            </div>
          </div>

          {/* audio settings */}
          <div className="card">
            <div className="setting-title">音频设置</div>
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
                  <span>音量混合</span>
                  <input type="range" min="0" max="100" defaultValue="50" className="inline-slider" />
                </div>
              )}
            </div>
          </div>

          {/* export settings */}
          <div className="card">
            <div className="setting-title">导出设置</div>
            <div className="settings-col">
              <div className="setting-row">
                <span>格式</span>
                <div className="btn-row">
                  <button className="opt-btn active">MP4</button>
                </div>
              </div>
              <div className="setting-row">
                <span>分辨率</span>
                <div className="btn-row">
                  {['720p', '1080p'].map(r => (
                    <button key={r} className={`opt-btn ${exportRes === r ? 'active' : ''}`} onClick={() => setExportRes(r)}>{r}</button>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <span>帧率</span>
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
          <span>时间轴</span>
          <span className="tl-dur-label">总时长 00:30</span>
        </div>
        <div className="tl-body">

          {/* ruler */}
          <div className="tl-row tl-ruler-row">
            <div className="tl-label tl-label-ruler" />
            <div className="tl-track-wrap">
              <div className="tl-ruler">
                {TIME_MARKS.map(t => (
                  <div key={t} className="tl-mark" style={{ left: pct(t) }}>
                    <span>{fmt(t)}</span>
                  </div>
                ))}
                <div className="playhead" style={{ left: pct(currentTime) }} />
              </div>
            </div>
          </div>

          <TrackRow icon="🎬" label="视频轨道" segments={tracks.video} />
          <TrackRow icon="🖼" label="图片轨道" segments={tracks.image} />
          <TrackRow icon="🎵" label="音频轨道" segments={tracks.audio} isAudio />
          <TrackRow icon="T"  label="字幕轨道" segments={tracks.subtitle} />
          <TrackRow icon="🛡" label="去重处理" segments={tracks.dedup} isDedup />

        </div>
      </div>

    </div>
  )
}
