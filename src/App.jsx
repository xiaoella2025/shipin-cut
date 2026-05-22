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

const REFINE_MARK_TYPES = [
  {key:'cut_short',      label:'需要剪短',  color:'#f59e0b'},
  {key:'remove',         label:'这段不要',  color:'#ef4444'},
  {key:'slow_pacing',    label:'节奏太慢',  color:'#8b5cf6'},
  {key:'bad_transition', label:'衔接不顺',  color:'#ec4899'},
  {key:'keep',           label:'保留',      color:'#10b981'},
]

const SUBTITLE_PROMPTS = [
  { key:'polish',    label:'字幕润色',    text:'请帮我润色以下短视频口播字幕，要求：\n1. 保持口语化、自然流畅\n2. 适合短视频节奏，每句不超过 20 字\n3. 不改变核心意思，如有重复可适当删减\n\n字幕内容如下：\n' },
  { key:'pace',      label:'保持口播节奏', text:'请把以下字幕改写成适合短视频口播的稿子，要求：\n1. 每句话简短有力\n2. 语气轻松自然，适合快节奏视频\n3. 保持原内容核心，不要添加无关内容\n\n字幕内容如下：\n' },
  { key:'shorten',   label:'缩短口播',    text:'请帮我把以下字幕压缩，要求：\n1. 删除重复内容和过渡语句\n2. 保留核心信息\n3. 整体缩短 20–30%，保持口语化风格\n\n字幕内容如下：\n' },
  { key:'natural',   label:'更生活化',    text:'请把以下字幕改得更像真人在说话，要求：\n1. 加入口语化表达\n2. 语气更亲切自然，可适当加入语气词\n3. 减少书面化表达\n\n字幕内容如下：\n' },
  { key:'voiceover', label:'生成配音稿',  text:'请根据以下字幕生成适合文字转语音（TTS）的配音稿，要求：\n1. 语句流畅，适合朗读\n2. 避免特殊符号，每句控制在 15–20 字以内\n3. 适合标准普通话朗读\n\n字幕内容如下：\n' },
]

const COPY_TASKS = [
  { key:'referenceTitle',      label:'对标标题',       placeholder:'粘贴对标视频的标题，供 AI 参考改写...' },
  { key:'finalTitle',          label:'我的标题',        placeholder:'粘贴 AI 改写好的标题，或直接填写...' },
  { key:'referenceWechatBody', label:'对标公众号正文',   placeholder:'粘贴对标公众号文章正文，供 AI 参考改写...' },
  { key:'finalWechatBody',     label:'我的公众号正文',   placeholder:'粘贴 AI 改写好的公众号正文...' },
  { key:'referenceXhs',        label:'对标小红书正文',   placeholder:'粘贴对标小红书笔记正文，供 AI 参考...' },
  { key:'finalXhs',            label:'我的小红书正文',   placeholder:'粘贴 AI 改写好的小红书正文...' },
]

const COPY_PROMPT_MAP = {
  finalTitle: '请参考下方【对标标题】，结合【我的字幕】，生成 5 个适合短视频平台的标题，要求：\n1. 有吸引力，能引发点击\n2. 15 字以内，不夸张不虚假\n3. 保留对标标题的情绪和结构，但替换成我的内容\n\n【对标标题】\n（请在此处粘贴对标标题）\n\n【我的字幕】\n',
  finalWechatBody: '请参考下方【对标公众号正文】的结构和风格，结合【我的字幕】，生成一篇公众号文章，要求：\n1. 保留对标文章的情绪和卖点，但替换成我的视频内容，不要照抄\n2. 有标题、导语、正文、结尾\n3. 500–800 字，适合图文排版\n\n【对标公众号正文】\n（请在此处粘贴对标正文）\n\n【我的字幕】\n',
  finalXhs: '请参考下方【对标小红书正文】的风格，结合【我的字幕】，生成一篇小红书笔记，要求：\n1. 保留对标文案的情绪和卖点，但替换成我的内容，不要照抄\n2. 语气活泼，适合小红书\n3. 多用分段，加入合适 emoji\n4. 结尾加话题标签建议（3–5 个）\n\n【对标小红书正文】\n（请在此处粘贴对标正文）\n\n【我的字幕】\n',
  referenceTitle: null,
  referenceWechatBody: null,
  referenceXhs: null,
}

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

function getEffectiveDur(seg, usage) {
  const nat = seg.endSec - seg.startSec
  if (!usage || usage.mode === 'full') return nat
  return Math.min(usage.secs || 3, nat)
}

function getUsageLabel(usage) {
  if (!usage || usage.mode === 'full') return '全段'
  const labels = { head: '片头', mid: '中间', tail: '片尾', custom: '自定义' }
  return `${labels[usage.mode] || usage.mode} ${usage.secs || 3}s`
}

function findSegAtPos(comp, posSec) {
  let acc = 0
  for (let i = 0; i < comp.segments.length; i++) {
    const dur = comp.segments[i].endSec - comp.segments[i].startSec
    if (posSec < acc + dur) return i
    acc += dur
  }
  return comp.segments.length - 1
}

function snapToSegBoundary(comp, posSec) {
  if (!comp) return posSec
  const SNAP_SEC = 1.0
  let acc = 0
  const boundaries = [0]
  for (const seg of comp.segments) {
    acc += seg.endSec - seg.startSec
    boundaries.push(acc)
  }
  for (const b of boundaries) {
    if (Math.abs(posSec - b) < SNAP_SEC) return b
  }
  return posSec
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

// Build segments from real subtitle JSON segments (each has start/end/text)
function generateSegmentsFromSubtitles(video, vidIndex, subs) {
  if (!subs || !subs.length) return []
  const n = subs.length
  const targetGroups = Math.min(6, Math.max(3, Math.ceil(n / 4)))
  const groupSize = Math.ceil(n / targetGroups)
  const groups = []
  for (let i = 0; i < n; i += groupSize) {
    groups.push(subs.slice(i, Math.min(i + groupSize, n)))
  }
  const totalGroups = groups.length
  function getType(gi) {
    if (gi === 0) return '开场'
    if (gi === totalGroups - 1) return '结尾'
    if (totalGroups >= 4 && gi === totalGroups - 2) return '成品展示'
    return '制作步骤'
  }
  return groups.map((group, gi) => {
    const startSec = group[0].start
    const endSec   = group[group.length - 1].end
    const fullText = group.map(s => s.text.trim()).join(' ')
    const type     = getType(gi)
    return {
      id:       `${video.id}-rs${gi}`,
      startSec,
      endSec,
      startStr: fmt(startSec),
      endStr:   fmt(endSec),
      type,
      subtitle: fullText,
      selected: type !== '开场' && type !== '结尾',
    }
  })
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

// Build composition plans from selected segments with type-aware, diversified generation
const NARRATIVE_TYPES = ['开场','食材准备','制作步骤','成品展示','结尾','其他']
function typeOrder(type) { const i=NARRATIVE_TYPES.indexOf(type); return i===-1?5:i }

// Build a composition-time subtitle list from all segments (for v0.7 refine page)
function buildCompSubtitles(comp, videoAnalysis, uploadedVideos) {
  if (!comp) return []
  const result = []
  let acc = 0
  comp.segments.forEach((seg, si) => {
    const dur = Math.max(0, seg.endSec - seg.startSec)
    const vid = uploadedVideos[seg.videoIndex]
    const ana = videoAnalysis?.[vid?.id]
    if (ana?.subtitles?.length) {
      ana.subtitles
        .filter(s => s.startSec < seg.endSec && s.endSec > seg.startSec)
        .forEach((s, oi) => {
          result.push({
            id: `${seg.id}-csub-${oi}`,
            text: s.text,
            compStart: +(acc + Math.max(0, s.startSec - seg.startSec)).toFixed(2),
            compEnd:   +(acc + Math.min(dur, s.endSec   - seg.startSec)).toFixed(2),
            segIdx: si,
          })
        })
    } else if (seg.subtitle) {
      result.push({
        id: `${seg.id}-csub-fb`,
        text: seg.subtitle,
        compStart: +acc.toFixed(2),
        compEnd:   +(acc + dur).toFixed(2),
        segIdx: si,
      })
    }
    acc += dur
  })
  return result
}

// Build a single summary script string from comp subtitles (one paragraph per segment)
function buildSummaryScript(comp, videoAnalysis, uploadedVideos) {
  const subs = buildCompSubtitles(comp, videoAnalysis, uploadedVideos)
  const bySegment = {}
  subs.forEach(s => {
    if (!bySegment[s.segIdx]) bySegment[s.segIdx] = []
    bySegment[s.segIdx].push(s.text)
  })
  return comp.segments.map((seg, si) => {
    const texts = bySegment[si] || (seg.subtitle ? [seg.subtitle] : [])
    return texts.join(' ')
  }).filter(t => t.trim()).join('\n\n')
}

function buildDerivedTimeline(comp, deletedSegIdxs, speedMap) {
  let acc = 0
  const segments = []
  ;(comp.segments||[]).forEach((seg, si) => {
    if ((deletedSegIdxs||[]).includes(si)) return
    const rawDur = seg.endSec - seg.startSec
    const spd = (speedMap||{})[si] ?? 1
    const actualDur = rawDur / Math.max(0.1, spd)
    segments.push({ segIdx: si, seg, compStart: acc, compEnd: acc + actualDur, actualDur, speed: spd })
    acc += actualDur
  })
  return { segments, totalDuration: acc }
}

function downloadTextFile(text, filename) {
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadJSONFile(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], {type:'application/json'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}

// Get best subtitle text for a segment: real subtitles > seg.subtitle field
function getSegSubtitleFromAna(seg, vidId, videoAnalysis) {
  if (!seg) return ''
  const ana = videoAnalysis?.[vidId]
  if (ana?.subtitles?.length) {
    const matching = ana.subtitles.filter(s => s.startSec < seg.endSec && s.endSec > seg.startSec)
    if (matching.length) return matching.map(s => s.text).join(' ')
  }
  return seg.subtitle || ''
}

function buildCompositions(segs) {
  if (!segs.length) return []

  const videoIdxSet = new Set(segs.map(s => s.videoIndex))
  const numVideos = videoIdxSet.size
  const videoIdxs = [...videoIdxSet].sort((a, b) => a - b)

  const N = Math.min(5, Math.max(2, Math.ceil(segs.length / 4)))

  const byType = {}
  segs.forEach(s => { (byType[s.type] = byType[s.type] || []).push(s) })
  const availTypes = NARRATIVE_TYPES.filter(t => byType[t]?.length > 0)

  function buildSlots() {
    const slots = []
    const TARGET_MAX = 8
    for (const t of availTypes) {
      if (t === '制作步骤') {
        const cnt = Math.min(3, byType[t].length, TARGET_MAX - slots.length)
        for (let k = 0; k < cnt; k++) slots.push(t)
      } else {
        if (slots.length < TARGET_MAX) slots.push(t)
      }
    }
    // Pad to at least 5 if we have enough segments
    while (slots.length < Math.min(5, segs.length)) {
      const best = availTypes.reduce((a, b) => (byType[a]?.length||0)>=(byType[b]?.length||0)?a:b, availTypes[0])
      slots.push(best)
    }
    return slots
  }

  const comps = []

  for (let ci = 0; ci < N; ci++) {
    const slots = buildSlots()
    const usedIds = new Set()
    const picked = []
    let lastVidIdx = -1
    let consecutiveSame = 0

    for (let si = 0; si < slots.length; si++) {
      const type = slots[si]
      let pool = (byType[type] || []).filter(s => !usedIds.has(s.id))
      if (!pool.length) pool = segs.filter(s => !usedIds.has(s.id))
      if (!pool.length) continue

      const scored = pool.map(s => {
        let score = 0
        if (s.videoIndex === lastVidIdx) score += (consecutiveSame >= 2 ? 50 : 10)
        const vidUseCount = picked.filter(p => p.videoIndex === s.videoIndex).length
        score += vidUseCount * 4
        comps.forEach(prev => { if (prev.segments[si]?.id === s.id) score += 6 })
        comps.forEach(prev => { if (prev.segments.some(ps => ps.id === s.id)) score += 2 })
        score += ((s.id.charCodeAt(s.id.length-1) * 3 + ci * 7 + si) % 5)
        return { s, score }
      })
      scored.sort((a, b) => a.score - b.score)
      const pick = scored[0].s

      if (pick.videoIndex === lastVidIdx) consecutiveSame++
      else { lastVidIdx = pick.videoIndex; consecutiveSame = 1 }
      picked.push(pick)
      usedIds.add(pick.id)
    }

    // Fallback: fill to at least 5
    if (picked.length < Math.min(5, segs.length)) {
      for (const s of segs) {
        if (!usedIds.has(s.id)) { picked.push(s); usedIds.add(s.id) }
        if (picked.length >= Math.min(8, segs.length)) break
      }
    }

    // Hard rule: ensure >= 2 source videos when multiple videos exist
    if (numVideos >= 2) {
      const pickedVids = new Set(picked.map(s => s.videoIndex))
      if (pickedVids.size < 2) {
        for (let si = picked.length - 1; si >= 0; si--) {
          const otherVid = videoIdxs.find(vi => vi !== picked[si].videoIndex)
          if (otherVid === undefined) break
          const alts = segs.filter(s => s.videoIndex === otherVid && !usedIds.has(s.id))
          if (alts.length) {
            usedIds.delete(picked[si].id)
            picked[si] = alts[0]
            usedIds.add(picked[si].id)
            break
          }
        }
      }
    }

    // Similarity guard: if >70% overlap with any existing comp, try to swap
    for (let attempt = 0; attempt < 4; attempt++) {
      const tooSimilar = comps.some(prev => {
        const prevIds = new Set(prev.segments.map(s => s.id))
        const overlap = picked.filter(s => prevIds.has(s.id)).length
        return overlap / Math.max(prev.segments.length, picked.length) > 0.7
      })
      if (!tooSimilar) break
      for (let si = 0; si < picked.length; si++) {
        const type = picked[si].type
        const alts = (byType[type] || []).filter(s =>
          !usedIds.has(s.id) &&
          !comps.some(prev => prev.segments[si]?.id === s.id)
        )
        if (alts.length) {
          usedIds.delete(picked[si].id)
          picked[si] = alts[(ci + attempt) % alts.length]
          usedIds.add(picked[si].id)
          break
        }
      }
    }

    const totalDur = picked.reduce((a, s) => a + (s.endSec - s.startSec), 0)
    comps.push({ id: `comp${ci}`, idx: ci, name: `成品视频 ${ci + 1}`, segments: picked, totalDur })
  }

  if (segs.length < 5) {
    console.warn('[buildCompositions] 可用片段较少（', segs.length, '），方案可能相似')
  }
  return comps
}

function getSubtitlesForSeg(seg, subtitles) {
  return subtitles.filter(s => s.startSec >= seg.startSec && s.startSec < seg.endSec)
}

function splitIntoSubtitleColumns(subtitles, cols = 2) {
  const count = subtitles.length
  if (!count) return []
  const actualCols = Math.min(cols, count)
  const perCol = Math.ceil(count / actualCols)
  return Array.from({ length: actualCols }, (_, i) => ({
    subs: subtitles.slice(i * perCol, (i + 1) * perCol),
    startIdx: i * perCol,
  }))
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle ${on?'on':''}`} onClick={onToggle} role="switch" aria-checked={on}>
      <div className="toggle-thumb" />
    </div>
  )
}

function BatchExportModal({ comps, exportRes, exportFps, ratio, dedup, onClose, onComplete }) {
  const today = new Date().toISOString().slice(0,10)
  const [batchPhase, setBatchPhase] = useState('config') // 'config' | 'exporting'
  const [nameRule, setNameRule] = useState('混剪成品_{序号}_{日期}')
  const [statuses, setStatuses] = useState(()=>Object.fromEntries(comps.map(c=>[c.id,'waiting'])))
  const [currentIdx, setCurrentIdx] = useState(0)
  const [prog, setProg] = useState(0)
  const [allDone, setAllDone] = useState(false)
  function resolveFileName(rule, idx, comp) {
    return rule
      .replace(/{序号}/g, String(idx+1).padStart(2,'0'))
      .replace(/{日期}/g, today)
      .replace(/{成品名}/g, comp.name) + '.mp4'
  }
  useEffect(()=>{
    if(batchPhase!=='exporting'||allDone) return
    setStatuses(prev=>({...prev,[comps[currentIdx]?.id]:'exporting'}))
    let p=0
    const iv=setInterval(()=>{
      p+=Math.random()*8+4
      if(p>=100){
        p=100; clearInterval(iv)
        const nextIdx=currentIdx+1
        if(nextIdx>=comps.length){
          setStatuses(prev=>({...prev,[comps[currentIdx].id]:'done'}))
          setAllDone(true)
          onComplete(comps.map(c=>c.id))
        } else {
          setStatuses(prev=>({...prev,[comps[currentIdx].id]:'done'}))
          setCurrentIdx(nextIdx)
          setProg(0)
        }
      } else setProg(p)
    },220)
    return()=>clearInterval(iv)
  },[batchPhase,currentIdx,allDone]) // eslint-disable-line react-hooks/exhaustive-deps
  const enabledDedup = Object.entries(dedup).filter(([,v])=>v)
  return (
    <div className="overlay" onClick={allDone?onClose:undefined}>
      <div className="export-modal batch-modal" onClick={e=>e.stopPropagation()}>
        <div className="export-modal-header">
          <div className="export-modal-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            批量导出全部成品视频
          </div>
          <button className="import-close" onClick={onClose}>✕</button>
        </div>
        <div className="export-proto-notice">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          当前为原型模拟导出，不会生成真实 MP4 文件
        </div>
        <div className="export-settings-summary">
          {[['格式','MP4 (H.264)'],['分辨率',exportRes==='1080p'?'1920×1080':'1280×720'],['帧率',exportFps],['比例',ratio],['数量',`${comps.length} 个`]].map(([l,v])=>(
            <div key={l} className="export-setting-card"><span className="esc-label">{l}</span><span className="esc-val">{v}</span></div>
          ))}
        </div>

        {batchPhase==='config'&&(
          <>
            <div className="export-file-section">
              <div className="export-file-row">
                <label className="export-file-label">批量命名规则</label>
                <div className="export-file-input-wrap" style={{flex:1}}>
                  <input className="export-file-input" value={nameRule} onChange={e=>setNameRule(e.target.value||'混剪成品_{序号}_{日期}')} maxLength={50}/>
                  <span className="export-file-ext">.mp4</span>
                </div>
              </div>
              <div className="export-batch-vars">
                可用变量：
                <span className="export-var-chip">{'{序号}'} = 01、02…</span>
                <span className="export-var-chip">{'{日期}'} = {today}</span>
                <span className="export-var-chip">{'{成品名}'} = 成品视频1…</span>
              </div>
            </div>
            <div className="export-batch-preview">
              <div className="export-batch-preview-title">文件名预览</div>
              {comps.map((comp,ci)=>(
                <div key={comp.id} className="export-batch-preview-row">
                  <span className="export-batch-preview-comp">{comp.name}</span>
                  <span className="export-batch-preview-file">{resolveFileName(nameRule,ci,comp)}</span>
                </div>
              ))}
            </div>
            <div className="export-file-section" style={{borderTop:'1px solid var(--bdr)',marginTop:0}}>
              <div className="export-file-row">
                <label className="export-file-label">保存位置</label>
                <div className="export-save-loc">
                  <span className="export-save-path">本地默认导出文件夹（原型模拟）</span>
                  <button className="export-save-browse" disabled>选择文件夹</button>
                </div>
              </div>
              <div className="export-save-hint">当前为网页原型，暂不支持选择真实本地文件夹。真实版本将在本地软件阶段支持选择保存目录。</div>
            </div>
            <div className="export-action-row">
              <button className="export-cancel-btn" onClick={onClose}>取消</button>
              <button className="export-confirm-btn" onClick={()=>{
                setBatchPhase('exporting')
                setStatuses(Object.fromEntries(comps.map((c,i)=>[c.id,i===0?'exporting':'waiting'])))
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                开始批量导出
              </button>
            </div>
          </>
        )}

        {batchPhase==='exporting'&&(
          <>
            <div className="batch-export-list">
              {comps.map((comp,ci)=>{
                const st=statuses[comp.id]
                const fname=resolveFileName(nameRule,ci,comp)
                return (
                  <div key={comp.id} className={`batch-export-item batch-st-${st}`}>
                    <div className="batch-export-item-info">
                      <span className="batch-export-name">{comp.name}</span>
                      <span className="batch-export-meta">{fmt(comp.totalDur)} · {comp.segments.length} 片段</span>
                      <span className="batch-export-fname">{fname}</span>
                    </div>
                    <div className="batch-export-status">
                      {st==='done'&&<span className="batch-status-label done">✓ 完成</span>}
                      {st==='exporting'&&(
                        <div className="batch-exporting-row">
                          <div className="batch-mini-bar"><div className="batch-mini-fill" style={{width:`${prog}%`}}/></div>
                          <span className="batch-status-label exporting">{Math.round(prog)}%</span>
                        </div>
                      )}
                      {st==='waiting'&&<span className="batch-status-label waiting">等待中</span>}
                    </div>
                  </div>
                )
              })}
            </div>
            {allDone?(
              <>
                <div className="export-done-loc" style={{margin:'6px 0'}}>保存位置：本地默认导出文件夹（原型模拟）</div>
                <div className="batch-done-banner">✓ 全部模拟导出完成 · 共 {comps.length} 个成品视频</div>
              </>
            ):(
              <div className="batch-progress-status">正在模拟导出 {currentIdx+1}/{comps.length}：{comps[currentIdx]?.name}</div>
            )}
            <div className="export-action-row">
              <button className="export-cancel-btn" style={{flex:1}} onClick={onClose}>{allDone?'关闭':'取消'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ExportModal({ phase, prog, exportRes, exportFps, ratio, dedup, compName, defaultFileName, onConfirm, onClose }) {
  const enabledDedup = Object.entries(dedup).filter(([,v])=>v).map(([k])=>DEDUP_META[k])
  const EXPORT_STEPS = ['初始化编码器','处理视频轨道','混合音频','应用去重处理','封装 MP4']
  const stepIdx = Math.min(Math.floor(prog / 22), EXPORT_STEPS.length - 1)
  const [fileName, setFileName] = useState(defaultFileName||'混剪成品.mp4')
  useEffect(()=>{ setFileName(defaultFileName||'混剪成品.mp4') }, [defaultFileName])
  const nameNoExt = fileName.replace(/\.mp4$/i,'')
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
            {[['格式','MP4 (H.264)'],['分辨率',exportRes==='1080p'?'1920×1080':'1280×720'],['帧率',exportFps],['比例',ratio],['预计大小',`~${exportRes==='1080p'?'148':'64'} MB`]].map(([l,v])=>(
              <div key={l} className="export-setting-card"><span className="esc-label">{l}</span><span className="esc-val">{v}</span></div>
            ))}
          </div>
          <div className="export-file-section">
            <div className="export-file-row">
              <label className="export-file-label">文件名</label>
              <div className="export-file-input-wrap">
                <input
                  className="export-file-input"
                  value={nameNoExt}
                  onChange={e=>setFileName((e.target.value||'混剪成品')+'.mp4')}
                  maxLength={60}
                  placeholder="输入文件名"
                />
                <span className="export-file-ext">.mp4</span>
              </div>
            </div>
            <div className="export-file-row">
              <label className="export-file-label">保存位置</label>
              <div className="export-save-loc">
                <span className="export-save-path">本地默认导出文件夹（原型模拟）</span>
                <button className="export-save-browse" disabled title="真实版本将在本地软件阶段支持选择保存目录">选择文件夹</button>
              </div>
            </div>
            <div className="export-save-hint">当前为网页原型，暂不支持选择真实本地文件夹。真实版本将在本地软件阶段支持。</div>
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
            <p>当前为原型模拟，不会生成真实 MP4 文件。</p>
            <div className="export-done-file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              {fileName}
            </div>
            <div className="export-done-meta">{exportRes} · {exportFps} · {ratio}</div>
            <div className="export-done-loc">保存位置：本地默认导出文件夹（原型模拟）</div>
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
  const [prevSegmentsForUndo, setPrevSegmentsForUndo] = useState(null) // { videoId, segments, subtitles }
  const [editingSubId, setEditingSubId]               = useState(null)
  const [editingSubText, setEditingSubText]           = useState('')
  const [subStep, setSubStep]                 = useState('cut')
  const [subColCount, setSubColCount]         = useState(2)

  // ── step-3 compositions ──
  const [compositions, setCompositions]     = useState([])
  const [selectedCompId, setSelectedCompId] = useState(null)

  // ── step-3 composition editing ──
  const [editingSeg, setEditingSeg]         = useState(null)   // {compId, segIdx}
  const [lockedSegs, setLockedSegs]         = useState({})     // {compId: {segIdx: true}}
  const [compSegUsage, setCompSegUsage]         = useState({})   // {compId_segIdx: {mode, secs}}
  const [compManualEdited, setCompManualEdited] = useState({})  // {compId: true}
  const [compUndoSnap, setCompUndoSnap]         = useState(null) // {compositions, lockedSegs, compManualEdited}
  const [compPreviewPos, setCompPreviewPos]     = useState({})  // {compId: posSec}
  const [showAllCands, setShowAllCands] = useState({})     // {'compId_segIdx': true}
  const [compIsPlaying, setCompIsPlaying]   = useState(false)
  const [compPlayCompId, setCompPlayCompId] = useState(null)
  const [compPlaySegIdx, setCompPlaySegIdx] = useState(0)
  const [candidatePreview, setCandidatePreview] = useState(null) // {cand, compId, segIdx}
  const [prevVidPlaying, setPrevVidPlaying] = useState(false) // tracks actual video element play state

  // ── step-2 refined compositions (v0.7.1) ──
  // {compId: {summaryScript, scriptModified, copyTitle, copyBody, copyModified, editActions}}
  const [refinedComps, setRefinedComps]         = useState({})
  const [refineSubPromptKey, setRefineSubPromptKey] = useState(null)
  const [refineCopyTask, setRefineCopyTask]     = useState('referenceTitle')

  // ── step-2 refine (v0.7) ──
  const [refineCompId, setRefineCompId]         = useState(null)
  const [refineMarks, setRefineMarks]           = useState({})      // {compId:[{id,type,targetType,segIdx,subIdx,compStart,compEnd}]}
  const [refineMarkUndo, setRefineMarkUndo]     = useState(null)    // previous marks[compId] for undo
  const [refinePrevPos, setRefinePrevPos]       = useState(0)       // playhead position in comp time
  const [refineIsPlaying, setRefineIsPlaying]   = useState(false)
  const [refinePlaySegIdx, setRefinePlaySegIdx] = useState(0)
  const [refineSelSeg, setRefineSelSeg]         = useState(null)    // explicitly selected segIdx
  const [refineVidPlaying, setRefineVidPlaying] = useState(false)   // actual video element play state

  // ── export ──
  const [showExport, setShowExport]   = useState(false)
  const [exportPhase, setExportPhase] = useState('confirm')
  const [exportProg, setExportProg]   = useState(0)
  const [exportRes, setExportRes]     = useState('1080p')
  const [exportFps, setExportFps]     = useState('30fps')
  const [exportCompName, setExportCompName] = useState('')
  const [exportingCompId, setExportingCompId] = useState(null)
  const [exportedComps, setExportedComps]   = useState(new Set())
  const [showBatchExport, setShowBatchExport] = useState(false)
  // ── step-3 preview ──
  const [s3SelSeg, setS3SelSeg]       = useState(null)  // {compId, segIdx}
  const [s3SimPlaying, setS3SimPlaying] = useState(false)
  const [s3SimIdx, setS3SimIdx]         = useState(0)

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
  const [batchImportResult, setBatchImportResult] = useState(null)
  const [batchResultExpanded, setBatchResultExpanded] = useState(false)
  const [showImportGuide, setShowImportGuide]     = useState(false)

  const timerRef              = useRef(null)
  const fileInputRef          = useRef(null)
  const videoRef              = useRef(null)
  const editorVideoRef        = useRef(null)
  const currentlyAnalyzingRef = useRef(null)
  const uploadedVideosRef     = useRef([])
  const videoAnalysisRef      = useRef({})
  const compositionsRef       = useRef([])
  const scrubberRef           = useRef(null)
  const scrubDragRef          = useRef(false)
  const subtitleFileRef       = useRef(null)
  const batchSubtitleFileRef  = useRef(null)
  const subListRef            = useRef(null)
  const compTlDragRef         = useRef(null) // {compId, rect, totalDur}
  const compPrevRef           = useRef(null) // video element for comp preview
  const compPrevSeekRef       = useRef(null) // desired seek time after src load
  const compIsPlayingRef   = useRef(false)
  const compPlayCompIdRef  = useRef(null)
  const compPlaySegIdxRef  = useRef(0)
  const refinePrevRef      = useRef(null)
  const refineIsPlayingRef = useRef(false)
  const refinePlaySegIdxRef = useRef(0)
  const refinePlayCompIdRef = useRef(null)
  const refinePrevSeekRef  = useRef(null)
  const refineTlDragRef    = useRef(null)

  useEffect(() => { uploadedVideosRef.current = uploadedVideos }, [uploadedVideos])
  useEffect(() => { videoAnalysisRef.current = videoAnalysis  }, [videoAnalysis])
  useEffect(() => { compositionsRef.current  = compositions   }, [compositions])
  useEffect(()=>{ compIsPlayingRef.current=compIsPlaying },[compIsPlaying])
  useEffect(()=>{ compPlayCompIdRef.current=compPlayCompId },[compPlayCompId])
  useEffect(()=>{ compPlaySegIdxRef.current=compPlaySegIdx },[compPlaySegIdx])
  useEffect(()=>{ refineIsPlayingRef.current=refineIsPlaying },[refineIsPlaying])
  useEffect(()=>{ refinePlaySegIdxRef.current=refinePlaySegIdx },[refinePlaySegIdx])

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
  const editorSubtitles  = editorAnalysis?.subtitles || []
  const correctedSubCount = editorSubtitles.filter(s => s.corrected).length
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
  const allSegsAll = useMemo(()=>
    uploadedVideos.flatMap((v,vi)=>{
      const segs = videoAnalysis[v.id]?.segments || []
      return segs.map((s,si)=>({...s,videoIndex:vi,segInVid:si,label:`${vi+1}-${si+1}`,videoName:v.name}))
    }),
    [uploadedVideos,videoAnalysis]
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

  // comp timeline drag
  useEffect(()=>{
    function onMove(e) {
      if (!compTlDragRef.current) return
      const {compId,rect,totalDur}=compTlDragRef.current
      const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))
      const rawPos=ratio*totalDur
      const comp=compositionsRef.current.find(c=>c.id===compId)
      if (!comp) return
      const posSec=snapToSegBoundary(comp,rawPos)
      setCompPreviewPos(prev=>({...prev,[compId]:posSec}))
      setEditingSeg({compId,segIdx:findSegAtPos(comp,posSec)})
    }
    function onUp() { compTlDragRef.current=null }
    document.addEventListener('mousemove',onMove)
    document.addEventListener('mouseup',onUp)
    return ()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  // refine timeline drag
  useEffect(()=>{
    function onMove(e) {
      if (!refineTlDragRef.current) return
      const {compId,rect,totalDur}=refineTlDragRef.current
      const comp=compositionsRef.current.find(c=>c.id===compId); if(!comp) return
      const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))
      const pos=snapToSegBoundary(comp,ratio*totalDur)
      setRefinePrevPos(pos)
      const sIdx=findSegAtPos(comp,pos)
      setRefineSelSeg(sIdx)
      let acc=0; for(let i=0;i<sIdx;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec
      const off=Math.min(Math.max(0,pos-acc),comp.segments[sIdx].endSec-comp.segments[sIdx].startSec-0.01)
      refinePrevSeekRef.current=comp.segments[sIdx].startSec+off
      const vid=refinePrevRef.current
      if(vid&&vid.readyState>=2) vid.currentTime=refinePrevSeekRef.current
    }
    function onUp() { refineTlDragRef.current=null }
    document.addEventListener('mousemove',onMove)
    document.addEventListener('mouseup',onUp)
    return ()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
  },[]) // eslint-disable-line react-hooks/exhaustive-deps

  // seek comp preview video when active selection/position changes (not during playback)
  useEffect(()=>{
    const vid=compPrevRef.current
    if (!vid || compIsPlayingRef.current) return
    if (candidatePreview) {
      const t=candidatePreview.cand.startSec
      compPrevSeekRef.current=t
      if (vid.readyState>=2) vid.currentTime=t
    } else if (editingSeg) {
      const comp=compositionsRef.current.find(c=>c.id===editingSeg.compId)
      if (!comp) return
      const seg=comp.segments[editingSeg.segIdx]
      if (!seg) return
      let acc=0
      for (let i=0;i<editingSeg.segIdx;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec
      const pos=compPreviewPos[comp.id]??acc
      const off=Math.min(Math.max(0,pos-acc),seg.endSec-seg.startSec)
      const t=seg.startSec+off
      compPrevSeekRef.current=t
      if (vid.readyState>=2) vid.currentTime=t
    }
  },[editingSeg?.segIdx,editingSeg?.compId,compPreviewPos,candidatePreview?.cand?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // when compPlaySegIdx advances during playback, seek (handles same-video segment switches)
  useEffect(()=>{
    if (!compIsPlaying) return
    const comp=compositions.find(c=>c.id===compPlayCompId)
    if (!comp) return
    const seg=comp.segments[compPlaySegIdx]
    if (!seg) return
    const vid=compPrevRef.current
    if (!vid) return
    compPrevSeekRef.current=seg.startSec
    if (vid.readyState>=2){
      vid.currentTime=seg.startSec
      vid.play().catch(()=>{})
    }
  },[compPlaySegIdx]) // eslint-disable-line react-hooks/exhaustive-deps

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
    setPrevSegmentsForUndo(null)
  }, [currentVideoId])

  // auto-scroll subtitle list to current subtitle
  useEffect(()=>{
    if (currentSubIdx < 0 || !subListRef.current) return
    const items = subListRef.current.querySelectorAll('.s2-sub-row')
    if (items[currentSubIdx]) items[currentSubIdx].scrollIntoView({ block:'nearest', behavior:'smooth' })
  },[currentSubIdx])

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

  function saveUndoState() {
    if (!currentVideoId || !editorSegs.length) return
    setPrevSegmentsForUndo({
      videoId:   currentVideoId,
      segments:  editorSegs.map(s => ({...s})),
      subtitles: editorSubtitles.map(s => ({...s})),
    })
  }

  function handleUndo() {
    if (!prevSegmentsForUndo || prevSegmentsForUndo.videoId !== currentVideoId) return
    setVideoAnalysis(prev => ({
      ...prev,
      [currentVideoId]: {
        ...prev[currentVideoId],
        segments: prevSegmentsForUndo.segments,
        ...(prevSegmentsForUndo.subtitles ? { subtitles: prevSegmentsForUndo.subtitles } : {}),
      }
    }))
    setPrevSegmentsForUndo(null)
    setSelectedCutIdx(null)
    setSelectedSegIdx(null)
    setEditingSubId(null)
    setEditingSubText('')
    showToast('已撤销上一步操作')
  }

  function handleSaveSubEdit(subId) {
    const trimmed = editingSubText.trim()
    if (!trimmed) { showToast('字幕不能为空'); return }
    saveUndoState()
    setVideoAnalysis(prev => {
      const ana = prev[currentVideoId]
      if (!ana?.subtitles) return prev
      return {
        ...prev,
        [currentVideoId]: {
          ...ana,
          subtitles: ana.subtitles.map(s =>
            s.id === subId ? { ...s, text: trimmed, corrected: true } : s
          ),
        }
      }
    })
    setEditingSubId(null)
    setEditingSubText('')
  }

  function handleExportCorrectedSubtitles() {
    if (!currentVideoId) return
    const ana = videoAnalysis[currentVideoId]
    if (ana?.subtitleSource !== 'real' || !ana?.subtitles?.length) {
      showToast('当前视频没有可导出的真实字幕')
      return
    }
    const vid = uploadedVideos.find(v => v.id === currentVideoId)
    const baseName = vid?.name.replace(/\.[^.]+$/, '') || 'subtitles'
    const data = {
      sourceVideo: vid?.name || '',
      sourceAudio: `local-output/audio/${baseName}.wav`,
      language: 'zh',
      segmentCount: ana.subtitles.length,
      segments: ana.subtitles.map(s => ({
        id: s.id, start: s.startSec, end: s.endSec, text: s.text,
      })),
      createdAt: new Date().toISOString(),
      correctedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${baseName}.corrected.subtitles.json`
    a.click(); URL.revokeObjectURL(url)
    showToast(`✓ 已导出：${baseName}.corrected.subtitles.json`)
  }

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

  function handleSubtitleImport(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!currentVideoId) { showToast('请先在左侧选择一个视频'); return }
    if (!file.name.toLowerCase().endsWith('.json')) { showToast('请选择 .json 格式的字幕文件'); return }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.segments || !Array.isArray(data.segments)) { showToast('格式错误：JSON 中缺少 segments 数组'); return }
        if (data.segments.length === 0) { showToast('字幕文件为空（segments 数组为空）'); return }
        const invalid = data.segments.find(s => typeof s.start !== 'number' || typeof s.end !== 'number' || !s.text?.trim())
        if (invalid) { showToast('字幕格式错误：缺少 start / end / text 字段，或文本为空'); return }
        const vid    = uploadedVideosRef.current.find(v => v.id === currentVideoId)
        const vidIdx = uploadedVideosRef.current.findIndex(v => v.id === currentVideoId)
        const convertedSubs = data.segments.map((s, i) => ({
          id: `${currentVideoId}-rsub${i}`, startSec: s.start, endSec: s.end, text: s.text.trim(),
        }))
        const newSegs = generateSegmentsFromSubtitles(vid, vidIdx, data.segments)
        setVideoAnalysis(prev => ({
          ...prev,
          [currentVideoId]: {
            ...(prev[currentVideoId] || {}),
            status:        prev[currentVideoId]?.status === 'confirmed' ? 'confirmed' : 'done',
            progress:      100,
            segments:      newSegs,
            subtitles:     convertedSubs,
            subtitleCount: convertedSubs.length,
            subtitleSource:'real',
          }
        }))
        showToast(`✓ 已导入真实字幕：共 ${convertedSubs.length} 条，已生成 ${newSegs.length} 个分段`)
      } catch (err) {
        showToast(err instanceof SyntaxError ? 'JSON 解析失败，请检查文件格式' : '导入失败：' + err.message)
      }
    }
    reader.onerror = () => showToast('文件读取失败')
    reader.readAsText(file, 'utf-8')
  }

  function handleBatchSubtitleImport(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return

    const videos = uploadedVideosRef.current

    function getVideoBaseName(vid) {
      return vid.name.replace(/\.[^.]+$/, '').toLowerCase()
    }

    function getJsonBaseName(filename) {
      // test.subtitles.json → test
      // food01.subtitles.json → food01
      // food01.json → food01
      return filename
        .replace(/\.subtitles\.json$/i, '')
        .replace(/\.json$/i, '')
        .toLowerCase()
    }

    function validateSubtitleData(data) {
      if (!data || typeof data !== 'object') return 'JSON 格式错误'
      if (!Array.isArray(data.segments)) return '缺少 segments 数组'
      if (data.segments.length === 0) return '字幕为空（segments 数组为空）'
      const bad = data.segments.find(s => typeof s.start !== 'number' || typeof s.end !== 'number' || !s.text?.trim())
      if (bad) return '字幕格式错误：缺少 start/end/text 字段'
      return null
    }

    let updates = {}

    const readers = files.map(file => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = ev => {
        let data
        try { data = JSON.parse(ev.target.result) } catch {
          resolve({ file, error: 'JSON 解析失败' })
          return
        }
        const err = validateSubtitleData(data)
        if (err) { resolve({ file, error: err }); return }

        const jsonBase = getJsonBaseName(file.name)
        const vid = videos.find(v => getVideoBaseName(v) === jsonBase)

        if (!vid) {
          resolve({ file, matched: false })
          return
        }

        const convertedSubs = data.segments.map((s, i) => ({
          id: `${vid.id}-rsub${i}`,
          startSec: s.start,
          endSec: s.end,
          text: s.text.trim(),
        }))
        const vidIdx = videos.findIndex(v => v.id === vid.id)
        const newSegs = generateSegmentsFromSubtitles(vid, vidIdx, data.segments)

        updates[vid.id] = {
          status: 'done',
          progress: 100,
          segments: newSegs,
          subtitles: convertedSubs,
          subtitleCount: convertedSubs.length,
          subtitleSource: 'real',
        }
        resolve({ file, matched: true, vidName: vid.name, count: convertedSubs.length })
      }
      reader.onerror = () => resolve({ file, error: '文件读取失败' })
      reader.readAsText(file, 'utf-8')
    }))

    Promise.all(readers).then(results => {
      const matchedItems = results.filter(r => r.matched)
      const unmatchedItems = results.filter(r => !r.matched && !r.error)
      const errorItems = results.filter(r => r.error)

      if (Object.keys(updates).length > 0) {
        setVideoAnalysis(prev => {
          const next = { ...prev }
          for (const [id, upd] of Object.entries(updates)) {
            next[id] = { ...(prev[id] || {}), ...upd }
          }
          return next
        })
      }

      setBatchResultExpanded(false)
      setBatchImportResult({
        matched: matchedItems.map(r => ({ name: r.vidName, count: r.count })),
        unmatched: unmatchedItems.map(r => r.file.name),
        errors: errorItems.map(r => `${r.file.name}: ${r.error}`),
      })
    })
  }

  function toggleEditorSeg(segIdx) {
    if (!currentVideoId) return
    saveUndoState()
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
    saveUndoState()
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
    // Prefer selected subtitle's startSec as cut point
    let time = editorTime
    let cutLabel = `${fmt(time)}`
    if (selectedSubIdx >= 0 && editorSubtitles[selectedSubIdx]) {
      const sub = editorSubtitles[selectedSubIdx]
      time = sub.startSec
      cutLabel = `字幕 #${selectedSubIdx+1} 起始 ${fmt(time)}`
    }
    const idx=editorSegs.findIndex(s=>time>s.startSec+0.1&&time<s.endSec-0.1)
    if (idx===-1) {
      showToast(selectedSubIdx>=0 ? '该字幕边界已是片段边缘，无需切割' : '当前时间点无法新增切割点（距片段边缘太近）')
      return
    }
    saveUndoState()
    const seg=editorSegs[idx]
    const newSegs=[
      ...editorSegs.slice(0,idx),
      {...seg, id:seg.id+'a', endSec:time, endStr:fmt(time)},
      { id:seg.id+'b', startSec:time, endSec:seg.endSec, startStr:fmt(time), endStr:seg.endStr, type:seg.type, subtitle:seg.subtitle, selected:seg.selected },
      ...editorSegs.slice(idx+1),
    ]
    setVideoAnalysis(prev=>({ ...prev, [currentVideoId]:{...prev[currentVideoId],segments:newSegs} }))
    setSelectedCutIdx(idx)
    showToast(`已按 ${cutLabel} 新增切割点`)
  }

  function adjustCutPoint(cutIdx, delta) {
    if (!currentVideoId||cutIdx===null||cutIdx<0||cutIdx>=editorSegs.length-1) return
    saveUndoState()
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
    saveUndoState()
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

  // s3 simulation: advance through segments on interval
  useEffect(()=>{
    if(!s3SimPlaying) return
    const comp=compositions.find(c=>c.id===selectedCompId)
    if(!comp||s3SimIdx>=comp.segments.length){ setS3SimPlaying(false); setS3SimIdx(0); return }
    const dur=comp.segments[s3SimIdx].endSec-comp.segments[s3SimIdx].startSec
    const ms=Math.max(500,Math.min(2000,dur*300))
    const t=setTimeout(()=>{
      if(s3SimIdx>=comp.segments.length-1){ setS3SimPlaying(false); setS3SimIdx(0) }
      else setS3SimIdx(i=>i+1)
    },ms)
    return()=>clearTimeout(t)
  },[s3SimPlaying,s3SimIdx,selectedCompId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleExportOpen(compId, compName)  {
    setExportingCompId(compId||null)
    setExportCompName(compName||'')
    setShowExport(true); setExportPhase('confirm'); setExportProg(0)
  }
  function handleExportConfirm() {
    setExportPhase('exporting'); setExportProg(0)
    let p=0
    const iv=setInterval(()=>{ p+=Math.random()*6+2; if(p>=100){p=100;clearInterval(iv);setExportProg(100);setTimeout(()=>setExportPhase('done'),300)}else{setExportProg(p)} }, 200)
  }
  function handleExportClose() {
    if(exportPhase==='done'&&exportingCompId) setExportedComps(prev=>new Set([...prev,exportingCompId]))
    setShowExport(false); setTimeout(()=>{ setExportPhase('confirm'); setExportProg(0) },300)
  }

  function handleSeek(newTime) {
    const clamped=Math.max(0,Math.min(newTime,effectiveDuration)); setCurrent(clamped)
    if (!isGenerated&&videoRef.current) videoRef.current.currentTime=clamped
  }

  function toggleDedup(k) { setDedup(d=>({...d,[k]:!d[k]})) }

  function startCompPlay(compId) {
    const comp=compositions.find(c=>c.id===compId)
    if (!comp||!comp.segments.length) return
    setCandidatePreview(null)

    // Resume from current playhead position; restart from 0 if at end or not yet set
    const currentPos = compPreviewPos[compId] ?? 0
    const resumeFromStart = currentPos <= 0 || currentPos >= comp.totalDur - 0.2

    let startSegIdx = 0
    let seekTime = comp.segments[0].startSec
    if (!resumeFromStart) {
      let acc = 0
      for (let i = 0; i < comp.segments.length; i++) {
        const dur = comp.segments[i].endSec - comp.segments[i].startSec
        if (currentPos < acc + dur || i === comp.segments.length - 1) {
          startSegIdx = i
          const localOff = Math.min(Math.max(0, currentPos - acc), dur - 0.01)
          seekTime = comp.segments[i].startSec + localOff
          break
        }
        acc += dur
      }
    }

    setCompIsPlaying(true); compIsPlayingRef.current=true
    setCompPlayCompId(compId); compPlayCompIdRef.current=compId
    setCompPlaySegIdx(startSegIdx); compPlaySegIdxRef.current=startSegIdx
    setSelectedCompId(compId)
    setEditingSeg({compId,segIdx:startSegIdx})
    compPrevSeekRef.current=seekTime
    if (resumeFromStart) setCompPreviewPos(prev=>({...prev,[compId]:0}))
    const vid=compPrevRef.current
    if (vid) {
      vid.currentTime=seekTime
      vid.play().catch(()=>{})
    }
  }
  function stopCompPlay() {
    const vid=compPrevRef.current; if(vid) vid.pause()
    setCompIsPlaying(false); compIsPlayingRef.current=false
    setPrevVidPlaying(false)
  }

  // ── v0.7 refine functions ──
  function enterRefine(compId) {
    stopCompPlay()
    setRefineCompId(compId)
    setRefinePrevPos(0)
    setRefineIsPlaying(false); refineIsPlayingRef.current=false
    setRefinePlaySegIdx(0); refinePlaySegIdxRef.current=0
    refinePlayCompIdRef.current=compId
    setRefineSelSeg(null)
    setRefineVidPlaying(false)
    refinePrevSeekRef.current=null
    setSubStep('refine')
  }

  function startRefinePlay(comp) {
    if (!comp||!comp.segments.length) return
    const rc=refinedComps[comp.id]||{}
    const deletedSegIdxs=rc.deletedSegIdxs||[]
    const activeIdxs=comp.segments.map((_,i)=>i).filter(i=>!deletedSegIdxs.includes(i))
    if (!activeIdxs.length) { showToast('所有片段已标删，无法播放'); return }
    const currentPos=refinePrevPos
    // find start segment in derived timeline
    let startSegIdx=activeIdxs[0], seekTime=comp.segments[activeIdxs[0]].startSec
    const {segments:derivedSegs,totalDuration:derivedDur}=buildDerivedTimeline(comp,deletedSegIdxs,rc.speedMap||{})
    const atEnd=currentPos>=derivedDur-0.2
    if (!atEnd&&currentPos>0) {
      for (const ds of derivedSegs) {
        if (currentPos<=ds.compEnd||ds===derivedSegs[derivedSegs.length-1]) {
          startSegIdx=ds.segIdx
          const offsetInSeg=Math.max(0,currentPos-ds.compStart)*ds.speed
          seekTime=ds.seg.startSec+Math.min(offsetInSeg,ds.seg.endSec-ds.seg.startSec-0.01)
          break
        }
      }
    } else if (atEnd) {
      setRefinePrevPos(0)
    }
    setRefineIsPlaying(true); refineIsPlayingRef.current=true
    setRefinePlaySegIdx(startSegIdx); refinePlaySegIdxRef.current=startSegIdx
    refinePlayCompIdRef.current=comp.id
    refinePrevSeekRef.current=seekTime
    const vid=refinePrevRef.current
    if (vid) { vid.currentTime=seekTime; vid.play().catch(()=>{}) }
  }

  function stopRefinePlay() {
    const vid=refinePrevRef.current; if(vid) vid.pause()
    setRefineIsPlaying(false); refineIsPlayingRef.current=false
    setRefineVidPlaying(false)
  }

  function addRefineMark(compId, markType, targetType, segIdx, subIdx, compStart, compEnd) {
    setRefineMarkUndo(refineMarks[compId]||[])
    setRefineMarks(prev=>({...prev,[compId]:[...(prev[compId]||[]),{
      id:`mark-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type:markType, targetType, segIdx, subIdx, compStart, compEnd,
    }]}))
  }

  function removeRefineMark(compId, markId) {
    setRefineMarkUndo(refineMarks[compId]||[])
    setRefineMarks(prev=>({...prev,[compId]:(prev[compId]||[]).filter(m=>m.id!==markId)}))
  }

  function undoRefineMark(compId) {
    if (refineMarkUndo===null) return
    setRefineMarks(prev=>({...prev,[compId]:refineMarkUndo}))
    setRefineMarkUndo(null)
  }

  function defaultRcFor(existing) {
    return {
      summaryScript:'', scriptModified:false, scriptSavedAt:null,
      copywriting:{ referenceTitle:'', finalTitle:'', referenceWechatBody:'', finalWechatBody:'', referenceXhs:'', finalXhs:'' },
      copyModified:false, copySavedAt:null,
      deletedSegIdxs:[], speedMap:{},
      savedAt:null,
      ...(existing||{}),
    }
  }
  function updateRefinedComp(compId, updates) {
    setRefinedComps(prev=>({...prev,[compId]:defaultRcFor({...prev[compId],...updates})}))
  }
  function toggleDeleteSeg(compId, segIdx) {
    setRefinedComps(prev=>{
      const rc=defaultRcFor(prev[compId])
      const cur=rc.deletedSegIdxs
      const deletedSegIdxs=cur.includes(segIdx)?cur.filter(i=>i!==segIdx):[...cur,segIdx]
      return {...prev,[compId]:{...rc,deletedSegIdxs}}
    })
  }
  function setSegSpeed(compId, segIdx, speed) {
    setRefinedComps(prev=>{
      const rc=defaultRcFor(prev[compId])
      const speedMap={...rc.speedMap}
      if(speed===1) delete speedMap[segIdx]
      else speedMap[segIdx]=speed
      return {...prev,[compId]:{...rc,speedMap}}
    })
  }
  function saveScript(compId) {
    setRefinedComps(prev=>({...prev,[compId]:{...defaultRcFor(prev[compId]),scriptModified:false,scriptSavedAt:new Date().toISOString()}}))
    showToast('口播稿已保存')
  }
  function saveCopywriting(compId) {
    setRefinedComps(prev=>({...prev,[compId]:{...defaultRcFor(prev[compId]),copyModified:false,copySavedAt:new Date().toISOString()}}))
    showToast('文案已保存')
  }
  function saveRefinedPlan(compId) {
    setRefinedComps(prev=>({...prev,[compId]:{...defaultRcFor(prev[compId]),scriptModified:false,copyModified:false,savedAt:new Date().toISOString()}}))
    showToast('精修方案已保存')
  }
  function switchRefineComp(newCompId) {
    const rc=refinedComps[refineCompId]||{}
    if((rc.scriptModified||rc.copyModified)&&!window.confirm('当前方案有未保存的修改，确认切换？（修改仍在内存中，可稍后保存）')) return
    stopRefinePlay()
    setRefineCompId(newCompId)
    setRefineSelSeg(null)
    setRefinePrevPos(0)
  }

  function saveCompUndo() {
    setCompUndoSnap({ compositions, lockedSegs, compManualEdited })
  }
  function handleCompUndo() {
    if (!compUndoSnap) return
    setCompositions(compUndoSnap.compositions)
    setLockedSegs(compUndoSnap.lockedSegs)
    setCompManualEdited(compUndoSnap.compManualEdited)
    setCompUndoSnap(null)
    setEditingSeg(null)
    showToast('已撤销')
  }

  function replaceCompSeg(compId, segIdx, newSeg) {
    saveCompUndo()
    setCompositions(prev=>prev.map(c=>{
      if (c.id!==compId) return c
      const newSegs=c.segments.map((s,i)=>i===segIdx?newSeg:s)
      return {...c,segments:newSegs,totalDur:newSegs.reduce((a,s)=>a+(s.endSec-s.startSec),0)}
    }))
    setCompSegUsage(prev=>{ const next={...prev}; delete next[`${compId}_${segIdx}`]; return next })
    setCompManualEdited(prev=>({...prev,[compId]:true}))
  }

  function insertSegInComp(compId, atIdx, newSeg, where) {
    saveCompUndo()
    setCompositions(prev=>prev.map(c=>{
      if (c.id!==compId) return c
      const ins = where==='before' ? atIdx : atIdx+1
      const newSegs=[...c.segments.slice(0,ins), newSeg, ...c.segments.slice(ins)]
      return {...c,segments:newSegs,totalDur:newSegs.reduce((a,s)=>a+(s.endSec-s.startSec),0)}
    }))
    setCompManualEdited(prev=>({...prev,[compId]:true}))
    if (editingSeg?.compId===compId) {
      const ins = where==='before' ? atIdx : atIdx+1
      if (editingSeg.segIdx>=ins) setEditingSeg({compId,segIdx:editingSeg.segIdx+1})
    }
  }

  function toggleLockSeg(compId, segIdx) {
    setLockedSegs(prev=>{
      const cl=prev[compId]||{}
      return {...prev,[compId]:{...cl,[segIdx]:!cl[segIdx]}}
    })
  }

  function regenCompRow(compId) {
    saveCompUndo()
    const comp=compositions.find(c=>c.id===compId)
    if (!comp) return
    const cl=lockedSegs[compId]||{}
    // seed usedIds with locked segments to prevent conflicts
    const usedIds=new Set()
    comp.segments.forEach((seg,i)=>{ if(cl[i]) usedIds.add(seg.id) })
    const newSegs=comp.segments.map((seg,i)=>{
      if (cl[i]) return seg
      // try: same type + different video, then same type any, then any type
      const tryPools=[
        allSelectedSegs.filter(c=>c.type===seg.type&&c.id!==seg.id&&!usedIds.has(c.id)&&c.videoIndex!==seg.videoIndex),
        allSelectedSegs.filter(c=>c.type===seg.type&&c.id!==seg.id&&!usedIds.has(c.id)),
        allSelectedSegs.filter(c=>c.id!==seg.id&&!usedIds.has(c.id)),
      ]
      for (const pool of tryPools) {
        if (pool.length>0) {
          const pick=pool[Math.floor(Math.random()*pool.length)]
          usedIds.add(pick.id)
          return pick
        }
      }
      // absolute fallback: keep original
      if (allSelectedSegs.length<5) console.warn('[regenCompRow] 可用片段较少（',allSelectedSegs.length,'），方案可能相似')
      usedIds.add(seg.id)
      return seg
    })
    // ensure >=2 source videos when multiple exist
    const vidSet=new Set(newSegs.map(s=>s.videoIndex))
    if (vidSet.size<2&&allSelectedSegs.length>=2) {
      const otherVidSegs=allSelectedSegs.filter(s=>!vidSet.has(s.videoIndex)&&!usedIds.has(s.id))
      if (otherVidSegs.length>0) {
        for (let i=newSegs.length-1;i>=0;i--) {
          if (!cl[i]) {
            usedIds.delete(newSegs[i].id)
            newSegs[i]=otherVidSegs[0]
            usedIds.add(otherVidSegs[0].id)
            break
          }
        }
      }
    }
    setCompositions(prev=>prev.map(c=>c.id===compId?{...c,segments:newSegs,totalDur:newSegs.reduce((a,s)=>a+(s.endSec-s.startSec),0)}:c))
    setCompSegUsage(prev=>{
      const next={...prev}
      comp.segments.forEach((_,i)=>{ if(!cl[i]) delete next[`${compId}_${i}`] })
      return next
    })
    setCompManualEdited(prev=>{ const next={...prev}; delete next[compId]; return next })
    showToast('已重新生成此行组合')
  }

  function moveSegInComp(compId, segIdx, dir) {
    saveCompUndo()
    const comp=compositions.find(c=>c.id===compId)
    if (!comp) return
    const ti=segIdx+dir
    if (ti<0||ti>=comp.segments.length) return
    setCompositions(prev=>prev.map(c=>{
      if (c.id!==compId) return c
      const s=[...c.segments];[s[segIdx],s[ti]]=[s[ti],s[segIdx]]
      return {...c,segments:s}
    }))
    setLockedSegs(prev=>{
      const cl={...(prev[compId]||{})}
      const a=cl[segIdx],b=cl[ti]
      if (a) cl[ti]=a; else delete cl[ti]
      if (b) cl[segIdx]=b; else delete cl[segIdx]
      return {...prev,[compId]:cl}
    })
    setCompSegUsage(prev=>{
      const ka=`${compId}_${segIdx}`,kb=`${compId}_${ti}`
      const next={...prev}
      const a=next[ka],b=next[kb]
      if (a) next[kb]=a; else delete next[kb]
      if (b) next[ka]=b; else delete next[ka]
      return next
    })
    setCompManualEdited(prev=>({...prev,[compId]:true}))
    if (editingSeg?.compId===compId) {
      if (editingSeg.segIdx===segIdx) setEditingSeg({compId,segIdx:ti})
      else if (editingSeg.segIdx===ti) setEditingSeg({compId,segIdx})
    }
  }

  function setSegUsage(compId, segIdx, usage) {
    setCompSegUsage(prev=>({...prev,[`${compId}_${segIdx}`]:usage}))
    setCompManualEdited(prev=>({...prev,[compId]:true}))
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
      <input ref={subtitleFileRef} type="file" accept=".json" style={{display:'none'}} onChange={handleSubtitleImport}/>
      <input ref={batchSubtitleFileRef} type="file" accept=".json,application/json" multiple style={{display:'none'}} onChange={handleBatchSubtitleImport}/>

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

      {showExport && (()=>{
        const expComp=compositions.find(c=>c.id===exportingCompId)
        const today=new Date().toISOString().slice(0,10)
        const defName=expComp?`混剪成品_${expComp.name}_${today}.mp4`:`混剪成品_${today}.mp4`
        return <ExportModal phase={exportPhase} prog={exportProg} exportRes={exportRes} exportFps={exportFps} ratio={ratio} dedup={dedup} compName={exportCompName} defaultFileName={defName} onConfirm={handleExportConfirm} onClose={handleExportClose}/>
      })()}

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
          <div className="logo-text"><span className="logo-title">视频混剪工具</span><span className="logo-ver">v0.4</span></div>
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
          {subStep!=='refine'&&<div className="s2s-stats-bar">
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
          </div>}

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
    <div className="s2-compose-workbench">
      {(()=>{
        // derive preview context
        let prevVid=null, previewLabel='', previewMode='idle', prevSeg=null
        if (candidatePreview) {
          const origComp=compositions.find(c=>c.id===candidatePreview.compId)
          const origSeg=origComp?.segments[candidatePreview.segIdx]
          prevSeg=candidatePreview.cand
          prevVid=uploadedVideos[candidatePreview.cand.videoIndex]
          previewMode='candidate'
          previewLabel=`候选预览：${candidatePreview.cand.label}，将替换 ${origComp?.name??''} 第${candidatePreview.segIdx+1}段 ${origSeg?.label??''}`
        } else if (compIsPlaying&&compPlayCompId) {
          const comp=compositions.find(c=>c.id===compPlayCompId)
          prevSeg=comp?.segments[compPlaySegIdx]
          prevVid=prevSeg?uploadedVideos[prevSeg.videoIndex]:null
          previewMode='playing'
          previewLabel=`正在播放：${comp?.name??''} · 第${compPlaySegIdx+1}段 · ${prevSeg?.label??''}`
        } else if (editingSeg) {
          const comp=compositions.find(c=>c.id===editingSeg.compId)
          prevSeg=comp?.segments[editingSeg.segIdx]
          prevVid=prevSeg?uploadedVideos[prevSeg.videoIndex]:null
          previewMode='viewing'
          previewLabel=`查看片段：${compositions.find(c=>c.id===editingSeg.compId)?.name??''} · 第${editingSeg.segIdx+1}段 · ${prevSeg?.label??''}`
        }
        const tc=prevSeg?(SEG_TYPE_COLORS[prevSeg.type]||'#6366f1'):'#6366f1'

        // col3: current editing segment info (separate from candidatePreview)
        const col3Comp=editingSeg?compositions.find(c=>c.id===editingSeg.compId):null
        const col3Seg=col3Comp?.segments[editingSeg?.segIdx??-1]??null
        const col3tc=col3Seg?(SEG_TYPE_COLORS[col3Seg.type]||'#6366f1'):'#6366f1'
        const col3SubText=col3Seg?getSegSubtitleFromAna(col3Seg,uploadedVideos[col3Seg.videoIndex]?.id,videoAnalysis):''

        // recs and allCands (for cols 4 and 5)
        const compSegIds=new Set((col3Comp?.segments||[]).filter((_,i)=>i!==editingSeg?.segIdx).map(s=>s.id))
        const recs=col3Seg?[
          ...allSegsAll.filter(c=>c.type===col3Seg.type&&c.id!==col3Seg.id&&c.videoIndex!==col3Seg.videoIndex),
          ...allSegsAll.filter(c=>c.type===col3Seg.type&&c.id!==col3Seg.id&&c.videoIndex===col3Seg.videoIndex),
        ].slice(0,8):[]
        const allCands=allSegsAll

        return (
          <>
            {/* COL 1: material sources */}
            <div className="s2-mat-col">
              <div className="s2-mat-col-head">参与素材</div>
              {(usedVideos.length>0?usedVideos:uploadedVideos).map((v,vi)=>{
                const segs=videoAnalysis[v.id]?.segments||[]
                const selCount=segs.filter(s=>s.selected).length
                return (
                  <div key={v.id} className="s2-mat-src-item" onClick={()=>setPreviewVid(v)}>
                    <div className="s2-mat-src-thumb"><video src={v.url} preload="metadata" muted playsInline/></div>
                    <div className="s2-mat-src-info">
                      <div className="s2-mat-src-name">V{vi+1} · {v.name.replace(/\.[^.]+$/,'').slice(0,14)}</div>
                      <div className="s2-mat-src-meta">{v.durStr} · {selCount}片段</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* COL 2: 16:9 video preview */}
            <div className="s2-prev-col">
              {previewLabel&&<div className={`s2-prev-label s2-prev-label-${previewMode}`}>{previewLabel}</div>}
              <div className="s2-prev-video-wrap" onClick={()=>{
                const vid=compPrevRef.current; if(!vid||!prevVid) return
                if(compIsPlayingRef.current){ stopCompPlay() }
                else if(candidatePreview){ prevVidPlaying?vid.pause():vid.play().catch(()=>{}) }
                else if(prevVidPlaying){ vid.pause() }
                else if(editingSeg?.compId){ startCompPlay(editingSeg.compId) }
                else { vid.play().catch(()=>{}) }
              }}>
                {prevVid?(
                  <video
                    ref={compPrevRef}
                    key={prevVid.id}
                    src={prevVid.url}
                    preload="auto"
                    playsInline
                    className="s2-prev-video"
                    onPlay={()=>setPrevVidPlaying(true)}
                    onPause={()=>setPrevVidPlaying(false)}
                    onLoadedMetadata={()=>{
                      const vid=compPrevRef.current; if(!vid) return
                      vid.currentTime=compPrevSeekRef.current??0
                      if(compIsPlayingRef.current) vid.play().catch(()=>{})
                    }}
                    onTimeUpdate={()=>{
                      const vid=compPrevRef.current; if(!vid) return
                      if(!compIsPlayingRef.current) return
                      const compId=compPlayCompIdRef.current
                      const comp=compositionsRef.current.find(c=>c.id===compId); if(!comp) return
                      const segIdx=compPlaySegIdxRef.current
                      const seg=comp.segments[segIdx]; if(!seg) return
                      // update timeline playhead
                      let acc=0
                      for(let i=0;i<segIdx;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec
                      const posInComp=acc+Math.max(0,vid.currentTime-seg.startSec)
                      setCompPreviewPos(prev=>({...prev,[compId]:posInComp}))
                      // advance when segment ends
                      if(vid.currentTime>=seg.endSec-0.15){
                        const nextIdx=segIdx+1
                        if(nextIdx>=comp.segments.length){
                          vid.pause(); setCompIsPlaying(false); compIsPlayingRef.current=false
                          showToast('播放完成')
                        } else {
                          const nextSeg=comp.segments[nextIdx]
                          compPlaySegIdxRef.current=nextIdx
                          setCompPlaySegIdx(nextIdx)
                          setEditingSeg({compId,segIdx:nextIdx})
                          if(nextSeg.videoIndex===seg.videoIndex){
                            vid.currentTime=nextSeg.startSec
                            vid.play().catch(()=>{})
                          } else {
                            compPrevSeekRef.current=nextSeg.startSec
                            // key change will trigger remount + onLoadedMetadata
                          }
                        }
                      }
                    }}
                    onEnded={()=>{
                      if(!compIsPlayingRef.current) return
                      const comp=compositionsRef.current.find(c=>c.id===compPlayCompIdRef.current)
                      if(!comp) return
                      const nextIdx=compPlaySegIdxRef.current+1
                      if(nextIdx>=comp.segments.length){
                        setCompIsPlaying(false); compIsPlayingRef.current=false; showToast('播放完成')
                      }
                    }}
                  />
                ):(
                  <div className="s2-prev-no-vid">{editingSeg||candidatePreview?'无法加载视频':'点击下方片段块或播放按钮'}</div>
                )}
                <div className={`s2-prev-play-btn${prevVidPlaying?' playing':''}`}>
                  {prevVidPlaying
                    ?<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    :<svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>}
                </div>
              </div>
              {prevSeg&&(
                <div className="s2-prev-info-bar">
                  <span className="s2-prev-info-lbl" style={{color:tc}}>{prevSeg.label}</span>
                  <span className="s2-prev-info-vsrc">V{prevSeg.videoIndex+1}</span>
                  <span className="s2-prev-info-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{prevSeg.type}</span>
                  <span className="s2-prev-info-time">{prevSeg.startStr}–{prevSeg.endStr}</span>
                </div>
              )}
              {!prevSeg&&<div className="s2-prev-hint-bar">模拟组合预览 · 非真实成品视频</div>}
              <div className="s2-prev-sub-area">
                <span className="s2-prev-sub-label">片段字幕</span>
                <div className="s2-prev-sub-text">
                  {prevSeg
                    ?(getSegSubtitleFromAna(prevSeg,prevVid?.id,videoAnalysis)||'暂无字幕')
                    :'—'}
                </div>
              </div>
            </div>

            {/* COL 3: current segment detail / candidate confirm */}
            <div className="s2-detail-col">
              {candidatePreview?(()=>{
                const origComp=compositions.find(c=>c.id===candidatePreview.compId)
                const origSeg=origComp?.segments[candidatePreview.segIdx]
                const cand=candidatePreview.cand
                const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                const candSubText=getSegSubtitleFromAna(cand,uploadedVideos[cand.videoIndex]?.id,videoAnalysis)
                return (
                  <div className="s2-detail-body">
                    <div className="s2-detail-head s2-detail-head-cand">
                      <span className="s2-detail-mode-tag">候选预览</span>
                    </div>
                    <div className="r3-pos-info">
                      <span className="r3-pos-comp">{origComp?.name}</span>
                      <span className="r3-pos-dot">·</span>
                      <span className="r3-pos-idx">将替换第 {candidatePreview.segIdx+1} 段</span>
                    </div>
                    <div className="r3-current">
                      <div className="r3-cur-card">
                        <div className="s2-cand-replace-arrow">原：<span style={{color:SEG_TYPE_COLORS[origSeg?.type]||'#6366f1'}}>{origSeg?.label}</span> → 候：<span style={{color:ctc}}>{cand.label}</span></div>
                        <div className="r3-cur-top" style={{marginTop:4}}>
                          <span className="r3-cur-label" style={{color:ctc}}>{cand.label}</span>
                          <span className="r3-cur-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                          <span className="r3-cur-src">V{cand.videoIndex+1}</span>
                        </div>
                        <div className="r3-cur-time">{cand.startStr} – {cand.endStr} · {fmt(cand.endSec-cand.startSec)}</div>
                        {candSubText&&<div className="r3-cur-sub">{candSubText}</div>}
                      </div>
                    </div>
                    <div className="s2-cand-confirm-row">
                      <button className="s2-cand-confirm-btn" onClick={()=>{
                        replaceCompSeg(candidatePreview.compId,candidatePreview.segIdx,candidatePreview.cand)
                        showToast(`已替换为 ${candidatePreview.cand.label}`)
                        setCandidatePreview(null)
                      }}>✓ 确认替换</button>
                      <button className="s2-cand-cancel-btn" onClick={()=>setCandidatePreview(null)}>取消预览</button>
                    </div>
                  </div>
                )
              })():editingSeg?(()=>{
                return (
                  <div className="s2-detail-body">
                    <div className="s2-detail-head">
                      <span className="s2-detail-title">当前片段</span>
                      <button className="r3-back-btn r3-desel-btn" onClick={()=>{setEditingSeg(null);stopCompPlay()}}>取消</button>
                    </div>
                    {col3Seg&&(
                      <>
                        <div className="r3-pos-info">
                          <span className="r3-pos-comp">{col3Comp?.name}</span>
                          <span className="r3-pos-dot">·</span>
                          <span className="r3-pos-idx">第 {editingSeg.segIdx+1} 段 / 共 {col3Comp?.segments.length} 段</span>
                        </div>
                        <div className="r3-current">
                          <div className="r3-cur-card">
                            <div className="r3-cur-top">
                              <span className="r3-cur-label" style={{color:col3tc}}>{col3Seg.label}</span>
                              <span className="r3-cur-type" style={{color:col3tc,borderColor:col3tc+'44',background:col3tc+'18'}}>{col3Seg.type}</span>
                              <span className="r3-cur-src">V{col3Seg.videoIndex+1}</span>
                            </div>
                            <div className="r3-cur-time">{col3Seg.startStr} – {col3Seg.endStr} · {fmt(col3Seg.endSec-col3Seg.startSec)}</div>
                            {col3SubText&&<div className="r3-cur-sub">{col3SubText}</div>}
                          </div>
                        </div>
                        <div className="r3-ops-row">
                          <button className="r3-op-btn" disabled={editingSeg.segIdx===0}
                            onClick={()=>moveSegInComp(editingSeg.compId,editingSeg.segIdx,-1)}>← 前移</button>
                          <button className="r3-op-btn" disabled={editingSeg.segIdx>=(col3Comp?.segments.length||0)-1}
                            onClick={()=>moveSegInComp(editingSeg.compId,editingSeg.segIdx,+1)}>后移 →</button>
                          <button className={`comp-seg-lock${(lockedSegs[editingSeg.compId]||{})[editingSeg.segIdx]?' on':''}`}
                            style={{position:'static',opacity:1,fontSize:'12px',padding:'4px 8px'}}
                            onClick={()=>toggleLockSeg(editingSeg.compId,editingSeg.segIdx)}>
                            {(lockedSegs[editingSeg.compId]||{})[editingSeg.segIdx]?'🔒 已锁':'🔓 锁定'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })():(
                <div className="s2-detail-hint">点击下方成品预览条中的片段，查看详情和替换候选</div>
              )}
            </div>

            {/* COL 4: recommended candidates */}
            <div className="s2-recs-col">
              <div className="s2-recs-head">推荐候选{col3Seg&&<span className="r3-sec-hint">{col3Seg.type}优先</span>}</div>
              <div className="s2-recs-body">
                {!col3Seg&&<div className="s2-cands-hint">选中片段后显示推荐</div>}
                {recs.map(cand=>{
                  const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                  const isPreview=candidatePreview?.cand?.id===cand.id
                  const candSub=getSegSubtitleFromAna(cand,uploadedVideos[cand.videoIndex]?.id,videoAnalysis)
                  return (
                    <div key={cand.id}
                      className={`r3-cand-item${isPreview?' previewing':''}`}
                      onClick={()=>{
                        const next=isPreview?null:{cand,compId:editingSeg?.compId??col3Comp?.id??'',segIdx:editingSeg?.segIdx??0}
                        if(next) stopCompPlay()
                        setCandidatePreview(next)
                      }}>
                      <div className="r3-cand-top">
                        <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                        <span className="r3-cand-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                        <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                      </div>
                      <div className="r3-cand-time">{cand.startStr} – {cand.endStr}</div>
                      {candSub&&<div className="r3-cand-sub">{candSub.slice(0,36)}{candSub.length>36?'…':''}</div>}
                    </div>
                  )
                })}
                {col3Seg&&recs.length===0&&<div className="r3-no-recs"><div>暂无推荐</div></div>}
              </div>
            </div>

            {/* COL 5: all candidates */}
            <div className="s2-allcands-col">
              <div className="s2-allcands-head">全部候选 <span className="r3-all-count">{allCands.length}</span></div>
              <div className="s2-allcands-body">
                {allCands.map(cand=>{
                  const ctc=SEG_TYPE_COLORS[cand.type]||'#6366f1'
                  const isPreview=candidatePreview?.cand?.id===cand.id
                  const candSub=getSegSubtitleFromAna(cand,uploadedVideos[cand.videoIndex]?.id,videoAnalysis)
                  const canReplace=!!editingSeg
                  return (
                    <div key={cand.id}
                      className={`r3-cand-item r3-cand-sm${isPreview?' previewing':''}${!canReplace?' no-target':''}`}
                      onClick={()=>{
                        if(!canReplace) return
                        const next=isPreview?null:{cand,compId:editingSeg.compId,segIdx:editingSeg.segIdx}
                        if(next) stopCompPlay()
                        setCandidatePreview(next)
                      }}>
                      <div className="r3-cand-top">
                        <span className="r3-cand-label" style={{color:ctc}}>{cand.label}</span>
                        <span className="r3-cand-src">V{cand.videoIndex+1}</span>
                        <span className="r3-cand-type" style={{color:ctc,borderColor:ctc+'44',background:ctc+'18'}}>{cand.type}</span>
                        <span className="r3-cand-time">{cand.startStr}–{cand.endStr}</span>
                      </div>
                      {candSub&&<div className="r3-cand-sub r3-cand-sm-sub">{candSub.slice(0,30)}{candSub.length>30?'…':''}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )
      })()}
    </div>
    {/* BOTTOM: composition rows */}
    <div className={`s3-comp-section ${tlFlash?'tl-flash':''}`}>
      <div className="s3-comp-head">
        <div className="s3-comp-head-l">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          <span>成品视频方案</span>
          {compositions.length>0&&<span className="s3-comp-badge">{compositions.length} 个方案 · {totalSelectedSegs} 个片段</span>}
        </div>
        <div className="s3-comp-head-r">
          <span className="s3-comp-preview-hint">当前为组合方案预览，尚未生成真实视频</span>
          <button className="comp-undo-btn" disabled={!compUndoSnap} onClick={handleCompUndo}>↩ 撤销</button>
        </div>
      </div>
      {compositions.length===0&&(
        <div className="s3-comp-empty"><p>未找到可组合的片段，请返回字幕切片步骤勾选更多片段</p></div>
      )}
      <div className="s3-comp-list">
        {compositions.map(comp=>{
          const isActive=comp.id===selectedCompId
          const isManualEdited=!!compManualEdited[comp.id]
          const isThisPlaying=compIsPlaying&&compPlayCompId===comp.id
          const previewPos=compPreviewPos[comp.id]
          const playheadPct=comp.totalDur>0&&previewPos!=null
            ?Math.min(100,(previewPos/comp.totalDur)*100):-1
          return (
            <div key={comp.id} className={`comp-row ${isActive?'active':''}`} onClick={()=>setSelectedCompId(comp.id)}>
              <div className="comp-recipe-bar">
                <button
                  className={`comp-play-btn${isThisPlaying?' playing':''}`}
                  title={isThisPlaying?'暂停':'播放整条成品'}
                  onClick={e=>{
                    e.stopPropagation()
                    if(isThisPlaying) stopCompPlay()
                    else startCompPlay(comp.id)
                  }}>
                  {isThisPlaying
                    ?<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    :<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>}
                </button>
                <span className={`comp-radio ${isActive?'on':''}`}/>
                <span className="comp-recipe-name">{comp.name}</span>
                <span className="comp-recipe-sep">｜</span>
                <span className="comp-recipe-dur">预计 {fmt(comp.totalDur)}</span>
                <span className="comp-recipe-sep">｜</span>
                <span className="comp-recipe-cnt">{comp.segments.length} 片段</span>
                {isManualEdited&&<><span className="comp-recipe-sep">｜</span><span className="comp-manual-badge">已手动调整</span></>}
                <span className="comp-recipe-sep">｜</span>
                <span className="comp-recipe-order" title={comp.segments.map(s=>s.label).join(' → ')}>
                  {comp.segments.map(s=>s.label).join(' → ')}
                </span>
                <button className="comp-regen-btn" onClick={e=>{e.stopPropagation();regenCompRow(comp.id)}}>↻ 重新生成</button>
                <button className="comp-refine-btn" onClick={e=>{e.stopPropagation();enterRefine(comp.id)}}>✏ 进入精修</button>
              </div>
              <div className="comp-preview-bar"
                onMouseDown={e=>{
                  e.stopPropagation()
                  stopCompPlay()
                  const rect=e.currentTarget.getBoundingClientRect()
                  compTlDragRef.current={compId:comp.id,rect,totalDur:comp.totalDur}
                  const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))
                  const posSec=snapToSegBoundary(comp,ratio*comp.totalDur)
                  setCompPreviewPos(prev=>({...prev,[comp.id]:posSec}))
                  setEditingSeg({compId:comp.id,segIdx:findSegAtPos(comp,posSec)})
                  setSelectedCompId(comp.id)
                }}>
                {comp.segments.map((seg,si)=>{
                  const dur=seg.endSec-seg.startSec
                  const w=`${comp.totalDur>0?(dur/comp.totalDur)*100:(100/comp.segments.length)}%`
                  const stc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
                  const isSelected=editingSeg?.compId===comp.id&&editingSeg?.segIdx===si
                  const isLocked=(lockedSegs[comp.id]||{})[si]
                  return (
                    <div key={seg.id+'_'+si}
                      className={`comp-seg-blk${isSelected?' editing':''}${isLocked?' locked':''}`}
                      style={{width:w,background:stc+'cc',borderTop:`3px solid ${stc}`}}
                      title={`${seg.label} · ${seg.type} · V${seg.videoIndex+1}\n${seg.startStr}–${seg.endStr} · ${fmt(dur)}`}
                      onClick={e=>{
                        e.stopPropagation()
                        stopCompPlay()
                        setCandidatePreview(null)
                        setEditingSeg({compId:comp.id,segIdx:si})
                        setSelectedCompId(comp.id)
                        setCompPreviewPos(prev=>({...prev,[comp.id]:(() => {
                          let acc=0; for(let i=0;i<si;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec; return acc
                        })()}))
                      }}>
                      <span className="comp-seg-inline">{seg.label} · V{seg.videoIndex+1} · {fmt(dur)}</span>
                      <div className="comp-seg-move-btns" onClick={e=>e.stopPropagation()}>
                        {si>0&&<button className="comp-seg-mv" title="前移" onClick={e=>{e.stopPropagation();moveSegInComp(comp.id,si,-1)}}>←</button>}
                        {si<comp.segments.length-1&&<button className="comp-seg-mv" title="后移" onClick={e=>{e.stopPropagation();moveSegInComp(comp.id,si,+1)}}>→</button>}
                      </div>
                      <button className={`comp-seg-lock${isLocked?' on':''}`}
                        title={isLocked?'解锁此片段':'锁定此片段'}
                        onClick={e=>{e.stopPropagation();toggleLockSeg(comp.id,si)}}
                      >{isLocked?'🔒':'🔓'}</button>
                    </div>
                  )
                })}
                {playheadPct>=0&&(
                  <div className="comp-preview-playhead" style={{left:`${playheadPct}%`}}>
                    <div className="comp-preview-playhead-dot"/>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  </div>
)}

          {/* ── refine view (2C) v0.7 ── */}
          {subStep==='refine'&&(()=>{
            const comp=compositions.find(c=>c.id===refineCompId)
            if (!comp) return (
              <div className="refine-error">未找到成品方案 <button onClick={()=>setSubStep('compose')}>← 返回</button></div>
            )
            const compSubs=buildCompSubtitles(comp,videoAnalysis,uploadedVideos)
            const totalDur=comp.totalDur
            const playheadPct=totalDur>0?Math.min(100,(refinePrevPos/totalDur)*100):0
            const curSegIdx=refineSelSeg??findSegAtPos(comp,refinePrevPos)
            const curSeg=comp.segments[curSegIdx]
            const curVid=curSeg?uploadedVideos[curSeg.videoIndex]:null
            const curSubIdx=compSubs.findIndex(s=>refinePrevPos>=s.compStart&&refinePrevPos<s.compEnd)
            const rc=refinedComps[comp.id]||{}
            const scriptText=rc.summaryScript??''
            const copyTitle=rc.copyTitle??''
            const copyBody=rc.copyBody??''
            const editActions=rc.editActions||[]
            const isDeleted=si=>editActions.some(a=>a.type==='delete'&&a.segIdx===si)
            const getSpeed=si=>editActions.find(a=>a.type==='speed'&&a.segIdx===si)?.speed??1
            const deletedCount=editActions.filter(a=>a.type==='delete').length
            const selSubPrompt=SUBTITLE_PROMPTS.find(p=>p.key===refineSubPromptKey)
            const selCopyPrompt=COPY_PROMPTS.find(p=>p.key===refineCopyPromptKey)
            return (
              <div className="refine-view">
                {/* ── Banner ── */}
                <div className="refine-banner">
                  <button className="refine-back-btn" onClick={()=>{stopRefinePlay();setSubStep('compose')}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回组合方案
                  </button>
                  <span className="refine-banner-title">{comp.name} · 成品精修方案工作台</span>
                  {deletedCount>0&&<span className="refine-del-badge">{deletedCount} 段已标删</span>}
                  <div className="refine-proto-notice">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    所有修改保存进最终方案 · 暂未生成视频文件 · 后续导出阶段执行
                  </div>
                </div>

                {/* ── Top 3-column row ── */}
                <div className="refine-top">
                  {/* Col 1: Video preview */}
                  <div className="refine-vc">
                    <div className="refine-vc-head">
                      <span>预览</span>
                      <button className={`refine-tl-playbtn${refineIsPlaying?' playing':''}`}
                        onClick={()=>refineIsPlaying?stopRefinePlay():startRefinePlay(comp)}>
                        {refineIsPlaying
                          ?<><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>暂停</>
                          :<><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>播放</>}
                      </button>
                    </div>
                    <div className="refine-video-wrap" onClick={()=>{
                      const vid=refinePrevRef.current; if(!vid||!curVid) return
                      if(refineIsPlayingRef.current) stopRefinePlay()
                      else if(refineVidPlaying) vid.pause()
                      else startRefinePlay(comp)
                    }}>
                      {curVid?(
                        <video
                          ref={refinePrevRef}
                          key={curVid.id}
                          src={curVid.url}
                          preload="auto"
                          playsInline
                          className="refine-video"
                          onPlay={()=>setRefineVidPlaying(true)}
                          onPause={()=>setRefineVidPlaying(false)}
                          onLoadedMetadata={()=>{
                            const vid=refinePrevRef.current; if(!vid) return
                            vid.currentTime=refinePrevSeekRef.current??0
                            if(refineIsPlayingRef.current) vid.play().catch(()=>{})
                          }}
                          onTimeUpdate={()=>{
                            const vid=refinePrevRef.current; if(!vid) return
                            if(!refineIsPlayingRef.current) return
                            const c=compositionsRef.current.find(x=>x.id===refinePlayCompIdRef.current); if(!c) return
                            const segIdx=refinePlaySegIdxRef.current
                            const seg=c.segments[segIdx]; if(!seg) return
                            let acc=0; for(let i=0;i<segIdx;i++) acc+=c.segments[i].endSec-c.segments[i].startSec
                            const posInComp=acc+Math.max(0,vid.currentTime-seg.startSec)
                            setRefinePrevPos(posInComp)
                            setRefineSelSeg(segIdx)
                            if(vid.currentTime>=seg.endSec-0.15){
                              const nextIdx=segIdx+1
                              if(nextIdx>=c.segments.length){
                                vid.pause(); setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成')
                              } else {
                                const nextSeg=c.segments[nextIdx]
                                refinePlaySegIdxRef.current=nextIdx; setRefinePlaySegIdx(nextIdx)
                                if(nextSeg.videoIndex===seg.videoIndex){ vid.currentTime=nextSeg.startSec; vid.play().catch(()=>{}) }
                                else { refinePrevSeekRef.current=nextSeg.startSec }
                              }
                            }
                          }}
                          onEnded={()=>{
                            if(!refineIsPlayingRef.current) return
                            const c=compositionsRef.current.find(x=>x.id===refinePlayCompIdRef.current); if(!c) return
                            if(refinePlaySegIdxRef.current+1>=c.segments.length){ setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成') }
                          }}
                        />
                      ):(
                        <div className="refine-no-vid">点击时间轴选择片段</div>
                      )}
                      <div className={`refine-play-btn${refineVidPlaying?' playing':''}`}>
                        {refineVidPlaying
                          ?<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                          :<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>}
                      </div>
                    </div>
                    <div className="refine-video-meta">
                      {curSeg?(
                        <>
                          <span style={{color:SEG_TYPE_COLORS[curSeg.type]||'#6366f1',fontWeight:600}}>{curSeg.label}</span>
                          <span className="refine-vm-dot">·</span>
                          <span className="refine-vm-type">{curSeg.type}</span>
                          <span className="refine-vm-dot">·</span>
                          <span className="refine-vm-vsrc">V{curSeg.videoIndex+1}</span>
                        </>
                      ):<span className="refine-vm-hint">模拟预览</span>}
                      <span className="refine-vm-spacer"/>
                      <span className="refine-vm-time">{fmt(refinePrevPos)}/{fmt(totalDur)}</span>
                    </div>
                    {curSubIdx>=0&&compSubs[curSubIdx]&&(
                      <div className="refine-vc-cursub">{compSubs[curSubIdx].text}</div>
                    )}
                  </div>

                  {/* Col 2: Summary script */}
                  <div className="refine-sc">
                    <div className="refine-col-head">
                      <span>整条字幕汇总稿</span>
                      {rc.scriptModified&&<span className="refine-dirty-badge">已修改</span>}
                    </div>
                    <textarea
                      className="refine-textarea"
                      placeholder={'点击"从逐句字幕生成"自动填入，或直接粘贴 AI 改写后的口播稿...'}
                      value={scriptText}
                      onChange={e=>updateRefinedComp(comp.id,{summaryScript:e.target.value,scriptModified:true})}
                    />
                    <div className="refine-toolbar">
                      <button className="refine-tb-btn primary" onClick={()=>{
                        const s=buildSummaryScript(comp,videoAnalysis,uploadedVideos)
                        updateRefinedComp(comp.id,{summaryScript:s,scriptModified:true})
                        showToast('已从逐句字幕生成汇总稿')
                      }}>从逐句生成</button>
                      <button className="refine-tb-btn" onClick={()=>{
                        navigator.clipboard.writeText(scriptText).then(()=>showToast('已复制'))
                      }} disabled={!scriptText}>复制全部</button>
                      <button className="refine-tb-btn" onClick={()=>{
                        downloadTextFile(scriptText,`${comp.name}_字幕稿.txt`)
                      }} disabled={!scriptText}>导出 TXT</button>
                      <button className="refine-tb-btn" onClick={()=>{
                        downloadJSONFile({compositionId:comp.id,compositionName:comp.name,summaryScript:scriptText,exportedAt:new Date().toISOString()},`${comp.name}_字幕稿.json`)
                      }} disabled={!scriptText}>导出 JSON</button>
                      <button className="refine-tb-btn success" onClick={()=>saveRefinedPlan(comp.id)} disabled={!rc.scriptModified}>保存口播稿</button>
                    </div>
                    <div className="refine-prompt-section">
                      <div className="refine-prompt-head">字幕改写提示词 <span className="refine-prompt-hint">（复制后到 DeepSeek / 豆包 改写，结果粘回上方）</span></div>
                      <div className="refine-prompt-tabs">
                        {SUBTITLE_PROMPTS.map(p=>(
                          <button key={p.key}
                            className={`refine-prompt-tab${refineSubPromptKey===p.key?' active':''}`}
                            onClick={()=>setRefineSubPromptKey(refineSubPromptKey===p.key?null:p.key)}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {selSubPrompt&&(
                        <div className="refine-prompt-preview">
                          <div className="refine-prompt-text">{selSubPrompt.text}<span className="refine-prompt-placeholder">[在此处粘贴字幕]</span></div>
                          <button className="refine-tb-btn primary" onClick={()=>{
                            const full=selSubPrompt.text+(scriptText||'[请先生成汇总稿]')
                            navigator.clipboard.writeText(full).then(()=>showToast('提示词已复制'))
                          }}>复制提示词+字幕</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Col 3: Copywriting */}
                  <div className="refine-cc">
                    <div className="refine-col-head">
                      <span>标题 / 正文文案</span>
                      {rc.copyModified&&<span className="refine-dirty-badge">已修改</span>}
                    </div>
                    <label className="refine-copy-label">标题</label>
                    <input className="refine-copy-input"
                      placeholder="视频标题..."
                      value={copyTitle}
                      onChange={e=>updateRefinedComp(comp.id,{copyTitle:e.target.value,copyModified:true})}
                    />
                    <label className="refine-copy-label">正文文案</label>
                    <textarea className="refine-textarea refine-copy-body"
                      placeholder="正文文案..."
                      value={copyBody}
                      onChange={e=>updateRefinedComp(comp.id,{copyBody:e.target.value,copyModified:true})}
                    />
                    <div className="refine-toolbar">
                      <button className="refine-tb-btn" onClick={()=>{
                        navigator.clipboard.writeText(copyTitle).then(()=>showToast('标题已复制'))
                      }} disabled={!copyTitle}>复制标题</button>
                      <button className="refine-tb-btn" onClick={()=>{
                        navigator.clipboard.writeText(copyBody).then(()=>showToast('正文已复制'))
                      }} disabled={!copyBody}>复制正文</button>
                      <button className="refine-tb-btn success" onClick={()=>saveRefinedPlan(comp.id)} disabled={!rc.copyModified}>保存文案</button>
                    </div>
                    <div className="refine-prompt-section">
                      <div className="refine-prompt-head">文案改写提示词</div>
                      <div className="refine-prompt-tabs">
                        {COPY_PROMPTS.map(p=>(
                          <button key={p.key}
                            className={`refine-prompt-tab${refineCopyPromptKey===p.key?' active':''}`}
                            onClick={()=>setRefineCopyPromptKey(refineCopyPromptKey===p.key?null:p.key)}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      {selCopyPrompt&&(
                        <div className="refine-prompt-preview">
                          <div className="refine-prompt-text">{selCopyPrompt.text}<span className="refine-prompt-placeholder">[在此处粘贴字幕]</span></div>
                          <button className="refine-tb-btn primary" onClick={()=>{
                            const full=selCopyPrompt.text+(scriptText||'[请先生成汇总稿]')
                            navigator.clipboard.writeText(full).then(()=>showToast('提示词已复制'))
                          }}>复制提示词+字幕</button>
                        </div>
                      )}
                    </div>
                    <div className="refine-voice-section">
                      <div className="refine-voice-hint">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        后续导入新语音后，将自动生成新的逐句字幕时间轴，不需要手动逐句对齐。
                      </div>
                      <div className="refine-toolbar">
                        <button className="refine-tb-btn" disabled title="后续版本实现">+ 导入新语音</button>
                        <button className="refine-tb-btn" disabled title="后续版本实现">识别字幕时间轴</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Timeline ── */}
                <div className="refine-tl-section">
                  <div className="refine-tl-controls">
                    <button className={`refine-tl-playbtn${refineIsPlaying?' playing':''}`}
                      onClick={()=>refineIsPlaying?stopRefinePlay():startRefinePlay(comp)}>
                      {refineIsPlaying
                        ?<><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>暂停</>
                        :<><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>播放</>}
                    </button>
                    <span className="refine-tl-timestr">{fmt(refinePrevPos)} / {fmt(totalDur)}</span>
                    {deletedCount>0&&<span className="refine-tl-markct">{deletedCount} 段已标删</span>}
                    <span className="refine-tl-seg-hint">{comp.segments.length} 段 · 总时长 {fmt(totalDur)}</span>
                  </div>
                  <div className="refine-timeline"
                    onMouseDown={e=>{
                      e.stopPropagation()
                      stopRefinePlay()
                      const rect=e.currentTarget.getBoundingClientRect()
                      refineTlDragRef.current={compId:comp.id,rect,totalDur:comp.totalDur}
                      const ratio=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))
                      const pos=snapToSegBoundary(comp,ratio*comp.totalDur)
                      setRefinePrevPos(pos)
                      const sIdx=findSegAtPos(comp,pos)
                      setRefineSelSeg(sIdx)
                      let acc=0; for(let i=0;i<sIdx;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec
                      refinePrevSeekRef.current=comp.segments[sIdx].startSec+Math.min(Math.max(0,pos-acc),comp.segments[sIdx].endSec-comp.segments[sIdx].startSec-0.01)
                      const vid=refinePrevRef.current
                      if(vid&&vid.readyState>=2) vid.currentTime=refinePrevSeekRef.current
                    }}>
                    {comp.segments.map((seg,si)=>{
                      const dur=seg.endSec-seg.startSec
                      const w=`${totalDur>0?(dur/totalDur)*100:0}%`
                      const stc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
                      const isActive=si===curSegIdx
                      const deleted=isDeleted(si)
                      const spd=getSpeed(si)
                      return (
                        <div key={seg.id+'_'+si}
                          className={`refine-tl-seg${isActive?' active':''}${deleted?' deleted':''}`}
                          style={{width:w,background:deleted?'#33333388':stc+(isActive?'ee':'88'),borderTop:`3px solid ${deleted?'#555':stc}`}}>
                          <span className="refine-tl-seg-lbl">{deleted?'✕ ':''}{seg.label}{spd!==1?` ×${spd}`:''}</span>
                        </div>
                      )
                    })}
                    <div className="refine-tl-playhead" style={{left:`${playheadPct}%`}}>
                      <div className="refine-tl-ph-dot"/>
                    </div>
                  </div>
                </div>

                {/* ── Bottom row ── */}
                <div className="refine-bottom">
                  {/* Left: subtitle list (unchanged) */}
                  <div className="refine-sub-col">
                    <div className="refine-sub-head">
                      逐句字幕
                      <span className="refine-sub-cnt">{compSubs.length} 条</span>
                    </div>
                    <div className="refine-sub-list">
                      {compSubs.length===0&&<div className="refine-sub-empty">暂无字幕<br/>导入字幕后将按成品时间显示</div>}
                      {compSubs.map((sub,si)=>{
                        const isCur=si===curSubIdx
                        const segClr=SEG_TYPE_COLORS[comp.segments[sub.segIdx]?.type]||'#6366f1'
                        return (
                          <div key={sub.id}
                            className={`refine-sub-row${isCur?' active':''}`}
                            onClick={()=>{
                              stopRefinePlay()
                              const pos=snapToSegBoundary(comp,sub.compStart)
                              setRefinePrevPos(pos)
                              const sIdx=findSegAtPos(comp,pos)
                              setRefineSelSeg(sIdx)
                              let acc=0; for(let i=0;i<sIdx;i++) acc+=comp.segments[i].endSec-comp.segments[i].startSec
                              refinePrevSeekRef.current=comp.segments[sIdx].startSec+Math.min(Math.max(0,pos-acc),comp.segments[sIdx].endSec-comp.segments[sIdx].startSec-0.01)
                              const vid=refinePrevRef.current
                              if(vid&&vid.readyState>=2) vid.currentTime=refinePrevSeekRef.current
                            }}>
                            <div className="refine-sub-time">{fmt(sub.compStart)}</div>
                            <div className="refine-sub-content">
                              <span className="refine-sub-seg-dot" style={{background:segClr}} title={comp.segments[sub.segIdx]?.label}/>
                              <span className="refine-sub-text">{sub.text}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Right: ops panel */}
                  <div className="refine-ops-col">
                    {curSeg?(()=>{
                      const tc=SEG_TYPE_COLORS[curSeg.type]||'#6366f1'
                      const deleted=isDeleted(curSegIdx)
                      const spd=getSpeed(curSegIdx)
                      const dur=curSeg.endSec-curSeg.startSec
                      return (
                        <>
                          <div className="refine-ops-head">
                            <span>当前片段操作</span>
                            <button className="refine-save-plan-btn" onClick={()=>saveRefinedPlan(comp.id)}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                              保存精修方案
                            </button>
                          </div>
                          <div className="refine-seg-card">
                            <div className="refine-seg-card-top">
                              <span className="refine-seg-label" style={{color:tc}}>{curSeg.label}</span>
                              <span className="refine-seg-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{curSeg.type}</span>
                              <span className="refine-seg-vsrc">V{curSeg.videoIndex+1}</span>
                              {deleted&&<span className="refine-seg-del-badge">已标删</span>}
                              {spd!==1&&<span className="refine-seg-spd-badge">×{spd}</span>}
                            </div>
                            <div className="refine-seg-card-meta">{curSeg.startStr} – {curSeg.endStr} · {fmt(dur)}</div>
                            {curSubIdx>=0&&compSubs[curSubIdx]&&(
                              <div className="refine-seg-cursub">{compSubs[curSubIdx].text}</div>
                            )}
                          </div>
                          <div className="refine-ops-row">
                            {deleted?(
                              <button className="refine-op-btn restore" onClick={()=>toggleDeleteSeg(comp.id,curSegIdx)}>
                                ↩ 恢复这一段
                              </button>
                            ):(
                              <button className="refine-op-btn danger" onClick={()=>{
                                toggleDeleteSeg(comp.id,curSegIdx)
                                showToast(`${curSeg.label} 已标记删除 · 点击时间轴恢复`)
                              }}>
                                ✕ 删除这一段
                              </button>
                            )}
                          </div>
                          <div className="refine-speed-section">
                            <div className="refine-speed-label">调速</div>
                            <div className="refine-speed-row">
                              {[0.8,0.9,1,1.25,1.5,2].map(s=>(
                                <button key={s}
                                  className={`refine-speed-btn${spd===s?' active':''}`}
                                  onClick={()=>{setSegSpeed(comp.id,curSegIdx,s);showToast(`${curSeg.label} 速度设为 ×${s}`)}}>
                                  {s===1?'1× 默认':`×${s}`}
                                </button>
                              ))}
                            </div>
                          </div>
                          {editActions.length>0&&(
                            <div className="refine-actions-summary">
                              <div className="refine-actions-head">精修方案（{editActions.length} 项操作）</div>
                              {editActions.map(a=>(
                                <div key={a.id} className="refine-action-row">
                                  <span className="refine-action-type">{a.type==='delete'?'✕ 删除':'⏩ 调速'}</span>
                                  <span className="refine-action-target">{comp.segments[a.segIdx]?.label||`第${a.segIdx+1}段`}</span>
                                  {a.type==='speed'&&<span className="refine-action-val">×{a.speed}</span>}
                                  <button className="refine-action-del" onClick={()=>{
                                    updateRefinedComp(comp.id,{editActions:editActions.filter(x=>x.id!==a.id)})
                                  }}>↩</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })():(
                      <div className="refine-ops-empty">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity=".3"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                        <p>点击时间轴选择片段</p>
                        <p>可删除、调速或保存精修方案</p>
                        <button className="refine-save-plan-btn" style={{marginTop:10}} onClick={()=>saveRefinedPlan(comp.id)}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                          保存精修方案
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* 3-column workspace + bottom timeline (cut sub-step) */}
          {subStep==='cut'&&<><div className="s2-workspace">

            {/* LEFT: video list */}
            <div className="s2-left-panel">
              <div className="s2-left-head">
                <span className="s2-left-title">素材列表</span>
                <span className="s2-left-count">{uploadedVideos.length}</span>
              </div>
              <div className="s2-vid-manage-hint">如需删除或更换视频，请返回素材准备页操作</div>
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
                          {segs.length>0&&<><span className="s2-vid-meta-dot">·</span><span>{segs.length} 片段</span></>}
                          {ana?.status==='analyzing'&&<span className="s2-vid-item-st analyzing">{Math.round(ana.progress)}%</span>}
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
                        <div className="s2-vid-item-sub-src">
                          {ana?.subtitleSource==='real'
                            ? <span className="s2-vid-subsrc real">
                                真实字幕 {ana.subtitleCount}条
                                {(ana.subtitles?.filter(s=>s.corrected)?.length||0)>0&&
                                  <span className="s2-vid-corrected-pill"> · 已校对</span>}
                              </span>
                            : ana?.subtitleCount>0
                              ? <span className="s2-vid-subsrc sim">模拟字幕</span>
                              : <span className="s2-vid-subsrc none">未导入字幕</span>
                          }
                        </div>
                        {(ana?.status==='done'||ana?.status==='confirmed')&&(
                          <div className="s2-vid-confirm-row">
                            {ana.status==='confirmed'
                              ? <span className="s2-vid-confirm confirmed">✓ 切片已确认</span>
                              : <span className="s2-vid-confirm pending">切片未确认</span>
                            }
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

            {/* RIGHT: main work area */}
            <div className="s2-right-work">

              {/* TOP: fixed-size video card + newspaper subtitle columns */}
              <div className="s2-top-workspace">

                {/* Video preview card – fixed narrow width, fills height at 9:16 */}
                <div className="s2-video-card">
                  <div className="s2-vid-card-head">
                    <span className="s2-vid-card-title">预览</span>
                    {editorVidIdx>=0&&<span className="s2-right-vidnum">V{editorVidIdx+1}</span>}
                    {editorAnalysis?.status==='confirmed'&&<span className="s2-vid-confirmed-badge" style={{fontSize:'8px',padding:'1px 4px'}}>✓ 已确</span>}
                  </div>
                  <div className="s2-vid-card-preview">
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
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                          <span>选择视频</span>
                        </div>
                      )}
                      {editorVid&&editorAnalysis?.status==='waiting'&&(
                        <div className="s2-vid-overlay"><span>等待…</span></div>
                      )}
                      {editorVid&&editorAnalysis?.status==='analyzing'&&(
                        <div className="s2-vid-overlay">
                          <span className="s2-vid-analyzing-pct">{Math.round(editorAnalysis.progress)}%</span>
                          <div className="s2-vid-ana-bar"><div className="s2-vid-ana-bar-fill" style={{width:`${editorAnalysis.progress}%`}}/></div>
                        </div>
                      )}
                      {editorVid&&['done','confirmed'].includes(editorAnalysis?.status)&&(
                        <div className="s2-vid-hud">
                          <span className="s2-vid-timecode">{fmtMs(editorTime)}</span>
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
                            ? <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                            : <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                          }
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="s2-player-ctrl s2-vid-card-ctrl">
                    <button
                      className="s2-play-btn"
                      onClick={()=>{ setEditorPlaying(p=>{ if(p) setPlayingSegEnd(null); return !p }) }}
                      disabled={!editorVid||!['done','confirmed'].includes(editorAnalysis?.status)}
                    >
                      {editorPlaying
                        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
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
                    <span className="s2-time-disp" style={{fontSize:'9px'}}>{fmt(editorTime)}</span>
                  </div>
                  <div className="s2-vid-info s2-vid-card-info">
                    {editorVid?(
                      <>
                        <span className="s2-vid-info-name" title={editorVid.name} style={{maxWidth:'120px',fontSize:'10px'}}>{editorVid.name.replace(/\.[^.]+$/,'').slice(0,14)}</span>
                        <span className="s2-vid-info-tag">{editorVid.durStr}</span>
                      </>
                    ):<span className="s2-vid-info-none">未选择</span>}
                  </div>
                </div>

                {/* Subtitle newspaper columns */}
                <div className="s2-subtitle-workspace">
                  <div className="s2-sub-workspace-head">
                    <div className="s2-right-head">
                      <span className="s2-right-title">字幕列表</span>
                      {editorSubtitles.length>0&&<span className="s2-right-count">{editorSubtitles.length} 条</span>}
                      {correctedSubCount>0&&<span className="s2-sub-corrected-badge">✎ 已修改 {correctedSubCount} 条</span>}
                      {editorVidIdx>=0&&<span className="s2-right-vidnum" style={{marginLeft:'auto'}}>V{editorVidIdx+1}</span>}
                      {editorAnalysis?.subtitleSource==='real'&&<span className="s2-sub-src-head-badge">真实</span>}
                      <div className="s2-col-switcher">
                        {[1,2,3].map(n=>(
                          <button key={n} className={`s2-col-btn${subColCount===n?' active':''}`} onClick={()=>setSubColCount(n)} title={`${n}列显示`}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <div className="s2-sub-toolbar">
                      <span className={`s2-sub-source-badge${editorAnalysis?.subtitleSource==='real'?' real':' sim'}`}>
                        {editorAnalysis?.subtitleSource==='real'
                          ? `真实字幕 ${editorSubtitles.length}条`
                          : editorSubtitles.length>0 ? `模拟 ${editorSubtitles.length}条` : '未导入'
                        }
                      </span>
                      <button className="s2-sub-tool-btn" onClick={()=>subtitleFileRef.current?.click()} disabled={!editorVid} title="选择本地生成的 subtitles.json（不上传服务器）">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        导入字幕
                      </button>
                      <button className="s2-sub-tool-btn" onClick={()=>batchSubtitleFileRef.current?.click()} title="选多个 subtitles.json，按文件名自动匹配">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                        批量导入
                      </button>
                      <button className={`s2-sub-tool-btn s2-sub-tool-export${editorAnalysis?.subtitleSource==='real'?'':' disabled'}`} onClick={handleExportCorrectedSubtitles} title={editorAnalysis?.subtitleSource==='real'?'导出修正后的字幕 JSON':'当前视频没有真实字幕可导出'}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        导出修正
                      </button>
                      {editorVid&&editorAnalysis?.subtitleSource!=='real'&&(
                        <button className={`s2-sub-tool-btn s2-sub-guide-toggle${showImportGuide?' active':''}`} onClick={()=>setShowImportGuide(p=>!p)} title="查看字幕导入说明">
                          ? 说明
                        </button>
                      )}
                    </div>
                  </div>
                  {batchImportResult&&(
                    <div className="s2-batch-result-bar">
                      <div className="s2-batch-summary">
                        {batchImportResult.matched.length>0&&<span className="s2-batch-ok-pill">✓ {batchImportResult.matched.length} 个匹配</span>}
                        {batchImportResult.unmatched.length>0&&<span className="s2-batch-warn-pill">未匹配 {batchImportResult.unmatched.length} 个</span>}
                        {batchImportResult.errors.length>0&&<span className="s2-batch-err-pill">错误 {batchImportResult.errors.length} 个</span>}
                        <button className="s2-batch-detail-toggle" onClick={()=>setBatchResultExpanded(p=>!p)}>{batchResultExpanded?'收起':'查看详情'}</button>
                        <button className="s2-batch-result-close" onClick={()=>setBatchImportResult(null)}>✕</button>
                      </div>
                      {batchResultExpanded&&(
                        <div className="s2-batch-detail">
                          {batchImportResult.matched.map((m,i)=>(
                            <div key={i} className="s2-batch-detail-row ok">✓ {m.name}（{m.count}条）</div>
                          ))}
                          {batchImportResult.unmatched.map((n,i)=>(
                            <div key={i} className="s2-batch-detail-row warn">未匹配：{n}</div>
                          ))}
                          {batchImportResult.errors.map((e,i)=>(
                            <div key={i} className="s2-batch-detail-row err">{e}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="s2-subtitle-columns" ref={subListRef}>
                    {!editorVid&&<div className="s2-sub-empty" style={{width:'100%'}}>从左侧选择视频</div>}
                    {editorVid&&editorAnalysis?.status==='waiting'&&<div className="s2-sub-empty" style={{width:'100%'}}><span className="s2s-pulse" style={{display:'inline-block',marginRight:6}}/>等待分析…</div>}
                    {editorVid&&editorAnalysis?.status==='analyzing'&&<div className="s2-sub-empty" style={{width:'100%'}}><span className="s2s-pulse" style={{display:'inline-block',marginRight:6}}/>字幕识别中…</div>}
                    {splitIntoSubtitleColumns(editorSubtitles, subColCount).map((col, ci) => (
                      <div key={ci} className="s2-subtitle-col">
                        {col.subs.map((sub, localIdx) => {
                          const si = col.startIdx + localIdx
                          const isCurrent = currentSubIdx === si
                          const isSelected = selectedSubIdx === si
                          const segIdx = editorSegs.findIndex(s=>sub.startSec>=s.startSec&&sub.startSec<s.endSec)
                          const segTc = segIdx>=0?(SEG_TYPE_COLORS[editorSegs[segIdx].type]||'#6366f1'):'var(--txt-3)'
                          const isEditing = editingSubId === sub.id
                          return (
                            <div
                              key={sub.id}
                              className={`s2-sub-row ${isCurrent?'current':''} ${isSelected?'selected':''} ${sub.corrected?'corrected':''}`}
                              onClick={()=>{ if(!isEditing){ setSelectedSubIdx(si); handleEditorSeek(sub.startSec) } }}
                            >
                              <div className="s2-sub-card-meta">
                                <span className="s2-sub-num">#{si+1}</span>
                                <span className="s2-sub-time">{fmt(sub.startSec)}</span>
                                {segIdx>=0&&(
                                  <span className="s2-sub-seg" style={{color:segTc}}>
                                    {editorVidIdx>=0?editorVidIdx+1:'?'}-{segIdx+1}
                                  </span>
                                )}
                                {sub.corrected&&<span className="s2-sub-corrected-mark" title="已人工校对">✎</span>}
                                {!isEditing&&editorAnalysis?.subtitleSource==='real'&&(
                                  <button
                                    className="s2-sub-edit-btn"
                                    onClick={e=>{ e.stopPropagation(); setEditingSubId(sub.id); setEditingSubText(sub.text) }}
                                    title="编辑此条字幕"
                                  >编辑</button>
                                )}
                              </div>
                              {isEditing ? (
                                <div className="s2-sub-edit-area" onClick={e=>e.stopPropagation()}>
                                  <textarea
                                    className="s2-sub-edit-textarea"
                                    value={editingSubText}
                                    onChange={e=>setEditingSubText(e.target.value)}
                                    autoFocus
                                    rows={2}
                                  />
                                  <div className="s2-sub-edit-actions">
                                    <button className="s2-sub-edit-save" onClick={()=>handleSaveSubEdit(sub.id)}>保存</button>
                                    <button className="s2-sub-edit-cancel" onClick={()=>{ setEditingSubId(null); setEditingSubText('') }}>取消</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="s2-sub-text">{sub.text}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ))}
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
                  {editorVid&&editorAnalysis?.subtitleSource!=='real'&&showImportGuide&&(
                    <div className="s2-sub-import-guide">
                      <div className="s2-sub-guide-title">真实字幕导入流程</div>
                      <div className="s2-sub-guide-step">① 本地生成字幕：</div>
                      <div className="s2-sub-guide-cmd">npm run local:transcribe -- "video.mp4"</div>
                      <div className="s2-sub-guide-step">② 点击"导入字幕"选择 subtitles.json</div>
                      <div className="s2-sub-guide-step">③ 或"批量导入"选多个 subtitles.json，按文件名自动匹配</div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTTOM: timeline + segment cards */}
              <div className="s2-bottom-tl">
                <div className="s2-tl-head">
                  <button
                    className="s2-undo-btn"
                    onClick={handleUndo}
                    disabled={!prevSegmentsForUndo||prevSegmentsForUndo.videoId!==currentVideoId}
                    title="撤销上一步操作"
                  >↩ 撤销</button>
                  <button
                    className="s2-add-cut-btn"
                    onClick={addCutAtCurrentTime}
                    disabled={!editorVid||!['done','confirmed'].includes(editorAnalysis?.status)}
                    title={selectedSubIdx>=0&&editorSubtitles[selectedSubIdx]?`按字幕 #${selectedSubIdx+1} 起始时间切割`:'在当前播放时间点新增切割'}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    {selectedSubIdx>=0&&editorSubtitles[selectedSubIdx]?'按字幕切割':'切割'}
                  </button>
                  {selectedCutIdx!==null?(
                    <div className="s2-cut-adj">
                      <button className="s2-cut-adj-btn" onClick={()=>adjustCutPoint(selectedCutIdx,-0.5)}>◀ -0.5s</button>
                      <button className="s2-cut-adj-btn" onClick={()=>adjustCutPoint(selectedCutIdx,+0.5)}>+0.5s ▶</button>
                      <button className="s2-cut-adj-btn s2-cut-del-btn" onClick={()=>{ mergeSegs(selectedCutIdx); setSelectedCutIdx(null) }}>删除切点</button>
                      <button className="s2-cut-adj-btn" onClick={()=>setSelectedCutIdx(null)}>取消</button>
                    </div>
                  ):(
                    <span className="s2-tl-hint">
                      {selectedSubIdx>=0&&editorSubtitles[selectedSubIdx]
                        ? `切割点：字幕 #${selectedSubIdx+1} 起始 ${fmt(editorSubtitles[selectedSubIdx].startSec)}`
                        : '建议先点击字幕，再切割 · 点击切割线选中'
                      }
                    </span>
                  )}
                  <span className="s2-tl-title" style={{marginLeft:'auto'}}>
                    分段时间轴
                    {selectedCutIdx!==null&&editorSegs[selectedCutIdx]&&(
                      <span className="s2-cut-sel-info"> · 切割点 @ {fmt(editorSegs[selectedCutIdx]?.endSec)}</span>
                    )}
                  </span>
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
              </div>
            </div>
          </div></>}

          {/* footer — hidden in refine mode (banner has its own nav) */}
          {subStep!=='refine'&&<div className="step-footer">
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
          </div>}
        </div>
      )}

      {/* ══ STEP 3: 预览导出 */}
      {step===3&&(
        <div className="step3 step3-v2">

          {/* LEFT: composition list */}
          <aside className="s3v2-left">
            <div className="s3v2-list-head">
              <span>成品视频列表</span>
              <span className="s3v2-comp-count">{compositions.length} 个</span>
            </div>
            <div className="s3v2-comp-list">
              {compositions.length===0&&(
                <div className="s3v2-empty-hint">暂无成品方案，请返回第二步生成</div>
              )}
              {compositions.map((comp,ci)=>{
                const srcCount=new Set(comp.segments.map(s=>s.videoIndex)).size
                const isExp=exportedComps.has(comp.id)
                const isActive=selectedCompId===comp.id
                return (
                  <div key={comp.id}
                    className={`s3v2-comp-card${isActive?' active':''}${isExp?' exported':''}`}
                    onClick={()=>{ setSelectedCompId(comp.id); setS3SelSeg(null); setS3SimPlaying(false); setS3SimIdx(0) }}>
                    <div className="s3v2-comp-card-top">
                      <span className="s3v2-comp-num">成品 {ci+1}</span>
                      <span className={`s3v2-comp-badge${isExp?' exp':' wait'}`}>{isExp?'已导出':'待导出'}</span>
                    </div>
                    <div className="s3v2-comp-card-name">{comp.name}</div>
                    <div className="s3v2-comp-card-meta">
                      <span>{fmt(comp.totalDur)}</span>
                      <span>·</span>
                      <span>{comp.segments.length} 片段</span>
                      <span>·</span>
                      <span>{srcCount} 个源视频</span>
                    </div>
                    <div className="s3v2-comp-seg-strip">
                      {comp.segments.map((seg,si)=>(
                        <div key={seg.id+'_'+si} className="s3v2-strip-blk"
                          style={{flex:Math.max(seg.endSec-seg.startSec,0.5),background:SEG_TYPE_COLORS[seg.type]||'#6366f1'}}
                          title={seg.label}/>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="s3v2-left-footer">
              <button className="s3v2-back-btn" onClick={()=>{ setSubStep('compose'); setStep(2); setS3SimPlaying(false) }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                返回组合方案编辑
              </button>
            </div>
          </aside>

          {/* CENTER: storyboard preview + segment timeline */}
          <main className="s3v2-center">
            <div className="s3v2-preview-header">
              <div className="s3v2-preview-label">
                {selectedComp ? `当前预览：${selectedComp.name}` : '请从左侧选择成品视频'}
              </div>
              <div className="s3v2-proto-badge">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                原型预览 · 暂未生成真实视频文件
              </div>
            </div>

            <div className="s3v2-preview-screen">
              {selectedComp ? (
                <>
                  <div className="s3v2-storyboard">
                    {selectedComp.segments.map((seg,si)=>{
                      const dur=Math.max(seg.endSec-seg.startSec,0.1)
                      const tc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
                      const isSel=s3SelSeg?.compId===selectedComp.id&&s3SelSeg?.segIdx===si
                      const isSim=s3SimPlaying&&s3SimIdx===si
                      return (
                        <div key={seg.id+'_'+si}
                          className={`s3v2-sb-blk${isSel?' selected':''}${isSim?' simactive':''}`}
                          style={{flex:dur,borderTop:`3px solid ${tc}`,background:isSim?tc+'44':tc+'1a'}}
                          onClick={()=>setS3SelSeg({compId:selectedComp.id,segIdx:si})}>
                          <div className="s3v2-sb-label" style={{color:tc}}>{seg.label}</div>
                          <div className="s3v2-sb-type">{seg.type}</div>
                          <div className="s3v2-sb-dur">{fmt(dur)}</div>
                          <div className="s3v2-sb-src">V{seg.videoIndex+1}</div>
                          {isSel&&seg.subtitle&&<div className="s3v2-sb-sub">{seg.subtitle}</div>}
                        </div>
                      )
                    })}
                  </div>
                  <div className="s3v2-playctrl">
                    <button className="s3v2-play-btn" onClick={()=>{
                      if(s3SimPlaying){setS3SimPlaying(false);setS3SimIdx(0)}
                      else{setS3SimPlaying(true);setS3SimIdx(0)}
                    }}>
                      {s3SimPlaying
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> 停止预览</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg> 模拟预览</>
                      }
                    </button>
                    <span className="s3v2-play-hint">模拟逐段高亮 · 不播放真实视频</span>
                  </div>
                </>
              ) : (
                <div className="s3v2-no-sel">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity=".25"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 12h8M12 8v8"/></svg>
                  <p>从左侧选择成品视频以预览</p>
                </div>
              )}
            </div>

            {selectedComp&&(
              <div className="s3v2-seg-timeline">
                <div className="s3v2-seg-tl-head">
                  组合顺序 · {selectedComp.segments.map(s=>s.label).join(' → ')}
                </div>
                <div className="s3v2-seg-tl-list">
                  {selectedComp.segments.map((seg,si)=>{
                    const tc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
                    const isSel=s3SelSeg?.compId===selectedComp.id&&s3SelSeg?.segIdx===si
                    const dur=seg.endSec-seg.startSec
                    return (
                      <div key={seg.id+'seq'+si}
                        className={`s3v2-tl-item${isSel?' active':''}`}
                        onClick={()=>setS3SelSeg(isSel?null:{compId:selectedComp.id,segIdx:si})}>
                        <span className="s3v2-tl-num">{si+1}</span>
                        <span className="s3v2-tl-label" style={{color:tc}}>{seg.label}</span>
                        <span className="s3v2-tl-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{seg.type}</span>
                        <span className="s3v2-tl-src">V{seg.videoIndex+1}</span>
                        <span className="s3v2-tl-time">{seg.startStr} – {seg.endStr}</span>
                        <span className="s3v2-tl-dur">{fmt(dur)}</span>
                        {isSel&&seg.subtitle&&<div className="s3v2-tl-sub">{seg.subtitle}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </main>

          {/* RIGHT: export params + dedup + subtitle */}
          <aside className="s3v2-right">
            {s3SelSeg&&selectedComp&&(()=>{
              const seg=selectedComp.segments[s3SelSeg.segIdx]
              if(!seg) return null
              const tc=SEG_TYPE_COLORS[seg.type]||'#6366f1'
              return (
                <div className="s3v2-seg-detail">
                  <div className="s3v2-right-sec-head">
                    片段详情
                    <button className="s3v2-det-close" onClick={()=>setS3SelSeg(null)}>✕</button>
                  </div>
                  <div className="r3-cur-card">
                    <div className="r3-cur-top">
                      <span className="r3-cur-label" style={{color:tc}}>{seg.label}</span>
                      <span className="r3-cur-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{seg.type}</span>
                      <span className="r3-cur-src">V{seg.videoIndex+1}</span>
                    </div>
                    <div className="r3-cur-time">{seg.startStr} – {seg.endStr} · {fmt(seg.endSec-seg.startSec)}</div>
                    {seg.subtitle&&<div className="r3-cur-sub" style={{marginTop:6}}>{seg.subtitle}</div>}
                  </div>
                </div>
              )
            })()}

            {selectedComp&&(
              <div className="s3v2-right-section">
                <div className="s3v2-right-sec-head">导出文件</div>
                <div className="s3v2-param-grid">
                  <div className="s3v2-param-row s3v2-param-col">
                    <span>文件名</span>
                    <span className="s3v2-param-val s3v2-fname-val">
                      {`混剪成品_${selectedComp.name}_${new Date().toISOString().slice(0,10)}.mp4`}
                    </span>
                  </div>
                  <div className="s3v2-param-row s3v2-param-col">
                    <span>保存位置</span>
                    <span className="s3v2-param-val">本地默认导出文件夹（原型模拟）</span>
                  </div>
                </div>
              </div>
            )}

            <div className="s3v2-right-section">
              <div className="s3v2-right-sec-head">导出参数</div>
              <div className="s3v2-param-grid">
                <div className="s3v2-param-row"><span>格式</span><span className="s3v2-param-val">MP4 / H.264</span></div>
                <div className="s3v2-param-row">
                  <span>分辨率</span>
                  <div className="btn-row">{['720p','1080p'].map(r=><button key={r} className={`opt-btn ${exportRes===r?'active':''}`} onClick={()=>setExportRes(r)}>{r}</button>)}</div>
                </div>
                <div className="s3v2-param-row">
                  <span>帧率</span>
                  <div className="btn-row">{['24fps','30fps','60fps'].map(f=><button key={f} className={`opt-btn ${exportFps===f?'active':''}`} onClick={()=>setExportFps(f)}>{f}</button>)}</div>
                </div>
                <div className="s3v2-param-row">
                  <span>比例</span>
                  <div className="btn-row">{['9:16','1:1','16:9'].map(r=><button key={r} className={`opt-btn ${ratio===r?'active':''}`} onClick={()=>setRatio(r)}>{r}</button>)}</div>
                </div>
                <div className="s3v2-param-row">
                  <span>预计大小</span>
                  <span className="s3v2-param-val">~{Math.max(1,Math.round((selectedComp?.totalDur||30)*(exportRes==='1080p'?4.5:2)))} MB</span>
                </div>
              </div>
            </div>

            <div className="s3v2-right-section">
              <div className="s3v2-right-sec-head">去重方式 <span className="s3v2-dedup-cnt">{enabledDedupKeys.length} 项已启用</span></div>
              <div className="s3v2-dedup-tags">
                {Object.entries(DEDUP_META).map(([k,meta])=>(
                  <button key={k}
                    className={`s3v2-dedup-tag${dedup[k]?' on':''}`}
                    onClick={()=>setDedup(d=>({...d,[k]:!d[k]}))}
                    title={meta.desc}>
                    {meta.ico} {meta.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="s3v2-right-section">
              <div className="s3v2-right-sec-head">字幕设置 <span className="s3v2-sim-label">仅参数配置</span></div>
              <div className="s3v2-param-grid">
                <div className="s3v2-param-row">
                  <span>样式</span>
                  <div className="btn-row">{[['bold','粗体'],['outline','描边'],['card','卡片']].map(([s,l])=><button key={s} className={`opt-btn ${subStyle===s?'active':''}`} onClick={()=>setSubStyle(s)}>{l}</button>)}</div>
                </div>
                <div className="s3v2-param-row">
                  <span>位置</span>
                  <div className="btn-row">{[['top','顶部'],['center','居中'],['bottom','底部']].map(([p,l])=><button key={p} className={`opt-btn ${subPos===p?'active':''}`} onClick={()=>setSubPos(p)}>{l}</button>)}</div>
                </div>
                <div className="s3v2-param-row">
                  <span>描边</span>
                  <button className={`opt-btn ${subStroke?'active':''}`} onClick={()=>setSubStroke(p=>!p)}>{subStroke?'开':'关'}</button>
                </div>
              </div>
            </div>

            <div className="s3v2-export-btns">
              <button className="s3v2-exp-single" disabled={!selectedComp}
                onClick={()=>selectedComp&&handleExportOpen(selectedComp.id,selectedComp.name)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                {selectedComp?`模拟导出 ${selectedComp.name}`:'请先选择成品视频'}
              </button>
              <button className="s3v2-exp-batch" disabled={compositions.length===0}
                onClick={()=>compositions.length>0&&setShowBatchExport(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                批量导出全部（{compositions.length}）
              </button>
            </div>
          </aside>

          {showBatchExport&&(
            <BatchExportModal
              comps={compositions}
              exportRes={exportRes}
              exportFps={exportFps}
              ratio={ratio}
              dedup={dedup}
              onClose={()=>setShowBatchExport(false)}
              onComplete={ids=>setExportedComps(prev=>new Set([...prev,...ids]))}
            />
          )}
        </div>
      )}

    </div>
  )
}
