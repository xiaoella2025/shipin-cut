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

const WAVE_MINI = Array.from({ length: 50 }, (_, i) =>
  4 + Math.abs(Math.sin(i * 0.65) * 6) + Math.abs(Math.sin(i * 0.2) * 2)
)
const SUB_TICKS = Array.from({ length: 29 }, (_, i) => i + 1).filter(t => t % 5 !== 0)

const TIME_MARKS = [0, 5, 10, 15, 20, 25, 30]
const GEN_STEPS  = ['分析素材中…', '计算混剪节点…', '生成成品方案…', '应用去重处理…', '方案生成完成']

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

const SEGMENT_TEMPLATES = [
  [
    { type:'开场',     sub:'欢迎来到我的频道，今天分享一道超简单的家常菜' },
    { type:'食材准备', sub:'准备食材：鸡蛋两个、葱花适量、生抽一勺' },
    { type:'制作步骤', sub:'热锅冷油，下葱花爆香，加入鸡蛋翻炒' },
    { type:'成品展示', sub:'出锅！嫩滑可口，配饭绝了' },
    { type:'结尾',     sub:'记得关注我，每周更新新食谱' },
  ],
  [
    { type:'开场',     sub:'今天带大家探店，这家藏在小巷子里的宝藏小店' },
    { type:'环境介绍', sub:'店面不大但很有设计感，灯光氛围超好' },
    { type:'产品展示', sub:'点了招牌拿铁和芋泥蛋糕，颜值很高' },
    { type:'评价',     sub:'味道惊喜！奶茶浓郁不甜腻，蛋糕层次丰富' },
    { type:'结尾',     sub:'探店完毕，喜欢的去打卡，下期见' },
  ],
  [
    { type:'开场',     sub:'今天教大家一个实用的技巧，亲测有效' },
    { type:'背景介绍', sub:'很多人都遇到这个问题，其实方法很简单' },
    { type:'步骤演示', sub:'第一步：先把材料准备好，按顺序排列' },
    { type:'步骤演示', sub:'第二步：关键在这里，注意力度要均匀' },
    { type:'结尾',     sub:'学会了吗？有问题在评论区问我' },
  ],
  [
    { type:'开场',     sub:'今天开箱测评这款网红产品，值不值得买' },
    { type:'外观展示', sub:'包装精致，做工很好，质感不错' },
    { type:'功能测试', sub:'实际使用感受，效果比想象中好很多' },
    { type:'对比评测', sub:'和同类产品对比，性价比明显更高' },
    { type:'总结',     sub:'综合来看值得购买，链接在评论区' },
  ],
  [
    { type:'开场',     sub:'这次来到了一个冷门但绝美的景点' },
    { type:'景色展示', sub:'远处山峦叠嶂，云雾缭绕，太美了' },
    { type:'游览记录', sub:'沿着步道走了两个小时，风景各有不同' },
    { type:'美食打卡', sub:'当地特色小吃，价格实惠味道正宗' },
    { type:'结尾',     sub:'强烈推荐这个地方，不堵车不拥挤' },
  ],
]

const ALL_SEG_TYPES = ['开场','食材准备','制作步骤','成品展示','环境介绍','产品展示',
                       '评价','背景介绍','步骤演示','外观展示','功能测试','对比评测',
                       '总结','景色展示','游览记录','美食打卡','结尾','其他']

const SEG_TYPE_COLORS = {
  '开场':'#6366f1','结尾':'#6b7280','食材准备':'#059669','制作步骤':'#d97706',
  '成品展示':'#0284c7','环境介绍':'#7c3aed','产品展示':'#db2777','评价':'#0891b2',
  '背景介绍':'#ca8a04','步骤演示':'#16a34a','外观展示':'#9333ea','功能测试':'#2563eb',
  '对比评测':'#dc2626','总结':'#64748b','景色展示':'#0d9488','游览记录':'#0369a1',
  '美食打卡':'#b45309','其他':'#475569',
}

const TRACK_COLORS = ['#3730a3','#5b21b6','#4c1d95','#1e3a8a','#065f46','#7f1d1d','#7c3aed','#0369a1']

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(s) {
  if (!s && s !== 0) return '--:--'
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`
}
function fmtMs(s) {
  return `${fmt(s)}.${String(Math.floor(((s||0)%1)*10))}`
}
function pct(v) { return `${(v/TOTAL)*100}%` }
function pctOf(v, total) { return `${total > 0 ? (v/total)*100 : 0}%` }

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

function generateSegments(video, vidIndex) {
  const tpl  = SEGMENT_TEMPLATES[vidIndex % SEGMENT_TEMPLATES.length]
  const dur  = video?.dur > 0 ? video.dur : 60
  const count = tpl.length
  return tpl.map((s, i) => ({
    id:       `${video.id}-s${i}`,
    startSec: (dur / count) * i,
    endSec:   (dur / count) * (i + 1),
    startStr: fmt((dur / count) * i),
    endStr:   fmt((dur / count) * (i + 1)),
    type:     s.type,
    subtitle: s.sub,
    selected: s.type !== '开场' && s.type !== '结尾',
  }))
}

function generateSubtitles(video, vidIndex) {
  const tpl   = SEGMENT_TEMPLATES[vidIndex % SEGMENT_TEMPLATES.length]
  const dur   = video?.dur > 0 ? video.dur : 60
  const count = tpl.length
  const EXTRA = [
    ['精彩内容即将开始', '请跟着我一起来'],
    ['注意这里的细节', '大家可以暂停看'],
    ['关键步骤来了', '注意力度要均匀'],
    ['接下来非常重要', '按照这个方式操作'],
    ['这里是重点', '认真学习这个步骤'],
  ]
  const extras = EXTRA[vidIndex % EXTRA.length]
  const subs   = []
  tpl.forEach((seg, si) => {
    const segStart = (dur / count) * si
    const segEnd   = (dur / count) * (si + 1)
    const segDur   = segEnd - segStart
    const subCount = si % 2 === 0 ? 2 : 3
    for (let i = 0; i < subCount; i++) {
      const subDur = segDur / subCount
      const start  = segStart + subDur * i
      const end    = start + subDur * 0.85
      subs.push({
        id:       `${video.id}-sub${si}-${i}`,
        startSec: +start.toFixed(2),
        endSec:   +end.toFixed(2),
        text:     i === 0 ? seg.sub : (extras[i - 1] || `${seg.type} 内容 ${i}`),
      })
    }
  })
  return subs
}

// Build composition plans from selected segments (with labels like "1-1")
function buildCompositions(segs) {
  if (!segs.length) return []
  const byVid = {}
  segs.forEach(s => { (byVid[s.videoIndex] = byVid[s.videoIndex] || []).push(s) })
  const vidKeys = Object.keys(byVid).map(Number).sort()
  const nVids   = vidKeys.length
  const N = Math.min(5, Math.max(2, Math.ceil(segs.length / 3)))

  return Array.from({ length: N }, (_, ci) => {
    const picked = []
    let step = 0
    const maxPicks = Math.min(7, segs.length)
    while (picked.length < maxPicks && step < 80) {
      const vi   = vidKeys[(step * 2 + ci * 3) % nVids]
      const vSegs = byVid[vi] || []
      if (vSegs.length > 0) {
        const seg = vSegs[(step + ci * 2) % vSegs.length]
        if (seg && !picked.find(p => p.id === seg.id)) picked.push(seg)
      }
      step++
    }
    if (picked.length < 2) {
      segs.slice(0, Math.min(4, segs.length)).forEach(s => {
        if (!picked.find(p => p.id === s.id)) picked.push(s)
      })
    }
    const totalDur = picked.reduce((acc, sg) => acc + (sg.endSec - sg.startSec), 0)
    return { id: `comp${ci}`, idx: ci, name: `成品视频 ${ci + 1}`, segments: picked, totalDur }
  })
}

function getSubtitlesForSeg(seg, subtitles) {
  return subtitles.filter(s => s.startSec >= seg.startSec && s.startSec < seg.endSec)
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on?'on':''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  )
}

function ExportModal({ phase, prog, exportRes, exportFps, ratio, dedup, compName, onConfirm, onClose }) {
  const enabledDedup = Object.entries(dedup).filter(([,v])=>v).map(([k])=>DEDUP_META[k])
  const EXPORT_STEPS = ['初始化编码器','处理视频轨道','混合音频','应用去重处理','封装 MP4']
  const stepIdx = Math.min(Math.floor(prog / 22), EXPORT_STEPS.length - 1)
  return (
    <div className="overlay" onClick={phase==='confirm'&&prog===0?onClose:undefined}>
      <div className="export-modal" onClick={e=>e.stopPropagation()}>
        {phase === 'confirm' && (<>
          <div className="export-modal-header">
            <div className="export-modal-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              导出视频
              {compName && <span className="export-comp-badge">{compName}</span>}
            </div>
            <button className="import-close" onClick={onClose}>✕</button>
          </div>
          <div className="export-settings-summary">
            {[['格式','MP4 (H.264)'],['分辨率',exportRes==='1080p'?'1920×1080':'1280×720'],['帧率',exportFps],['比例',ratio],['时长','00:30'],['预计大小',`~${exportRes==='1080p'?'148':'64'} MB`]].map(([l,v])=>(
              <div key={l} className="export-setting-card"><span className="esc-label">{l}</span><span className="esc-val">{v}</span></div>
            ))}
          </div>
          <div className="export-dedup-section">
            <div className="export-dedup-title">已应用去重处理（{enabledDedup.length} 项）</div>
            <div className="export-dedup-list">
              {enabledDedup.map(d=>(
                <div key={d.label} className="export-dedup-item">
                  <span className="export-dedup-ico">{d.ico}</span>
                  <div><div className="export-dedup-name">{d.label}</div><div className="export-dedup-desc">{d.desc}</div></div>
                </div>
              ))}
              {enabledDedup.length===0 && <div className="export-dedup-empty">未选择任何去重方式</div>}
            </div>
          </div>
          <div className="export-proto-notice">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            当前为原型模拟导出，不会生成真实 MP4 文件
          </div>
          <div className="export-action-row">
            <button className="export-cancel-btn" onClick={onClose}>取消</button>
            <button className="export-confirm-btn" onClick={onConfirm}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              确认导出
            </button>
          </div>
        </>)}
        {phase === 'exporting' && (
          <div className="export-progress-view">
            <div className="export-prog-icon">
              <svg className="export-prog-ring" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bdr-md)" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#10b981" strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*18*Math.min(prog,100)/100} ${2*Math.PI*18}`}
                  strokeLinecap="round" style={{transformOrigin:'center',transform:'rotate(-90deg)',transition:'stroke-dasharray 0.2s'}}/>
              </svg>
              <span className="export-prog-pct">{Math.round(prog)}%</span>
            </div>
            <h3>正在导出…</h3>
            <p className="export-prog-step">{EXPORT_STEPS[stepIdx]}</p>
            <div className="export-prog-bar-wrap"><div className="export-prog-bar-fill" style={{width:`${prog}%`}}/></div>
            <p className="export-proto-note">原型模拟导出 · 不生成真实 MP4 文件</p>
          </div>
        )}
        {phase === 'done' && (
          <div className="export-done-view">
            <div className="export-done-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h3>导出完成（模拟）</h3>
            <p>当前为原型模拟，不会生成真实 MP4 文件。在真实版本中，视频将保存至本地。</p>
            <div className="export-done-file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              混剪成品_{new Date().toISOString().slice(0,10)}.mp4 · {exportRes} · {exportFps}
            </div>
            <button className="import-done-btn" style={{marginTop:16}} onClick={onClose}>关闭</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CutTimeline ─────────────────────────────────────────────────────────────

function CutTimeline({ segs, duration, currentTime, selectedCutIdx, onSeek, onSelectCut, vidNum, selectedSegIdx, onSelectSeg }) {
  const tlRef   = useRef(null)
  const dragRef = useRef(false)

  useEffect(()=>{
    const onMove=e=>{
      if(!dragRef.current||!tlRef.current||duration<=0) return
      const r=tlRef.current.getBoundingClientRect()
      const t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*duration
      onSeek(t)
    }
    const onUp=()=>{dragRef.current=false; document.body.style.userSelect=''}
    document.addEventListener('mousemove',onMove)
    document.addEventListener('mouseup',onUp)
    return()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
  },[duration,onSeek])

  if (!segs?.length || duration <= 0) {
    return <div className="cut-tl cut-tl-empty"><span>暂无分段数据</span></div>
  }
  const p  = sec => pctOf(sec, duration)
  const vn = vidNum >= 0 ? vidNum + 1 : 1
  return (
    <div ref={tlRef} className="cut-tl" onClick={e => {
      if(dragRef.current) return
      const r = e.currentTarget.getBoundingClientRect()
      onSeek(((e.clientX - r.left) / r.width) * duration)
    }}>
      {segs.map((seg, i) => {
        const tc = SEG_TYPE_COLORS[seg.type] || '#6366f1'
        const isSelSeg = selectedSegIdx === i
        return (
          <div
            key={seg.id}
            className={`cut-seg-blk ${!seg.selected ? 'unsel' : ''} ${isSelSeg ? 'seg-selected' : ''}`}
            style={{
              left: p(seg.startSec),
              width: p(seg.endSec - seg.startSec),
              background: seg.selected ? tc + 'cc' : tc + '44',
              borderTop: `2px solid ${tc}`,
            }}
            title={`${vn}-${i+1} ${seg.type}: ${seg.startStr}–${seg.endStr}\n${seg.subtitle}`}
            onClick={onSelectSeg ? e => { e.stopPropagation(); onSelectSeg(i) } : undefined}
          >
            <span className="cut-seg-num-lbl">{vn}-{i+1}</span>
            <span className="cut-seg-type-lbl">{seg.type}</span>
          </div>
        )
      })}
      {segs.slice(0,-1).map((seg, i) => (
        <div
          key={`cp${i}`}
          className={`cut-point ${selectedCutIdx === i ? 'active' : ''}`}
          style={{ left: p(seg.endSec) }}
          onClick={e => { e.stopPropagation(); onSelectCut(selectedCutIdx === i ? null : i) }}
          title={`切割点 @ ${fmt(seg.endSec)} — 点击选中`}
        />
      ))}
      <div
        className="cut-playhead"
        style={{ left: p(currentTime) }}
        onMouseDown={e=>{
          e.preventDefault(); e.stopPropagation()
          dragRef.current=true
          document.body.style.userSelect='none'
        }}
        title={fmtMs(currentTime)}
      >
        <div className="cut-playhead-head"/>
        <div className="cut-playhead-line" />
        <div className="cut-playhead-time">{fmtMs(currentTime)}</div>
      </div>
    </div>
  )
}

// ─── VideoOverviewCard ────────────────────────────────────────────────────────

function VideoOverviewCard({ video, analysis, vidIdx, isActive, onSelect }) {
  const status   = analysis?.status || 'waiting'
  const segs     = analysis?.segments || []
  const selCount = segs.filter(s => s.selected).length
  const progress = analysis?.progress || 0
  const STATUS = {
    waiting:   { label:'等待分析', cls:'voc-waiting'   },
    analyzing: { label:'分析中',   cls:'voc-analyzing' },
    done:      { label:'已完成',   cls:'voc-done'      },
    confirmed: { label:'已确认',   cls:'voc-confirmed' },
  }
  const sc = STATUS[status] || STATUS.waiting
  return (
    <div className={`voc ${isActive?'active':''}`} onClick={onSelect}>
      <div className="voc-thumb">
        <video src={video.url} preload="metadata" muted playsInline />
        {status === 'analyzing' && (
          <div className="voc-prog-wrap">
            <span className="voc-prog-pct">{Math.round(progress)}%</span>
            <div className="voc-prog-bar"><div className="voc-prog-fill" style={{ width:`${progress}%` }} /></div>
          </div>
        )}
        {isActive && <div className="voc-active-badge">编辑中</div>}
        <span className="voc-num-badge">{vidIdx + 1}</span>
      </div>
      <div className="voc-body">
        <div className="voc-name" title={video.name}>{video.name.replace(/\.[^.]+$/,'')}</div>
        <div className="voc-row2">
          <span className="voc-dur">{video.durStr}</span>
          <span className={`voc-status ${sc.cls}`}>
            {status==='analyzing' && <span className="s2s-pulse"/>}
            {status==='confirmed' && '✓ '}
            {sc.label}
          </span>
        </div>
        {segs.length > 0 && (
          <div className="voc-seg-row">
            {segs.map((s,i)=>(
              <span
                key={s.id}
                className={`voc-seg-pip ${s.selected?'sel':''}`}
                style={{background: s.selected ? (SEG_TYPE_COLORS[s.type]||'#6366f1') : undefined}}
                title={`${vidIdx+1}-${i+1} ${s.type}`}
              />
            ))}
            <span className="voc-seg-info">{selCount}/{segs.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── main app ────────────────────────────────────────────────────────────────

export default function App() {
  // ── workflow ──
  const [step, setStep]             = useState(1)
  const [previewVid, setPreviewVid] = useState(null)

  // ── settings ──
  const [ratio, setRatio]         = useState('9:16')
  const [intensity, setIntensity] = useState('medium')
  const [isGenerating, setGen]    = useState(false)
  const [isGenerated, setDone]    = useState(false)
  const [genProgress, setGenProg] = useState(0)
  const [genStep, setGenStep]     = useState(GEN_STEPS[0])
  const [tlFlash, setTlFlash]     = useState(false)

  // ── step-3 playback ──
  const [isPlaying, setPlaying]   = useState(false)
  const [currentTime, setCurrent] = useState(0)

  // ── uploaded videos ──
  const [uploadedVideos, setUploadedVideos]   = useState([])
  const [selectedVideoId, setSelectedVideoId] = useState(null)

  // ── step-2 analysis ──
  const [videoAnalysis, setVideoAnalysis] = useState({})

  // ── step-2 editor ──
  const [currentVideoId, setCurrentVideoId]   = useState(null)
  const [editorTime, setEditorTime]           = useState(0)
  const [editorPlaying, setEditorPlaying]     = useState(false)
  const [playingSegEnd, setPlayingSegEnd]     = useState(null)
  const [selectedCutIdx, setSelectedCutIdx]   = useState(null)
  const [selectedSegIdx, setSelectedSegIdx]   = useState(null)
  const [selectedSubIdx, setSelectedSubIdx]  = useState(null)
  const [expandedSegs, setExpandedSegs]       = useState({})
  const [subStep, setSubStep]                 = useState('cut')

  // ── step-3 compositions ──
  const [compositions, setCompositions]     = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)

  // ── step-3 composition editing ──
  const [editingSeg, setEditingSeg]     = useState(null)   // {compId, segIdx}
  const [lockedSegs, setLockedSegs]     = useState({})     // {compId: {segIdx: true}}
  const [showAllCands, setShowAllCands] = useState({})     // {'compId_segIdx': true}
  const [pendingCand, setPendingCand]       = useState(null)   // {cand, compId, segIdx}
  const [candPreviewPlaying, setCandPrevPlay] = useState(false)
  const [candPreviewTime, setCandPrevTime]    = useState(0)

  // ── export ──
  const [showExport, setShowExport]   = useState(false)
  const [exportPhase, setExportPhase] = useState('confirm')
  const [exportProg, setExportProg]   = useState(0)
  const [exportRes, setExportRes]     = useState('1080p')
  const [exportFps, setExportFps]     = useState('30fps')
  const [exportCompName, setExportCompName] = useState('')

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

  const timerRef              = useRef(null)
  const fileInputRef          = useRef(null)
  const videoRef              = useRef(null)
  const editorVideoRef        = useRef(null)
  const currentlyAnalyzingRef = useRef(null)
  const uploadedVideosRef     = useRef([])
  const videoAnalysisRef      = useRef({})
  const scrubberRef           = useRef(null)
  const scrubDragRef          = useRef(false)
  const candPreviewRef        = useRef(null)

  useEffect(() => { uploadedVideosRef.current = uploadedVideos }, [uploadedVideos])
  useEffect(() => { videoAnalysisRef.current = videoAnalysis  }, [videoAnalysis])

  // ── derived ──
  const enabledDedupKeys = Object.entries(dedup).filter(([,v])=>v).map(([k])=>k)
  const dedupSelected    = enabledDedupKeys.length

  const selectedVideo = useMemo(
    () => uploadedVideos.find(v=>v.id===selectedVideoId) || uploadedVideos[0] || null,
    [uploadedVideos, selectedVideoId]
  )
  const effectiveDuration = isGenerated ? TOTAL : (selectedVideo?.dur||0)

  const totalDuration = useMemo(
    () => uploadedVideos.reduce((s,v)=>s+(v.dur||0), 0),
    [uploadedVideos]
  )

  const currentScene = useMemo(()=>{
    if (!isGenerated) return null
    return SCENES.find(s=>currentTime>=s.start&&currentTime<s.end)||null
  }, [isGenerated, currentTime])

  const currentSubText = useMemo(()=>{
    if (!isGenerated) return ''
    return SUBTITLE_TEXTS.find(s=>currentTime>=s.start&&currentTime<s.end)?.text||''
  }, [isGenerated, currentTime])

  // editor computed
  const editorVid      = useMemo(()=>uploadedVideos.find(v=>v.id===currentVideoId)||null, [uploadedVideos, currentVideoId])
  const editorAnalysis = useMemo(()=>videoAnalysis[currentVideoId]||null, [videoAnalysis, currentVideoId])
  const editorSegs     = editorAnalysis?.segments || []
  const editorVidIdx    = useMemo(()=>uploadedVideos.findIndex(v=>v.id===currentVideoId), [uploadedVideos, currentVideoId])
  const editorSubtitles = editorAnalysis?.subtitles || []
  const currentSubIdx   = useMemo(()=>{
    if (!editorSubtitles.length) return -1
    return editorSubtitles.findIndex(s=>editorTime>=s.startSec&&editorTime<s.endSec)
  }, [editorSubtitles, editorTime])

  // all selected segs with segment-level labels (1-1, 2-3, etc.)
  const allSelectedSegs = useMemo(()=>
    uploadedVideos.flatMap((v,vi)=>{
      const segs = videoAnalysis[v.id]?.segments || []
      return segs
        .map((s,si)=>({...s, videoIndex:vi, segInVid:si, label:`${vi+1}-${si+1}`, videoName:v.name}))
        .filter(s=>s.selected)
    }),
    [uploadedVideos, videoAnalysis]
  )
  const usedVideos = useMemo(()=>
    uploadedVideos.filter(v=>(videoAnalysis[v.id]?.segments||[]).some(s=>s.selected)),
    [uploadedVideos, videoAnalysis]
  )
  const totalSelectedSegs = allSelectedSegs.length

  // selected composition
  const selectedComp = useMemo(()=>
    compositions.find(c=>c.id===selectedCompId) || compositions[0] || null,
    [compositions, selectedCompId]
  )

  // step-2 stats
  const waitingCount   = uploadedVideos.filter(v=>videoAnalysis[v.id]?.status==='waiting').length
  const analyzingCount = uploadedVideos.filter(v=>videoAnalysis[v.id]?.status==='analyzing').length
  const doneCount      = uploadedVideos.filter(v=>['done','confirmed'].includes(videoAnalysis[v.id]?.status)).length
  const totalSubCount  = uploadedVideos.reduce((s,v)=>s+(videoAnalysis[v.id]?.subtitleCount||0), 0)
  const totalSegCount  = uploadedVideos.reduce((s,v)=>s+(videoAnalysis[v.id]?.segments?.length||0), 0)

  // ── effects ──

  useEffect(()=>{
    if (!isGenerated) return
    if (isPlaying) {
      timerRef.current = setInterval(()=>{ setCurrent(t=>{ if(t>=TOTAL){setPlaying(false);return 0} return Math.min(t+0.1,TOTAL) }) }, 100)
    } else { clearInterval(timerRef.current) }
    return ()=>clearInterval(timerRef.current)
  }, [isPlaying, isGenerated])

  useEffect(()=>{
    if (isGenerated) { clearInterval(timerRef.current); return }
    const video = videoRef.current; if (!video) return
    if (isPlaying) video.play().catch(()=>setPlaying(false)); else video.pause()
    return ()=>{ video.pause() }
  }, [isPlaying, isGenerated])

  useEffect(()=>{ setPlaying(false); setCurrent(0) }, [selectedVideoId])

  // editor video playback
  useEffect(()=>{
    const vid = editorVideoRef.current; if (!vid) return
    if (editorPlaying) vid.play().catch(()=>setEditorPlaying(false)); else vid.pause()
    return ()=>{ vid.pause() }
  }, [editorPlaying])

  useEffect(()=>{
    setEditorTime(0); setEditorPlaying(false); setSelectedCutIdx(null); setSelectedSegIdx(null); setSelectedSubIdx(null)
  }, [currentVideoId])

  // seek candidate preview when selection changes, reset play state
  useEffect(()=>{
    setCandPrevPlay(false)
    setCandPrevTime(0)
    if (!candPreviewRef.current || !pendingCand) return
    const vid = candPreviewRef.current
    vid.pause()
    const t = pendingCand.cand.startSec || 0
    vid.currentTime = t
    setCandPrevTime(t)
  }, [pendingCand])

  // scrubber drag
  useEffect(()=>{
    const onMove=e=>{
      if(!scrubDragRef.current||!scrubberRef.current||!editorVid) return
      const r=scrubberRef.current.getBoundingClientRect()
      const t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))
      handleEditorSeek(t*editorVid.dur)
    }
    const onUp=()=>{scrubDragRef.current=false; document.body.style.userSelect=''}
    document.addEventListener('mousemove',onMove)
    document.addEventListener('mouseup',onUp)
    return ()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
  },[editorVid]) // eslint-disable-line react-hooks/exhaustive-deps

  // step 2 init
  useEffect(()=>{
    if (step!==2) return
    const exists = uploadedVideos.some(v=>v.id===currentVideoId)
    if (!exists||!currentVideoId) setCurrentVideoId(uploadedVideos[0]?.id??null)
    setVideoAnalysis(prev=>{
      const next={...prev}
      uploadedVideos.forEach(v=>{ if (!next[v.id]) next[v.id]={status:'waiting',progress:0,segments:[],subtitleCount:0} })
      videoAnalysisRef.current=next
      return next
    })
    const t=setTimeout(startNextAnalysis, 500)
    return ()=>clearTimeout(t)
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── sequential analysis ──

  function startNextAnalysis() {
    if (currentlyAnalyzingRef.current) return
    const videos   = uploadedVideosRef.current
    const analysis = videoAnalysisRef.current
    const waiting  = videos.find(v=>analysis[v.id]?.status==='waiting')
    if (!waiting) return
    currentlyAnalyzingRef.current = waiting.id
    setVideoAnalysis(prev=>({ ...prev, [waiting.id]:{status:'analyzing',progress:0,segments:[],subtitleCount:0} }))
    let p=0
    const iv=setInterval(()=>{
      p+=Math.random()*9+5
      if (p>=100) {
        clearInterval(iv)
        const vid    = uploadedVideosRef.current.find(v=>v.id===waiting.id)
        const vidIdx = uploadedVideosRef.current.findIndex(v=>v.id===waiting.id)
        const segs   = generateSegments(vid, vidIdx)
        const subs   = generateSubtitles(vid, vidIdx)
        const subCnt = subs.length
        setVideoAnalysis(prev=>{
          const next={...prev,[waiting.id]:{status:'done',progress:100,segments:segs,subtitleCount:subCnt,subtitles:subs}}
          videoAnalysisRef.current=next
          return next
        })
        currentlyAnalyzingRef.current=null
        setTimeout(startNextAnalysis, 700)
      } else {
        setVideoAnalysis(prev=>({ ...prev, [waiting.id]:{...prev[waiting.id],progress:Math.min(p,99)} }))
      }
    }, 200)
  }

  // ── handlers ──

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''), 3000) }

  function handleImportClick() { fileInputRef.current?.click() }

  async function handleFileSelect(e) {
    const files=Array.from(e.target.files); if (!files.length) return
    const idBase=Date.now()
    const newVideos=await Promise.all(files.map(async(file,i)=>{
      const url=URL.createObjectURL(file)
      const meta=await readVideoMeta(url)
      return { id:idBase+i, name:file.name, sizeStr:formatSize(file.size), dur:meta.dur||0, durStr:meta.dur>0?fmt(meta.dur):'—', res:meta.width>0?`${meta.width}×${meta.height}`:'—', url }
    }))
    setUploadedVideos(prev=>[...prev,...newVideos])
    setSelectedVideoId(prev=>prev??(newVideos[0]?.id??null))
    e.target.value=''
  }

  function handleRemoveVideo(id) {
    const vid=uploadedVideos.find(v=>v.id===id)
    if (vid) URL.revokeObjectURL(vid.url)
    if (previewVid?.id===id) setPreviewVid(null)
    setVideoAnalysis(prev=>{ const n={...prev}; delete n[id]; return n })
    setUploadedVideos(prev=>{ const n=prev.filter(v=>v.id!==id); if(selectedVideoId===id) setSelectedVideoId(n[0]?.id??null); return n })
  }

  function handleEditorSeek(time) {
    const clamped=Math.max(0,Math.min(time, editorVid?.dur||0))
    setEditorTime(clamped)
    if (editorVideoRef.current) editorVideoRef.current.currentTime=clamped
  }

  function toggleEditorSeg(segIdx) {
    if (!currentVideoId) return
    setVideoAnalysis(prev=>({
      ...prev,
      [currentVideoId]: {
        ...prev[currentVideoId],
        segments: prev[currentVideoId].segments.map((s,i)=>i===segIdx?{...s,selected:!s.selected}:s)
      }
    }))
  }

  function changeSegType(segIdx, newType) {
    if (!currentVideoId) return
    setVideoAnalysis(prev=>({
      ...prev,
      [currentVideoId]: {
        ...prev[currentVideoId],
        segments: prev[currentVideoId].segments.map((s,i)=>i===segIdx?{...s,type:newType}:s)
      }
    }))
  }

  function addCutAtCurrentTime() {
    if (!currentVideoId||!editorSegs.length) return
    const time=editorTime
    const idx=editorSegs.findIndex(s=>time>s.startSec+0.5&&time<s.endSec-0.5)
    if (idx===-1) { showToast('当前时间点无法新增切割点（距片段边缘太近）'); return }
    const seg=editorSegs[idx]
    const newSegs=[
      ...editorSegs.slice(0,idx),
      {...seg, id:seg.id+'a', endSec:time, endStr:fmt(time)},
      { id:seg.id+'b', startSec:time, endSec:seg.endSec, startStr:fmt(time), endStr:seg.endStr, type:seg.type, subtitle:seg.subtitle, selected:seg.selected },
      ...editorSegs.slice(idx+1),
    ]
    setVideoAnalysis(prev=>({ ...prev, [currentVideoId]:{...prev[currentVideoId],segments:newSegs} }))
    setSelectedCutIdx(idx)
    showToast(`已在 ${fmt(time)} 新增切割点`)
  }

  function adjustCutPoint(cutIdx, delta) {
    if (!currentVideoId||cutIdx===null||cutIdx<0||cutIdx>=editorSegs.length-1) return
    const segs=editorSegs
    const newTime=segs[cutIdx].endSec+delta
    const clamped=Math.max(segs[cutIdx].startSec+0.5, Math.min(segs[cutIdx+1].endSec-0.5, newTime))
    setVideoAnalysis(prev=>({
      ...prev,
      [currentVideoId]: {
        ...prev[currentVideoId],
        segments: prev[currentVideoId].segments.map((s,i)=>{
          if (i===cutIdx)   return {...s, endSec:clamped,   endStr:fmt(clamped)}
          if (i===cutIdx+1) return {...s, startSec:clamped, startStr:fmt(clamped)}
          return s
        })
      }
    }))
  }

  function mergeSegs(segIdx) {
    if (!currentVideoId||segIdx<0||segIdx>=editorSegs.length-1) return
    const a=editorSegs[segIdx], b=editorSegs[segIdx+1]
    const merged={ id:a.id, startSec:a.startSec, startStr:a.startStr, endSec:b.endSec, endStr:b.endStr, type:a.type, subtitle:[a.subtitle,b.subtitle].filter(Boolean).join(' '), selected:a.selected||b.selected }
    const newSegs=[...editorSegs.slice(0,segIdx), merged, ...editorSegs.slice(segIdx+2)]
    setVideoAnalysis(prev=>({ ...prev, [currentVideoId]:{...prev[currentVideoId],segments:newSegs} }))
    setSelectedCutIdx(null)
    setSelectedSegIdx(Math.min(segIdx, newSegs.length-1))
    showToast('已合并相邻片段')
  }

  function splitSegAtMiddle(segIdx) {
    if (!currentVideoId||segIdx<0||segIdx>=editorSegs.length) return
    const seg=editorSegs[segIdx]
    const mid=(seg.startSec+seg.endSec)/2
    handleEditorSeek(mid)
    showToast(`已跳至片段中点（${fmt(mid)}），确认位置后点击"新增切割点"`)
  }

  function handleConfirmVideo(videoId) {
    setVideoAnalysis(prev=>({
      ...prev,
      [videoId]: { ...prev[videoId], status:prev[videoId].status==='confirmed'?'done':'confirmed' }
    }))
  }

  function handleGenerate() {
    if (isGenerating) return
    setPlaying(false); setGen(true); setDone(false); setGenProg(0); setGenStep(GEN_STEPS[0])
    let p=0, si=0
    const iv=setInterval(()=>{
      p+=Math.random()*14+4; si=Math.min(Math.floor(p/22),GEN_STEPS.length-1); setGenStep(GEN_STEPS[si])
      if (p>=100) {
        clearInterval(iv); setGenProg(100)
        setTimeout(()=>{
          setGen(false); setDone(true); setCurrent(0); setTlFlash(true)
          setTimeout(()=>setTlFlash(false),800)
          const freshVids = uploadedVideosRef.current
          const freshAna  = videoAnalysisRef.current
          const freshSegs = freshVids.flatMap((v,vi)=>{
            const segs = freshAna[v.id]?.segments || []
            return segs
              .map((s,si)=>({...s, videoIndex:vi, segInVid:si, label:`${vi+1}-${si+1}`, videoName:v.name}))
              .filter(s=>s.selected)
          })
          const comps = buildCompositions(freshSegs)
          setCompositions(comps)
          setSelectedCompId(comps[0]?.id ?? null)
          setSubStep('compose')
        }, 400)
      } else { setGenProg(p) }
    }, 220)
  }

  function handleExportOpen(compName)  {
    setExportCompName(compName||'')
    setShowExport(true); setExportPhase('confirm'); setExportProg(0)
  }
  function handleExportConfirm() {
    setExportPhase('exporting'); setExportProg(0)
    let p=0
    const iv=setInterval(()=>{ p+=Math.random()*6+2; if(p>=100){p=100;clearInterval(iv);setExportProg(100);setTimeout(()=>setExportPhase('done'),300)}else{setExportProg(p)} }, 200)
  }
  function handleExportClose() { setShowExport(false); setTimeout(()=>{ setExportPhase('confirm'); setExportProg(0) },300) }

  function handleSeek(newTime) {
    const clamped=Math.max(0,Math.min(newTime,effectiveDuration)); setCurrent(clamped)
    if (!isGenerated&&videoRef.current) videoRef.current.currentTime=clamped
  }

  function toggleDedup(k) { setDedup(d=>({...d,[k]:!d[k]})) }

  function replaceCompSeg(compId, segIdx, newSeg) {
    setCompositions(prev=>prev.map(c=>{
      if (c.id!==compId) return c
      const newSegs=c.segments.map((s,i)=>i===segIdx?newSeg:s)
      return {...c,segments:newSegs,totalDur:newSegs.reduce((a,s)=>a+(s.endSec-s.startSec),0)}
    }))
  }

  function toggleLockSeg(compId, segIdx) {
    setLockedSegs(prev=>{
      const cl=prev[compId]||{}
      return {...prev,[compId]:{...cl,[segIdx]:!cl[segIdx]}}
    })
  }

  function regenCompRow(compId) {
    const comp=compositions.find(c=>c.id===compId)
    if (!comp) return
    const cl=lockedSegs[compId]||{}
    const newSegs=comp.segments.map((seg,i)=>{
      if (cl[i]) return seg
      const otherIds=new Set(comp.segments.filter((_,j)=>j!==i).map(s=>s.id))
      const cands=allSelectedSegs.filter(c=>c.type===seg.type&&c.id!==seg.id&&!otherIds.has(c.id))
      return cands.length>0?cands[Math.floor(Math.random()*cands.length)]:seg
    })
    setCompositions(prev=>prev.map(c=>c.id===compId?{...c,segments:newSegs,totalDur:newSegs.reduce((a,s)=>a+(s.endSec-s.startSec),0)}:c))
    showToast('已重新生成此行组合')
  }

  // ── reusable blocks ──
  const ratioBlock = (
    <div className="ratio-group">
      {[['9:16','竖屏'],['1:1','方形'],['16:9','横屏']].map(([r,desc])=>(
        <button key={r} className={`ratio-btn ${ratio===r?'active':''}`} onClick={()=>setRatio(r)}>
          <div className={`ratio-icon ri-${r.replace(':','-')}`}/><span>{r}</span><small>{desc}</small>
        </button>
      ))}
    </div>
  )
  const intensityBlock = (
    <div className="intensity-group">
      {[['light','轻度混剪','轻微裁剪，画面连贯'],['medium','中度混剪','平衡去重与流畅度'],['strong','强力混剪','最大差异化处理']].map(([k,label,desc])=>(
        <button key={k} className={`intensity-btn ${intensity===k?'active':''}`} onClick={()=>setIntensity(k)}>
          <div className="ib-left"><div className={`ib-dot ${k===intensity?'on':''}`}/><span>{label}</span></div>
          <small>{desc}</small>
        </button>
      ))}
    </div>
  )
  const dedupBlock = (
    <div className="dedup-grid">
      {[['crop','裁剪边缘','◰'],['scale','轻微缩放','⊞'],['mirror','镜像翻转','⇔'],['speed','变速处理','⏩'],
        ['bgImage','背景底图','▣'],['picInPic','可见画中画','⧉'],['subDistort','字幕扰动','T'],['endImage','片尾图片','⬜']].map(([k,label,ico])=>(
        <label key={k} className={`dedup-chip ${dedup[k]?'on':''}`}>
          <input type="checkbox" checked={dedup[k]} onChange={()=>toggleDedup(k)}/>
          <span className="dedup-chip-ico">{ico}</span><span>{label}</span>
        </label>
      ))}
    </div>
  )

  // ════════════════════════════════════════════════════════ RENDER

  return (
    <div className="app">

      <input ref={fileInputRef} type="file" accept="video/*" multiple style={{display:'none'}} onChange={handleFileSelect}/>

      {previewVid && (
        <div className="overlay" onClick={()=>setPreviewVid(null)}>
          <div className="vid-preview-modal" onClick={e=>e.stopPropagation()}>
            <div className="vid-preview-header">
              <span className="vid-preview-name">{previewVid.name}</span>
              <button className="import-close" onClick={()=>setPreviewVid(null)}>✕</button>
            </div>
            <video src={previewVid.url} controls autoPlay className="vid-preview-video"/>
            <div className="vid-preview-meta">
              {previewVid.res!=='—'&&<span>{previewVid.res}</span>}
              <span>{previewVid.durStr}</span><span>{previewVid.sizeStr}</span>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      {showExport && <ExportModal phase={exportPhase} prog={exportProg} exportRes={exportRes} exportFps={exportFps} ratio={ratio} dedup={dedup} compName={exportCompName} onConfirm={handleExportConfirm} onClose={handleExportClose}/>}

      {isGenerating && (
        <div className="overlay">
          <div className="gen-box">
            <div className="gen-ring">
              <svg className="gen-ring-svg" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--bdr-md)" strokeWidth="3"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" strokeWidth="3"
                  strokeDasharray={`${2*Math.PI*18*Math.min(genProgress,100)/100} ${2*Math.PI*18}`}
                  strokeLinecap="round" style={{transformOrigin:'center',transform:'rotate(-90deg)',transition:'stroke-dasharray 0.22s ease'}}/>
              </svg>
              <span className="gen-ring-pct">{Math.round(Math.min(genProgress,100))}</span>
            </div>
            <h3>正在生成混剪方案</h3>
            <p className="gen-step">{genStep}</p>
            {totalSelectedSegs>0&&<p className="gen-seg-info">基于 {totalSelectedSegs} 个片段 · {usedVideos.length} 个视频</p>}
            <div className="gen-steps-row">
              {['素材分析','计算混剪','成品方案','去重处理','完成'].map((s,i)=>(
                <div key={i} className={`gen-dot ${Math.floor(genProgress/22)>=i?'done':''}`} title={s}/>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ HEADER */}
      <header className="header">
        <div className="header-l">
          <div className="logo-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>
              <line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>
            </svg>
          </div>
          <div className="logo-text"><span className="logo-title">视频混剪工具</span><span className="logo-ver">v0.1</span></div>
        </div>
        <nav className="step-nav">
          {[{n:1,label:'素材准备'},{n:2,label:'字幕分段'},{n:3,label:'预览导出'}].flatMap(({n,label},i)=>{
            const isActive=step===n, isDone=step>n, isLocked=n===3&&!isGenerated&&step<3
            return [
              i>0&&<div key={`sep-${n}`} className={`step-nav-sep ${isDone?'done':''}`}/>,
              <div key={n} className={`step-nav-item ${isActive?'active':''} ${isDone?'done':''} ${isLocked?'locked':''}`}
                onClick={()=>(step!==n&&!(isLocked))&&setStep(n)} title={isLocked?'请先完成混剪方案生成':undefined}>
                <div className="step-nav-num">{isDone?<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>:n}</div>
                <span className="step-nav-label">{label}</span>
              </div>,
            ].filter(Boolean)
          })}
        </nav>
        <div className="header-r">
          <button className="btn-ghost btn-sm" onClick={()=>showToast('项目保存功能将在后续版本接入')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            保存
          </button>
        </div>
      </header>

      {/* ══ STEP 1 */}
      {step===1&&(
        <div className="step1">
          <div className="s1-bar">
            <button className="s1-upload-btn" onClick={handleImportClick}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              选择本地视频文件
            </button>
            {uploadedVideos.length>0&&<span className="s1-count">已导入 <strong>{uploadedVideos.length}</strong> 个视频 · 总时长 {fmt(totalDuration)}</span>}
            <span className="s1-hint">支持 MP4 · MOV · AVI · 多选 · 不上传服务器</span>
          </div>
          <div className="s1-content">
            {uploadedVideos.length===0?(
              <div className="s1-empty" onClick={handleImportClick}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                <p>点击选择本地视频文件，或拖拽到这里</p>
                <span>支持多选 · 文件仅在本地处理，不会上传到任何服务器</span>
              </div>
            ):(
              <div className="s1-video-grid">
                {uploadedVideos.map(v=>(
                  <div key={v.id} className="s1-video-card">
                    <div className="s1-card-thumb" onClick={()=>setPreviewVid(v)}>
                      <video src={v.url} preload="metadata" muted playsInline/>
                      <div className="s1-card-overlay"><div className="s1-preview-btn">▶ 预览</div></div>
                      <span className="s1-card-dur">{v.durStr}</span>
                    </div>
                    <div className="s1-card-body">
                      <div className="s1-card-name" title={v.name}>{v.name}</div>
                      <div className="s1-card-meta">{v.res!=='—'&&<span>{v.res}</span>}<span>{v.durStr}</span><span>{v.sizeStr}</span></div>
                      <div className="s1-card-actions">
                        <button className="s1-act-btn" onClick={()=>setPreviewVid(v)}>▶ 预览</button>
                        <button className="s1-act-btn s1-act-remove" onClick={()=>handleRemoveVideo(v.id)}>× 移除</button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="s1-add-card" onClick={handleImportClick}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" opacity="0.4"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span>继续添加视频</span>
                </div>
              </div>
            )}
            <div className="s1-other-assets">
              <div className="s1-other-title">其他素材（后续版本接入）</div>
              <div className="s1-other-row">
                {[{icon:'🖼',label:'图片 / 贴图',sub:'3 个预置',tip:'图片上传将在后续版本接入'},{icon:'🎵',label:'音乐 / 音效',sub:'背景音乐.mp3',tip:'音频上传将在后续版本接入'},{icon:'T',label:'字幕 / 文案',sub:'3 条预置',tip:'字幕上传将在后续版本接入'}].map(({icon,label,sub,tip})=>(
                  <div key={label} className="s1-other-item" onClick={()=>showToast(tip)}>
                    <span className="s1-other-icon">{icon}</span>
                    <div><div className="s1-other-label">{label}</div><div className="s1-other-sub">{sub}</div></div>
                    <span className="s1-other-badge">模拟</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="step-footer">
            <div/>
            <button className={`step-next-btn ${uploadedVideos.length===0?'disabled':''}`} onClick={()=>uploadedVideos.length===0?showToast('请先上传视频素材'):setStep(2)}>
              下一步：字幕识别与分段
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* ══ STEP 2: 字幕驱动切片编辑器 */}
      {step===2&&(
        <div className="step2">

          {/* stats bar */}
          <div className="s2s-stats-bar">
            {[
              {label:'视频总数', val:uploadedVideos.length},
              {label:'等待分析', val:waitingCount,   cls:waitingCount>0?'sv-wait':''},
              {label:'分析中',   val:analyzingCount, cls:analyzingCount>0?'sv-run':''},
              {label:'已完成',   val:doneCount,      cls:doneCount>0?'sv-done':''},
              {label:'识别字幕', val:`${totalSubCount} 条`},
              {label:'总片段',   val:`${totalSegCount} 个`},
              {label:'已选片段', val:totalSelectedSegs, cls:totalSelectedSegs>0?'sv-sel':''},
            ].map(({label,val,cls},i)=>(
              <Fragment key={label}>
                {i>0&&<div className="s2s-stat-sep"/>}
                <div className="s2s-stat">
                  <span className={`s2s-stat-val ${cls||''}`}>{val}</span>
                  <span className="s2s-stat-label">{label}</span>
                </div>
              </Fragment>
            ))}
            <button className="s2s-back-btn" onClick={()=>setStep(1)}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              修改素材
            </button>
          </div>

          {/* sub-step banner */}
          {subStep==='compose'&&(
            <div className="s2-substep-banner">
              <span className="s2-substep-badge">2B</span>
              <span className="s2-substep-title">组合方案编辑</span>
              <span className="s2-substep-info">{compositions.length} 个成品方案 · 点击片段块可替换</span>
              <button className="s2-substep-back" onClick={()=>setSubStep('cut')}>← 返回字幕切片</button>
            </div>
          )}

          {/* compose view (2B) */}
          {subStep==='compose'&&(
            <div className="s2-compose-view">
              <div className="s2-compose-cols">
                {/* LEFT: simplified material list */}
                <aside className="s2-compose-left">
                  <div className="s2-compose-left-head">参与混剪素材</div>
                  {(usedVideos.length>0?usedVideos:uploadedVideos).map((v,vi)=>(
                    <div key={v.id} className="s3-mat-item" onClick={()=>setPreviewVid(v)}>
                      <div className="s3-mat-thumb"><video src={v.url} preload="metadata" muted playsInline/></div>
                      <div className="s3-mat-info">
                        <div className="s3-mat-name">V{vi+1} · {v.name.replace(/\.[^.]+$/,'').slice(0,16)}</div>
                        <div className="s3-mat-meta">{v.durStr}{videoAnalysis[v.id]?.segments&&<span> · {videoAnalysis[v.id].segments.filter(s=>s.selected).length}片</span>}</div>
                      </div>
                    </div>
                  ))}
                </aside>
                {/* RIGHT: segment edit panel */}
                <aside className="panel-r s2-compose-right">
                  {editingSeg ? (()=>{
                    const editComp=compositions.find(c=>c.id===editingSeg.compId)
                    const editSeg=editComp?.segments[editingSeg.segIdx]
                    const tc=editSeg?(SEG_TYPE_COLORS[editSeg.type]||'#6366f1'):'#6366f1'
                    const allCandsKey=`${editingSeg.compId}_${editingSeg.segIdx}`
                    const compSegIds=new Set((editComp?.segments||[]).filter((_,i)=>i!==editingSeg.segIdx).map(s=>s.id))
                    const recs=editSeg?[
                      ...allSelectedSegs.filter(c=>c.type===editSeg.type&&c.id!==editSeg.id&&!compSegIds.has(c.id)&&c.videoIndex!==editSeg.videoIndex),
                      ...allSelectedSegs.filter(c=>c.type===editSeg.type&&c.id!==editSeg.id&&!compSegIds.has(c.id)&&c.videoIndex===editSeg.videoIndex),
                    ].slice(0,5):[]
                    const allCands=editSeg?allSelectedSegs.filter(c=>c.id!==editSeg.id&&!compSegIds.has(c.id)):[]
                    const candsByType=allCands.reduce((g,c)=>{(g[c.type]=g[c.type]||[]).push(c);return g},{})
                    // fallback recs: adjacent segs from same video
                    const adjFallback=editSeg&&recs.length===0?allSelectedSegs.filter(c=>c.videoIndex===editSeg.videoIndex&&c.id!==editSeg.id&&!compSegIds.has(c.id)).slice(0,3):[]

                    // ── candidate detail panel ──
                    if (pendingCand) {
                      const {cand:pc,compId:pCompId,segIdx:pSegIdx}=pendingCand
                      const pctc=SEG_TYPE_COLORS[pc.type]||'#6366f1'
                      const srcVid=uploadedVideos[pc.videoIndex]
                      const usedInComps=compositions.filter(c=>c.id!==pCompId&&c.segments.some(s=>s.id===pc.id))
                      const segDur=pc.endSec-pc.startSec
                      const pComp=compositions.find(c=>c.id===pCompId)
                      const pOrigSeg=pComp?.segments[pSegIdx]
                      const progPct=segDur>0?Math.max(0,Math.min(100,((candPreviewTime-pc.startSec)/segDur)*100)):0
                      function toggleCandPlay(){
                        const vid=candPreviewRef.current; if(!vid) return
                        if(candPreviewPlaying){ vid.pause(); setCandPrevPlay(false) }
                        else {
                          if(vid.currentTime<pc.startSec||vid.currentTime>=pc.endSec) vid.currentTime=pc.startSec
                          vid.play().then(()=>setCandPrevPlay(true)).catch(()=>{})
                        }
                      }
                      return (
                        <>
                          <div className="r3-edit-header">
                            <button className="r3-back-btn" onClick={()=>{setPendingCand(null);setCandPrevPlay(false)}}>← 返回</button>
                            <span className="r3-edit-title">候选预览</span>
                          </div>

                          {/* Replacement relationship */}
                          <div className="r3-cd-rel">
                            <div className="r3-cd-rel-pos">
                              {pComp&&<span className="r3-cd-comp-tag">{pComp.name}</span>} 第 {pSegIdx+1} 段
                            </div>
                            {pOrigSeg&&(
                              <div className="r3-cd-rel-row">
                                <span className="r3-cd-rel-from" style={{color:SEG_TYPE_COLORS[pOrigSeg.type]||'#6366f1'}}>
                                  {pOrigSeg.label}&nbsp;{pOrigSeg.type}
                                </span>
                                <span className="r3-cd-rel-arrow">→</span>
                                <span className="r3-cd-rel-to" style={{color:pctc}}>
                                  {pc.label}&nbsp;{pc.type}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Segment-limited video player */}
                          {srcVid?(
                            <div className="r3-cd-player">
                              <div className="r3-cd-video-wrap" onClick={toggleCandPlay}>
                                <video
                                  ref={candPreviewRef}
                                  src={srcVid.url}
                                  className="r3-cd-video"
                                  playsInline preload="metadata"
                                  onTimeUpdate={()=>{
                                    const vid=candPreviewRef.current; if(!vid||!pendingCand) return
                                    const t=vid.currentTime; setCandPrevTime(t)
                                    if(t>=pendingCand.cand.endSec){ vid.pause(); vid.currentTime=pendingCand.cand.startSec; setCandPrevPlay(false) }
                                  }}
                                  onEnded={()=>setCandPrevPlay(false)}
                                />
                                <div className={`r3-cd-play-btn${candPreviewPlaying?' playing':''}`}>
                                  {candPreviewPlaying
                                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                                  }
                                </div>
                              </div>
                              <div className="r3-cd-seg-bar">
                                <span className="r3-cd-seg-t">{fmt(Math.max(0,candPreviewTime-pc.startSec))}</span>
                                <div className="r3-cd-seg-prog"><div className="r3-cd-seg-fill" style={{width:`${progPct}%`}}/></div>
                                <span className="r3-cd-seg-t">{fmt(segDur)}</span>
                              </div>
                              <div className="r3-cd-seg-range">{pc.startStr} – {pc.endStr} · 共 {fmt(segDur)}</div>
                            </div>
                          ):(
                            <div className="r3-cd-no-vid">无法加载源视频</div>
                          )}

                          {/* Segment info */}
                          <div className="r3-current" style={{paddingTop:6}}>
                            <div className="r3-cur-card">
                              <div className="r3-cur-top">
                                <span className="r3-cur-label" style={{color:pctc}}>{pc.label}</span>
                                <span className="r3-cur-type" style={{color:pctc,borderColor:pctc+'44',background:pctc+'18'}}>{pc.type}</span>
                                <span className="r3-cur-src">V{pc.videoIndex+1}</span>
                              </div>
                              {pc.subtitle&&<div className="r3-cur-sub" style={{marginTop:4}}>{pc.subtitle}</div>}
                              {usedInComps.length>0&&<div className="r3-cd-used">⚠ 已用于：{usedInComps.map(c=>c.name).join('、')}</div>}
                            </div>
                          </div>

                          <div className="r3-cd-actions">
                            <button className="r3-cd-confirm" onClick={()=>{ replaceCompSeg(pCompId,pSegIdx,pc); showToast(`已替换为 ${pc.label}`); setPendingCand(null); setCandPrevPlay(false) }}>
                              ✓ 确认替换
                            </button>
                            <button className="r3-cd-cancel" onClick={()=>{setPendingCand(null);setCandPrevPlay(false)}}>取消</button>
                          </div>
                        </>
                      )
                    }

                    return (
                      <>
                        <div className="r3-edit-header">
                          <button className="r3-back-btn" onClick={()=>setEditingSeg(null)}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                            返回
                          </button>
                          <span className="r3-edit-title">片段替换</span>
                          {editComp&&<span className="r3-edit-comp">{editComp.name}</span>}
                        </div>
                        {editSeg&&(
                          <div className="r3-current">
                            <div className="r3-cur-head">当前片段</div>
                            <div className="r3-cur-card">
                              <div className="r3-cur-top">
                                <span className="r3-cur-label" style={{color:tc}}>{editSeg.label}</span>
                                <span className="r3-cur-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{editSeg.type}</span>
                                <span className="r3-cur-src">V{editSeg.videoIndex+1}</span>
                              </div>
                              <div className="r3-cur-time">{editSeg.startStr} – {editSeg.endStr}</div>
                              {editSeg.subtitle&&<div className="r3-cur-sub">{editSeg.subtitle}</div>}
                            </div>
                          </div>
                        )}
                        <div className="r3-rec-section">
                          <div className="r3-sec-head">
                            <span className="r3-sec-title">推荐替换</span>
                            {editSeg&&<span className="r3-sec-hint">{editSeg.type}优先</span>}
                          </div>
                          {recs.length>0?recs.map(cand=>{
                            const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                            return (
                              <div key={cand.id} className="r3-cand-item"
                                onClick={()=>setPendingCand({cand,compId:editingSeg.compId,segIdx:editingSeg.segIdx})}>
                                <div className="r3-cand-top">
                                  <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                                  <span className="r3-cand-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                                  <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                                </div>
                                <div className="r3-cand-time">{cand.startStr} – {cand.endStr}</div>
                                {cand.subtitle&&<div className="r3-cand-sub">{cand.subtitle.slice(0,34)}{cand.subtitle.length>34?'…':''}</div>}
                              </div>
                            )
                          }):(
                            <div className="r3-no-recs">
                              <div>暂无同类型推荐</div>
                              <div className="r3-no-recs-hint">可从下方展开全部候选中选择</div>
                              {adjFallback.length>0&&(
                                <>
                                  <div className="r3-no-recs-sub">同视频相邻片段：</div>
                                  {adjFallback.map(cand=>{
                                    const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                                    return (
                                      <div key={cand.id} className="r3-cand-item"
                                        onClick={()=>setPendingCand({cand,compId:editingSeg.compId,segIdx:editingSeg.segIdx})}>
                                        <div className="r3-cand-top">
                                          <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                                          <span className="r3-cand-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                                        </div>
                                        <div className="r3-cand-time">{cand.startStr} – {cand.endStr}</div>
                                      </div>
                                    )
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="r3-all-section">
                          <button className="r3-all-toggle" onClick={()=>setShowAllCands(p=>({...p,[allCandsKey]:!p[allCandsKey]}))}>
                            {showAllCands[allCandsKey]?'▲ 收起候选':'▼ 展开全部候选'}
                            <span className="r3-all-count">{allCands.length}</span>
                          </button>
                          {showAllCands[allCandsKey]&&(
                            <div className="r3-all-list">
                              {Object.entries(candsByType).map(([type,cands])=>{
                                const ttc=SEG_TYPE_COLORS[type]||'#6366f1'
                                return (
                                  <div key={type} className="r3-type-group">
                                    <div className="r3-type-group-head" style={{color:ttc}}>{type}<span className="r3-type-cnt">({cands.length})</span></div>
                                    {cands.map(cand=>{
                                      const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                                      return (
                                        <div key={cand.id} className="r3-cand-item r3-cand-sm"
                                          onClick={()=>setPendingCand({cand,compId:editingSeg.compId,segIdx:editingSeg.segIdx})}>
                                          <div className="r3-cand-top">
                                            <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                                            <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                                            <span className="r3-cand-time">{cand.startStr}–{cand.endStr}</span>
                                          </div>
                                          {cand.subtitle&&<div className="r3-cand-sub r3-cand-sm-sub">{cand.subtitle.slice(0,28)}{cand.subtitle.length>28?'…':''}</div>}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )
                  })() : (
                    <div className="r3-hint-text">点击下方成品视频行中的片段块，即可在此替换编辑</div>
                  )}
                </aside>
              </div>
              {/* BOTTOM: composition rows */}
              <div className={`s3-comp-section ${tlFlash?'tl-flash':''}`}>
                <div className="s3-comp-head">
                  <div className="s3-comp-head-l">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    <span>成品视频方案</span>
                    {compositions.length>0&&<span className="s3-comp-badge">{compositions.length} 个方案 · {totalSelectedSegs} 个片段</span>}
                  </div>
                  <div className="s3-comp-head-r"/>
                </div>
                {compositions.length===0&&(
                  <div className="s3-comp-empty"><p>未找到可组合的片段，请返回字幕切片步骤勾选更多片段</p></div>
                )}
                <div className="s3-comp-list">
                  {compositions.map(comp=>{
                    const isActive = comp.id === selectedCompId
                    return (
                      <div
                        key={comp.id}
                        className={`comp-row ${isActive?'active':''}`}
                        onClick={()=>{ setSelectedCompId(comp.id) }}
                      >
                        <div className="comp-row-head">
                          <span className={`comp-radio ${isActive?'on':''}`}/>
                          <span className="comp-name">{comp.name}</span>
                          <span className="comp-meta">{fmt(comp.totalDur)}</span>
                          <span className="comp-meta">{comp.segments.length} 片段</span>
                          <span className="comp-meta-segs">{comp.segments.map(s=>s.label).join(' → ')}</span>
                          <button className="comp-regen-btn" onClick={e=>{e.stopPropagation();regenCompRow(comp.id)}}>↻ 重新生成此行</button>
                        </div>
                        <div className="comp-row-body">
                          <div className="comp-row-tl">
                            {comp.segments.map((seg,si)=>{
                              const dur = seg.endSec - seg.startSec
                              const w   = `${comp.totalDur > 0 ? (dur / comp.totalDur) * 100 : (100 / comp.segments.length)}%`
                              const tc  = SEG_TYPE_COLORS[seg.type] || '#6366f1'
                              const isEditingSeg = editingSeg?.compId===comp.id && editingSeg?.segIdx===si
                              const isLocked = (lockedSegs[comp.id]||{})[si]
                              return (
                                <div
                                  key={seg.id+'_'+si}
                                  className={`comp-seg-blk${isEditingSeg?' editing':''}${isLocked?' locked':''}`}
                                  style={{ width:w, background:tc+'cc', borderTop:`2px solid ${tc}` }}
                                  title={`${seg.label} ${seg.type}\n${seg.startStr}–${seg.endStr}\n${seg.subtitle}`}
                                  onClick={e=>{e.stopPropagation();setEditingSeg({compId:comp.id,segIdx:si});setSelectedCompId(comp.id)}}
                                >
                                  <span className="comp-seg-label">{seg.label}</span>
                                  <span className="comp-seg-type">{seg.type}</span>
                                  <span className="comp-seg-dur">{fmt(dur)}</span>
                                  <button
                                    className={`comp-seg-lock${isLocked?' on':''}`}
                                    title={isLocked?'解锁此片段':'锁定此片段'}
                                    onClick={e=>{e.stopPropagation();toggleLockSeg(comp.id,si)}}
                                  >{isLocked?'🔒':'🔓'}</button>
                                </div>
                              )
                            })}
                          </div>
                          <div className="comp-row-seq">
                            <div className="comp-seq-title">组合顺序</div>
                            {comp.segments.map((seg,si)=>{
                              const tc = SEG_TYPE_COLORS[seg.type] || '#6366f1'
                              return (
                                <div key={seg.id+'seq'+si} className="comp-seq-item">
                                  <span className="comp-seq-lbl" style={{color:tc}}>{seg.label}</span>
                                  <span className="comp-seq-type">{seg.type}</span>
                                  <span className="comp-seq-time">{fmt(seg.endSec-seg.startSec)}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3-column workspace + bottom timeline (cut sub-step) */}
          {subStep==='cut'&&<><div className="s2-workspace">

            {/* LEFT: video list + config */}
            <div className="s2-left-panel">
              <div className="s2-left-head">
                <span className="s2-left-title">素材列表</span>
                <span className="s2-left-count">{uploadedVideos.length}</span>
              </div>
              <div className="s2-left-list">
                {uploadedVideos.map((v,vi)=>{
                  const ana=videoAnalysis[v.id]
                  const isActive=v.id===currentVideoId
                  const segs=ana?.segments||[]
                  return (
                    <div key={v.id} className={`s2-vid-item ${isActive?'active':''}`} onClick={()=>setCurrentVideoId(v.id)}>
                      <div className="s2-vid-item-thumb">
                        <video src={v.url} preload="metadata" muted playsInline/>
                        {ana?.status==='analyzing'&&(
                          <div className="s2-vid-item-ana">
                            <div className="s2-vid-item-prog" style={{width:`${ana.progress}%`}}/>
                          </div>
                        )}
                        <span className="s2-vid-item-n">{vi+1}</span>
                        {isActive&&<span className="s2-vid-item-cur">编辑中</span>}
                      </div>
                      <div className="s2-vid-item-body">
                        <div className="s2-vid-item-name" title={v.name}>{v.name.replace(/\.[^.]+$/,'').slice(0,16)}</div>
                        <div className="s2-vid-item-meta">
                          <span>{v.durStr}</span>
                          <span className={`s2-vid-item-st ${ana?.status||'waiting'}`}>
                            {ana?.status==='confirmed'?'✓已确':ana?.status==='done'?'完成':ana?.status==='analyzing'?`${Math.round(ana.progress)}%`:'等待'}
                          </span>
                        </div>
                        {segs.length>0&&(
                          <div className="s2-vid-item-segs">
                            {segs.map((s,si)=>(
                              <span key={s.id} className="s2-vid-item-pip"
                                style={{background:s.selected?(SEG_TYPE_COLORS[s.type]||'#6366f1'):'var(--bdr-hi)',opacity:s.selected?1:0.4}}
                                title={`${vi+1}-${si+1} ${s.type}`}/>
                            ))}
                            <span className="s2-vid-item-seg-cnt">{segs.filter(s=>s.selected).length}/{segs.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {totalSelectedSegs>0&&(
                <div className="s2-left-config">
                  <div className="s2-left-config-head">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                    混剪配置
                    <span className="s2-left-config-cnt">{totalSelectedSegs} 片段</span>
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#6366f1'}}/>视频比例</div>
                    {ratioBlock}
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#8b5cf6'}}/>混剪强度</div>
                    {intensityBlock}
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#ec4899'}}/>去重方式<span className="r-title-count">{dedupSelected}/8</span></div>
                    {dedupBlock}
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#06b6d4'}}/>导出设置</div>
                    <div className="export-grid">
                      <div className="export-row"><span className="export-label">分辨率</span><div className="btn-row">{['720p','1080p'].map(r=><button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={()=>setExportRes(r)}>{r}</button>)}</div></div>
                      <div className="export-row"><span className="export-label">帧率</span><div className="btn-row">{['24fps','30fps','60fps'].map(f=><button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={()=>setExportFps(f)}>{f}</button>)}</div></div>
                    </div>
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#10b981'}}/>音频</div>
                    <div className="settings-col">
                      <div className="setting-row"><span>保留原声</span><Toggle on={keepAudio} onToggle={()=>setKeepAudio(v=>!v)}/></div>
                      <div className="setting-row"><span>背景音乐</span><Toggle on={addMusic} onToggle={()=>setAddMusic(v=>!v)}/></div>
                    </div>
                  </div>
                  <div className="s2-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#f59e0b'}}/>字幕</div>
                    <div className="settings-col">
                      <div className="setting-row"><span>自动字幕</span><Toggle on={autoSub} onToggle={()=>setAutoSub(v=>!v)}/></div>
                      <div className="setting-row"><span>位置</span><select value={subPos} onChange={e=>setSubPos(e.target.value)}><option value="bottom">底部</option><option value="middle">中部</option><option value="top">顶部</option></select></div>
                    </div>
                  </div>
                  {isGenerated&&(
                    <div className="s2s-result-card">
                      <div className="s2s-result-check"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>
                      <div className="s2s-result-info">
                        <span className="s2s-result-title">方案已生成 · {compositions.length} 个</span>
                        <span className="s2s-result-sub">{totalSelectedSegs} 片段</span>
                      </div>
                      <button className="s2s-regen-btn" onClick={handleGenerate}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                        重新
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CENTER: large video player */}
            <div className="s2-center-panel">
              <div className="s2-video-area">
                {editorVid&&['done','confirmed'].includes(editorAnalysis?.status)&&(
                  <video
                    ref={editorVideoRef} key={currentVideoId}
                    src={editorVid.url} className="s2-video-el"
                    preload="auto" playsInline
                    onTimeUpdate={()=>{
                      if(editorVideoRef.current){
                        const t=editorVideoRef.current.currentTime
                        setEditorTime(t)
                        if(playingSegEnd!==null && t>=playingSegEnd){ setEditorPlaying(false); setPlayingSegEnd(null) }
                      }
                    }}
                    onEnded={()=>setEditorPlaying(false)}
                  />
                )}
                {!editorVid&&(
                  <div className="s2-vid-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                    <span>从左侧选择视频开始编辑</span>
                  </div>
                )}
                {editorVid&&editorAnalysis?.status==='waiting'&&(
                  <div className="s2-vid-overlay">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>等待分析中…</span>
                  </div>
                )}
                {editorVid&&editorAnalysis?.status==='analyzing'&&(
                  <div className="s2-vid-overlay">
                    <span className="s2-vid-analyzing-pct">{Math.round(editorAnalysis.progress)}%</span>
                    <span>正在识别字幕与分段…</span>
                    <div className="s2-vid-ana-bar"><div className="s2-vid-ana-bar-fill" style={{width:`${editorAnalysis.progress}%`}}/></div>
                  </div>
                )}
                {editorVid&&['done','confirmed'].includes(editorAnalysis?.status)&&(
                  <div className="s2-vid-hud">
                    <span className="s2-vid-timecode">{fmtMs(editorTime)}</span>
                    {editorAnalysis?.status==='confirmed'&&<span className="s2-vid-confirmed-badge">✓ 已确认</span>}
                  </div>
                )}
                {currentSubIdx>=0&&editorSubtitles[currentSubIdx]&&(
                  <div className="s2-vid-sub-overlay">{editorSubtitles[currentSubIdx].text}</div>
                )}
                {editorVid&&['done','confirmed'].includes(editorAnalysis?.status)&&(
                  <button
                    className={`s2-vid-big-play${editorPlaying?' playing':''}`}
                    onClick={()=>{ setEditorPlaying(p=>{ if(p) setPlayingSegEnd(null); return !p }) }}
                    title={editorPlaying?'暂停':'播放'}
                  >
                    {editorPlaying
                      ? <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                    }
                  </button>
                )}
              </div>

              <div className="s2-player-ctrl">
                <button
                  className="s2-play-btn"
                  onClick={()=>{ setEditorPlaying(p=>{ if(p) setPlayingSegEnd(null); return !p }) }}
                  disabled={!editorVid||!['done','confirmed'].includes(editorAnalysis?.status)}
                >
                  {editorPlaying
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  }
                </button>
                <div
                  ref={scrubberRef}
                  className="s2-scrubber"
                  onMouseDown={e=>{
                    e.preventDefault()
                    const r=e.currentTarget.getBoundingClientRect()
                    handleEditorSeek(((e.clientX-r.left)/r.width)*(editorVid?.dur||0))
                    scrubDragRef.current=true
                    document.body.style.userSelect='none'
                  }}
                >
                  <div className="s2-scrub-fill" style={{width:editorVid?.dur>0?pctOf(editorTime,editorVid.dur):'0%'}}/>
                  <div className="s2-scrub-thumb" style={{left:editorVid?.dur>0?pctOf(editorTime,editorVid.dur):'0%'}}/>
                </div>
                <span className="s2-time-disp">{fmtMs(editorTime)} / {editorVid?fmt(editorVid.dur):'--:--'}</span>
                <button
                  className="s2-add-cut-btn"
                  onClick={addCutAtCurrentTime}
                  disabled={!editorVid||!['done','confirmed'].includes(editorAnalysis?.status)}
                  title="在当前播放时间点新增切割"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  切割
                </button>
              </div>

              <div className="s2-vid-info">
                {editorVid?(
                  <>
                    <span className="s2-vid-info-num">V{editorVidIdx+1}</span>
                    <span className="s2-vid-info-name" title={editorVid.name}>{editorVid.name}</span>
                    {editorVid.res!=='—'&&<span className="s2-vid-info-tag">{editorVid.res}</span>}
                    <span className="s2-vid-info-tag">{editorVid.durStr}</span>
                    <span className="s2-vid-info-tag">{editorVid.sizeStr}</span>
                  </>
                ):<span className="s2-vid-info-none">未选择视频</span>}
              </div>
            </div>

            {/* RIGHT: subtitle list */}
            <div className="s2-right-panel">
              <div className="s2-right-head">
                <span className="s2-right-title">字幕列表</span>
                {editorSubtitles.length>0&&<span className="s2-right-count">{editorSubtitles.length} 条</span>}
                {editorVidIdx>=0&&<span className="s2-right-vidnum">V{editorVidIdx+1}</span>}
              </div>
              <div className="s2-sub-list">
                {!editorVid&&<div className="s2-sub-empty">从左侧选择视频</div>}
                {editorVid&&editorAnalysis?.status==='waiting'&&<div className="s2-sub-empty"><span className="s2s-pulse" style={{display:'inline-block',marginRight:6}}/>等待分析…</div>}
                {editorVid&&editorAnalysis?.status==='analyzing'&&<div className="s2-sub-empty"><span className="s2s-pulse" style={{display:'inline-block',marginRight:6}}/>字幕识别中…</div>}
                {editorSubtitles.map((sub,si)=>{
                  const isCurrent=currentSubIdx===si
                  const isSelected=selectedSubIdx===si
                  const segIdx=editorSegs.findIndex(s=>sub.startSec>=s.startSec&&sub.startSec<s.endSec)
                  const segTc=segIdx>=0?(SEG_TYPE_COLORS[editorSegs[segIdx].type]||'#6366f1'):'var(--txt-3)'
                  return (
                    <div
                      key={sub.id}
                      className={`s2-sub-row ${isCurrent?'current':''} ${isSelected?'selected':''}`}
                      onClick={()=>{ setSelectedSubIdx(si); handleEditorSeek(sub.startSec) }}
                    >
                      <span className="s2-sub-time">{fmt(sub.startSec)}</span>
                      <div className="s2-sub-body">
                        <span className="s2-sub-text">{sub.text}</span>
                        {segIdx>=0&&(
                          <span className="s2-sub-seg" style={{color:segTc}}>
                            {editorVidIdx>=0?editorVidIdx+1:'?'}-{segIdx+1}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              {editorSegs.length>0&&(
                <div className="s2-right-footer">
                  <button
                    className={`s2-confirm-vid-btn ${editorAnalysis?.status==='confirmed'?'confirmed':''}`}
                    onClick={()=>handleConfirmVideo(currentVideoId)}
                  >
                    {editorAnalysis?.status==='confirmed'?'✓ 已确认此视频分段':'确认此视频分段'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM: segment timeline */}
          <div className="s2-bottom-tl">

            <div className="s2-tl-head">
              <span className="s2-tl-title">
                分段时间轴
                {selectedCutIdx!==null&&editorSegs[selectedCutIdx]&&(
                  <span className="s2-cut-sel-info"> · 切割点 @ {fmt(editorSegs[selectedCutIdx]?.endSec)}</span>
                )}
              </span>
              {selectedCutIdx!==null?(
                <div className="s2-cut-adj">
                  <button className="s2-cut-adj-btn" onClick={()=>adjustCutPoint(selectedCutIdx,-0.5)}>◀ -0.5s</button>
                  <button className="s2-cut-adj-btn" onClick={()=>adjustCutPoint(selectedCutIdx,+0.5)}>+0.5s ▶</button>
                  <button className="s2-cut-adj-btn s2-cut-del-btn" onClick={()=>{ mergeSegs(selectedCutIdx); setSelectedCutIdx(null) }}>删除切点</button>
                  <button className="s2-cut-adj-btn" onClick={()=>setSelectedCutIdx(null)}>取消</button>
                </div>
              ):(
                <span className="s2-tl-hint">点击切割线选中 · 点击轨道跳转 · 片段编号：视频号-片段号</span>
              )}
              <button
                className="s2-add-cut-btn"
                style={{marginLeft:selectedCutIdx===null?'auto':'8px',flexShrink:0}}
                onClick={addCutAtCurrentTime}
                disabled={!editorVid||!['done','confirmed'].includes(editorAnalysis?.status)}
                title="在当前播放时间点新增切割"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                切割
              </button>
            </div>
            <CutTimeline
              segs={editorSegs}
              duration={editorVid?.dur||0}
              currentTime={editorTime}
              selectedCutIdx={selectedCutIdx}
              onSeek={handleEditorSeek}
              onSelectCut={setSelectedCutIdx}
              vidNum={editorVidIdx}
              selectedSegIdx={selectedSegIdx}
              onSelectSeg={(i)=>{ setSelectedSegIdx(i); handleEditorSeek(editorSegs[i]?.startSec||0) }}
            />
            <div className="s2-seg-strip">
              {!editorVid&&<div className="s2-seg-strip-empty">从左侧选择视频以显示分段</div>}
              {editorVid&&editorAnalysis?.status==='analyzing'&&<div className="s2-seg-strip-empty">字幕识别中… {Math.round(editorAnalysis.progress)}%</div>}
              {editorVid&&editorAnalysis?.status==='waiting'&&<div className="s2-seg-strip-empty">等待分析…</div>}
              {editorSegs.map((seg,i)=>{
                const tc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
                const segLabel=`${editorVidIdx>=0?editorVidIdx+1:'?'}-${i+1}`
                const segSubs=getSubtitlesForSeg(seg,editorSubtitles)
                const isActive=selectedSegIdx===i
                return (
                  <div
                    key={seg.id}
                    className={`s2-seg-card ${isActive?'active':''} ${seg.selected?'sel':''}`}
                    style={{'--seg-tc':tc}}
                    onClick={()=>{ setSelectedSegIdx(i); handleEditorSeek(seg.startSec) }}
                  >
                    <div className="s2-seg-card-head">
                      <span className="s2-seg-card-num" style={{color:tc}}>{segLabel}</span>
                      <span className="s2-seg-card-type" style={{color:tc,borderColor:tc+'55',background:tc+'18'}}>{seg.type}</span>
                      <label className="s2-seg-card-sel" onClick={e=>e.stopPropagation()}>
                        <input type="checkbox" checked={seg.selected} onChange={()=>toggleEditorSeg(i)} style={{accentColor:tc}}/>
                        混
                      </label>
                    </div>
                    <div className="s2-seg-card-time">{seg.startStr} – {seg.endStr}</div>
                    {(()=>{
                      const isExp=!!expandedSegs[seg.id]
                      const displaySubs=segSubs.length>0?segSubs:[{id:'nosub',text:seg.subtitle||'—'}]
                      const needsExpand=displaySubs.length>2||displaySubs.some(s=>s.text.length>20)
                      const shown=(!needsExpand||isExp)?displaySubs:displaySubs.slice(0,2)
                      return (
                        <div className="s2-seg-card-subs">
                          {shown.map((s,si)=>(
                            <div key={s.id||si} className="s2-seg-card-sub">{s.text}</div>
                          ))}
                          {needsExpand&&(
                            <button className="s2-seg-card-expand" onClick={e=>{e.stopPropagation();setExpandedSegs(p=>({...p,[seg.id]:!p[seg.id]}))}}>
                              {isExp?'▲ 收起':`▼ 展开 +${displaySubs.length-2} 条`}
                            </button>
                          )}
                        </div>
                      )
                    })()}
                    <div className="s2-seg-card-acts">
                      {(()=>{ const playing=editorPlaying&&editorTime>=seg.startSec&&editorTime<seg.endSec; return (
                        <button className="s2-seg-act" onClick={e=>{e.stopPropagation(); if(playing){setEditorPlaying(false);setPlayingSegEnd(null)}else{handleEditorSeek(seg.startSec);setEditorPlaying(true);setPlayingSegEnd(seg.endSec)}}}>
                          {playing?'⏸':'▶'}
                        </button>
                      )})()}
                      {i>0&&<button className="s2-seg-act" onClick={e=>{ e.stopPropagation(); mergeSegs(i-1) }}>←并</button>}
                      {i<editorSegs.length-1&&<button className="s2-seg-act" onClick={e=>{ e.stopPropagation(); mergeSegs(i) }}>并→</button>}
                      <button className="s2-seg-act s2-seg-act-split" onClick={e=>{ e.stopPropagation(); splitSegAtMiddle(i) }}>拆</button>
                      <select className="s2-seg-type-sel" value={seg.type}
                        onChange={e=>{ e.stopPropagation(); changeSegType(i,e.target.value) }}
                        onClick={e=>e.stopPropagation()} style={{color:tc}}>
                        {ALL_SEG_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          </div></>}

          {/* footer */}
          <div className="step-footer">
            <button className="step-back-btn" onClick={()=>{ if(subStep==='compose'){setSubStep('cut')}else{setStep(1)} }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              {subStep==='compose'?'返回切片配置':'返回素材准备'}
            </button>
            {subStep==='cut'&&!isGenerated&&(
              <button
                className={`step-next-btn s2s-gen-btn ${totalSelectedSegs===0?'disabled':''}`}
                onClick={()=>totalSelectedSegs===0?showToast('请先勾选要参与混剪的片段'):handleGenerate()}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                确认片段，生成混剪方案
                {totalSelectedSegs>0&&<span className="s2s-gen-count">{totalSelectedSegs}</span>}
              </button>
            )}
            {subStep==='cut'&&isGenerated&&(
              <button className="step-next-btn" onClick={()=>setSubStep('compose')}>
                查看组合方案
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
            {subStep==='compose'&&(
              <button className="step-next-btn" onClick={()=>setStep(3)}>
                确认方案，进入预览导出
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══ STEP 3: 预览导出 */}
      {step===3&&(
        <div className="step3">
          <div className="main">

            {/* LEFT: material list */}
            <aside className="panel-l">
              <div className="s3-mat-header">
                <span className="s3-mat-title">参与混剪素材</span>
                <span className="s3-mat-count">{(usedVideos.length||uploadedVideos.length)} 个</span>
              </div>
              <div className="s3-mat-list">
                {(usedVideos.length>0?usedVideos:uploadedVideos).map((v,vi)=>(
                  <div key={v.id} className="s3-mat-item" onClick={()=>setPreviewVid(v)}>
                    <div className="s3-mat-thumb"><video src={v.url} preload="metadata" muted playsInline/></div>
                    <div className="s3-mat-info">
                      <div className="s3-mat-name">V{vi+1} · {v.name.replace(/\.[^.]+$/,'').slice(0,18)}</div>
                      <div className="s3-mat-meta">
                        {v.durStr} · {v.sizeStr}
                        {videoAnalysis[v.id]?.segments&&<span> · {videoAnalysis[v.id].segments.filter(s=>s.selected).length}片</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="s3-mat-footer">
                <button className="s3-back-link" onClick={()=>{ setPlaying(false); setSubStep('cut'); setStep(2) }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                  返回分段配置
                </button>
              </div>
            </aside>

            {/* CENTER: preview */}
            <main className="panel-c">
              <div className="preview-wrap">
                <div className={`preview-screen r-${ratio.replace(':','-')}`}>
                  <div className="monitor-corners"><span className="mc tl"/><span className="mc tr"/><span className="mc bl"/><span className="mc br"/></div>
                  <div className="preview-hud-top">
                    <span className="preview-timecode">{fmtMs(currentTime)}</span>
                    {isPlaying&&<span className="preview-rec"><span className="rec-dot"/>REC</span>}
                    {selectedComp&&<span className="preview-scene-badge">{selectedComp.name}</span>}
                    <span className="preview-ratio-tag">{ratio}</span>
                  </div>
                  {isGenerated&&currentScene&&!currentScene.isEnd&&<div className="preview-scene-info"><span className="scene-label">SCENE {currentScene.num} / 4</span><span className="scene-clip">{currentScene.name}</span></div>}
                  {selectedVideo&&!isGenerated&&(
                    <video ref={videoRef} key={selectedVideo.id} src={selectedVideo.url} className="preview-video" preload="auto" playsInline
                      onTimeUpdate={()=>{ if(videoRef.current) setCurrent(videoRef.current.currentTime) }}
                      onEnded={()=>{ setPlaying(false); setCurrent(0) }}/>
                  )}
                  <div className="preview-bg" style={isGenerated&&currentScene?{background:currentScene.bg,transition:'background 0.6s ease'}:{}}/>
                  <div className="preview-scanlines"/>
                  {isGenerated&&currentScene?.isEnd&&(
                    <div className="preview-end-card">
                      <div className="end-card-scissors">✂</div><div className="end-card-brand">品牌名称</div>
                      <div className="end-card-sub">@用户名 · 更多精彩内容</div><div className="end-card-line"/><div className="end-card-tag">END</div>
                    </div>
                  )}
                  <div className="preview-center-state">
                    {!isGenerated&&<div className="preview-idle"><div className="preview-idle-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div><p>请返回第二步生成混剪方案</p></div>}
                    {isGenerated&&!currentScene?.isEnd&&<div className="preview-film-grain"/>}
                  </div>
                  {isGenerated&&<div className="preview-storyboard">{SCENES.map(s=><div key={s.num} className={`preview-sb-seg ${currentScene?.num===s.num?'active':''}`} style={{flex:s.end-s.start,background:s.color}}/>)}</div>}
                  {isGenerated&&currentSubText&&<div className={`preview-sub-demo sub-style-${subStyle} sub-pos-${subPos} ${subStroke?'sub-stroke':''}`}>{currentSubText}</div>}
                  {isGenerated&&!currentSubText&&!currentScene?.isEnd&&<div className={`preview-sub-demo sub-style-${subStyle} sub-pos-${subPos} ${subStroke?'sub-stroke':''} sub-placeholder`}>·  ·  ·</div>}
                  <div className="preview-safe-line"/>
                </div>
              </div>

              <div className="controls-bar">
                <div className="ctrl-left">
                  <button className="ctrl-btn" onClick={()=>handleSeek(0)}>⏮</button>
                  <button className="play-btn" onClick={()=>setPlaying(p=>!p)} disabled={!isGenerated}>
                    {isPlaying?<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>:<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>}
                  </button>
                  <button className="ctrl-btn" onClick={()=>handleSeek(effectiveDuration)}>⏭</button>
                </div>
                <div className="ctrl-time">
                  <span className="time-cur">{fmtMs(currentTime)}</span>
                  <div className="prog-wrap">
                    <div className="prog-track" onClick={e=>{ const r=e.currentTarget.getBoundingClientRect(); handleSeek(((e.clientX-r.left)/r.width)*effectiveDuration) }}>
                      <div className="prog-fill" style={{width:effectiveDuration>0?`${(currentTime/effectiveDuration)*100}%`:'0%'}}/>
                      {isGenerated&&SCENES.map(s=><div key={s.num} className="prog-scene-marker" style={{left:`${(s.start/TOTAL)*100}%`,background:s.color}}/>)}
                      <div className="prog-thumb" style={{left:effectiveDuration>0?`${(currentTime/effectiveDuration)*100}%`:'0%'}}/>
                    </div>
                  </div>
                  <span className="time-tot">{effectiveDuration>0?fmt(effectiveDuration):'--:--'}</span>
                </div>
                <div className="ctrl-right">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt-3)" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                  <input type="range" min="0" max="100" defaultValue="80" className="vol-slider"/>
                </div>
              </div>

              <div className="action-row">
                <button className="btn-ghost" onClick={()=>{ setPlaying(false); setSubStep('cut'); setStep(2) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  重新配置
                </button>
                <button className="btn-ghost" onClick={()=>{ if(!isGenerated) showToast('请先生成混剪方案'); else setPlaying(true) }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  预览效果
                </button>
                <button className="btn-export" style={{flex:1}} onClick={()=>handleExportOpen(selectedComp?.name)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  {selectedComp ? `导出 ${selectedComp.name}` : '导出视频'}
                </button>
              </div>
            </main>

            {/* RIGHT: plan summary / segment edit panel */}
            <aside className="panel-r">
              {editingSeg ? (()=>{
                const editComp=compositions.find(c=>c.id===editingSeg.compId)
                const editSeg=editComp?.segments[editingSeg.segIdx]
                const tc=editSeg?(SEG_TYPE_COLORS[editSeg.type]||'#6366f1'):'#6366f1'
                const allCandsKey=`${editingSeg.compId}_${editingSeg.segIdx}`
                const compSegIds=new Set((editComp?.segments||[]).filter((_,i)=>i!==editingSeg.segIdx).map(s=>s.id))
                const recs=editSeg?[
                  ...allSelectedSegs.filter(c=>c.type===editSeg.type&&c.id!==editSeg.id&&!compSegIds.has(c.id)&&c.videoIndex!==editSeg.videoIndex),
                  ...allSelectedSegs.filter(c=>c.type===editSeg.type&&c.id!==editSeg.id&&!compSegIds.has(c.id)&&c.videoIndex===editSeg.videoIndex),
                ].slice(0,5):[]
                const allCands=editSeg?allSelectedSegs.filter(c=>c.id!==editSeg.id&&!compSegIds.has(c.id)):[]
                const candsByType=allCands.reduce((g,c)=>{(g[c.type]=g[c.type]||[]).push(c);return g},{})
                return (
                  <>
                    <div className="r3-edit-header">
                      <button className="r3-back-btn" onClick={()=>setEditingSeg(null)}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        返回
                      </button>
                      <span className="r3-edit-title">片段替换</span>
                      {editComp&&<span className="r3-edit-comp">{editComp.name}</span>}
                    </div>
                    {editSeg&&(
                      <div className="r3-current">
                        <div className="r3-cur-head">当前片段</div>
                        <div className="r3-cur-card">
                          <div className="r3-cur-top">
                            <span className="r3-cur-label" style={{color:tc}}>{editSeg.label}</span>
                            <span className="r3-cur-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{editSeg.type}</span>
                            <span className="r3-cur-src">V{editSeg.videoIndex+1}</span>
                          </div>
                          <div className="r3-cur-time">{editSeg.startStr} – {editSeg.endStr}</div>
                          {editSeg.subtitle&&<div className="r3-cur-sub">{editSeg.subtitle}</div>}
                        </div>
                      </div>
                    )}
                    <div className="r3-rec-section">
                      <div className="r3-sec-head">
                        <span className="r3-sec-title">推荐替换</span>
                        {editSeg&&<span className="r3-sec-hint">{editSeg.type}优先</span>}
                      </div>
                      {recs.length>0?recs.map(cand=>{
                        const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                        return (
                          <div key={cand.id} className="r3-cand-item"
                            onClick={()=>{ replaceCompSeg(editingSeg.compId,editingSeg.segIdx,cand); showToast(`已替换为 ${cand.label}`) }}>
                            <div className="r3-cand-top">
                              <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                              <span className="r3-cand-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                              <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                            </div>
                            <div className="r3-cand-time">{cand.startStr} – {cand.endStr}</div>
                            {cand.subtitle&&<div className="r3-cand-sub">{cand.subtitle.slice(0,34)}{cand.subtitle.length>34?'…':''}</div>}
                          </div>
                        )
                      }):<div className="r3-no-recs">无同类型推荐片段</div>}
                    </div>
                    <div className="r3-all-section">
                      <button className="r3-all-toggle" onClick={()=>setShowAllCands(p=>({...p,[allCandsKey]:!p[allCandsKey]}))}>
                        {showAllCands[allCandsKey]?'▲ 收起候选':'▼ 展开全部候选'}
                        <span className="r3-all-count">{allCands.length}</span>
                      </button>
                      {showAllCands[allCandsKey]&&(
                        <div className="r3-all-list">
                          {Object.entries(candsByType).map(([type,cands])=>{
                            const ttc=SEG_TYPE_COLORS[type]||'#6366f1'
                            return (
                              <div key={type} className="r3-type-group">
                                <div className="r3-type-group-head" style={{color:ttc}}>{type}<span>({cands.length})</span></div>
                                {cands.map(cand=>{
                                  const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                                  return (
                                    <div key={cand.id} className="r3-cand-item r3-cand-sm"
                                      onClick={()=>{ replaceCompSeg(editingSeg.compId,editingSeg.segIdx,cand); showToast(`已替换为 ${cand.label}`) }}>
                                      <div className="r3-cand-top">
                                        <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                                        <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                                        <span className="r3-cand-time">{cand.startStr}–{cand.endStr}</span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )
              })() : (
                <>
                  <div className="r-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#22c55e'}}/>方案摘要</div>
                    <div className="settings-col">
                      {[
                        ['字幕分段', isGenerated?'已确认':'待确认'],
                        ['参与视频', `${usedVideos.length||uploadedVideos.length} 个`],
                        ['混剪片段', isGenerated?`${totalSelectedSegs} 个`:'—'],
                        ['成品方案', isGenerated?`${compositions.length} 个`:'—'],
                        ['视频比例', ratio],
                        ['混剪强度', {light:'轻度混剪',medium:'中度混剪',strong:'强力混剪'}[intensity]],
                        ['去重方式', `${dedupSelected} 项已启用`],
                      ].map(([k,v])=>(
                        <div key={k} className="s3-plan-row"><span>{k}</span><span className="s3-plan-val">{v}</span></div>
                      ))}
                    </div>
                  </div>
                  {isGenerated&&enabledDedupKeys.length>0&&(
                    <div className="r-section">
                      <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#ec4899'}}/>已应用去重<span className="plan-fresh-badge">NEW</span></div>
                      <div className="plan-dedup-list">
                        {enabledDedupKeys.map(k=>(
                          <div key={k} className="plan-dedup-row">
                            <span className="plan-check">✓</span><span className="plan-dedup-ico">{DEDUP_META[k].ico}</span>
                            <div className="plan-dedup-info"><span className="plan-dedup-name">{DEDUP_META[k].label}</span><span className="plan-dedup-desc">{DEDUP_META[k].desc}</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="r-section">
                    <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#06b6d4'}}/>导出设置</div>
                    <div className="export-grid">
                      <div className="export-row"><span className="export-label">格式</span><button className="opt-btn active">MP4</button></div>
                      <div className="export-row"><span className="export-label">分辨率</span><div className="btn-row">{['720p','1080p'].map(r=><button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={()=>setExportRes(r)}>{r}</button>)}</div></div>
                      <div className="export-row"><span className="export-label">帧率</span><div className="btn-row">{['24fps','30fps','60fps'].map(f=><button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={()=>setExportFps(f)}>{f}</button>)}</div></div>
                    </div>
                  </div>
                  {selectedComp&&(
                    <div className="r-section">
                      <div className="r-section-title"><span className="r-title-dot" style={{'--dot-c':'#818cf8'}}/>当前预览方案</div>
                      <div className="settings-col">
                        <div className="s3-plan-row"><span>名称</span><span className="s3-plan-val">{selectedComp.name}</span></div>
                        <div className="s3-plan-row"><span>片段数</span><span className="s3-plan-val">{selectedComp.segments.length} 个</span></div>
                        <div className="s3-plan-row"><span>素材时长</span><span className="s3-plan-val">{fmt(selectedComp.totalDur)}</span></div>
                      </div>
                    </div>
                  )}
                  <div className="r-section">
                    <div className="r3-hint-text">点击下方成品视频行中的片段块，即可在此替换编辑</div>
                  </div>
                </>
              )}
            </aside>
          </div>

          {/* ══ Composition rows (replaces old NLE timeline) */}
          <div className={`s3-comp-section ${tlFlash?'tl-flash':''}`}>
            <div className="s3-comp-head">
              <div className="s3-comp-head-l">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                <span>成品视频方案</span>
                {compositions.length>0&&<span className="s3-comp-badge">{compositions.length} 个方案 · {totalSelectedSegs} 个片段</span>}
              </div>
              <div className="s3-comp-head-r">
                {compositions.length>0&&(
                  <button className="s3-batch-export-btn" onClick={()=>showToast('批量导出将在后续版本接入，当前为原型模拟')}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    批量导出全部
                  </button>
                )}
              </div>
            </div>

            {!isGenerated&&(
              <div className="s3-comp-empty">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <p>请先返回第二步勾选片段并生成混剪方案</p>
              </div>
            )}

            {isGenerated&&compositions.length===0&&(
              <div className="s3-comp-empty"><p>未找到可组合的片段，请返回第二步勾选更多片段</p></div>
            )}

            <div className="s3-comp-list">
              {compositions.map(comp=>{
                const isActive = comp.id === selectedCompId
                const maxDur   = compositions.reduce((m,c)=>Math.max(m,c.totalDur),0) || 1
                return (
                  <div
                    key={comp.id}
                    className={`comp-row ${isActive?'active':''}`}
                    onClick={()=>{ setSelectedCompId(comp.id); setPlaying(false); setCurrent(0) }}
                  >
                    {/* row header */}
                    <div className="comp-row-head">
                      <span className={`comp-radio ${isActive?'on':''}`}/>
                      <span className="comp-name">{comp.name}</span>
                      <span className="comp-meta">{fmt(comp.totalDur)}</span>
                      <span className="comp-meta">{comp.segments.length} 片段</span>
                      <span className="comp-meta-segs">{comp.segments.map(s=>s.label).join(' → ')}</span>
                      <button className="comp-regen-btn" onClick={e=>{e.stopPropagation();regenCompRow(comp.id)}}>↻ 重新生成此行</button>
                      <button className="comp-act-btn" onClick={e=>{e.stopPropagation();setSelectedCompId(comp.id);setPlaying(true);setCurrent(0)}}>▶ 预览</button>
                      <button className="comp-act-btn comp-export-btn" onClick={e=>{e.stopPropagation();handleExportOpen(comp.name)}}>⬇ 导出</button>
                    </div>

                    {/* row body: timeline + sequence */}
                    <div className="comp-row-body">
                      {/* proportional segment timeline */}
                      <div className="comp-row-tl">
                        {comp.segments.map((seg,si)=>{
                          const dur = seg.endSec - seg.startSec
                          const w   = `${comp.totalDur > 0 ? (dur / comp.totalDur) * 100 : (100 / comp.segments.length)}%`
                          const tc  = SEG_TYPE_COLORS[seg.type] || '#6366f1'
                          const isEditingSeg = editingSeg?.compId===comp.id && editingSeg?.segIdx===si
                          const isLocked = (lockedSegs[comp.id]||{})[si]
                          return (
                            <div
                              key={seg.id+'_'+si}
                              className={`comp-seg-blk${isEditingSeg?' editing':''}${isLocked?' locked':''}`}
                              style={{ width:w, background:tc+'cc', borderTop:`2px solid ${tc}` }}
                              title={`${seg.label} ${seg.type}\n${seg.startStr}–${seg.endStr}\n${seg.subtitle}`}
                              onClick={e=>{e.stopPropagation();setEditingSeg({compId:comp.id,segIdx:si});setSelectedCompId(comp.id)}}
                            >
                              <span className="comp-seg-label">{seg.label}</span>
                              <span className="comp-seg-type">{seg.type}</span>
                              <span className="comp-seg-dur">{fmt(dur)}</span>
                              <button
                                className={`comp-seg-lock${isLocked?' on':''}`}
                                title={isLocked?'解锁此片段':'锁定此片段'}
                                onClick={e=>{e.stopPropagation();toggleLockSeg(comp.id,si)}}
                              >{isLocked?'🔒':'🔓'}</button>
                            </div>
                          )
                        })}
                      </div>

                      {/* sequence list */}
                      <div className="comp-row-seq">
                        <div className="comp-seq-title">组合顺序</div>
                        {comp.segments.map((seg,si)=>{
                          const tc = SEG_TYPE_COLORS[seg.type] || '#6366f1'
                          return (
                            <div key={seg.id+'seq'+si} className="comp-seq-item">
                              <span className="comp-seq-lbl" style={{color:tc}}>{seg.label}</span>
                              <span className="comp-seq-type">{seg.type}</span>
                              <span className="comp-seq-time">{fmt(seg.endSec-seg.startSec)}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
