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
    { type:'开场' },
    { type:'食材准备' },
    { type:'制作步骤' },
    { type:'成品展示' },
    { type:'结尾' },
  ],
  [
    { type:'开场' },
    { type:'环境介绍' },
    { type:'产品展示' },
    { type:'评价' },
    { type:'结尾' },
  ],
  [
    { type:'开场' },
    { type:'背景介绍' },
    { type:'步骤演示' },
    { type:'步骤演示' },
    { type:'结尾' },
  ],
  [
    { type:'开场' },
    { type:'外观展示' },
    { type:'功能测试' },
    { type:'对比评测' },
    { type:'总结' },
  ],
  [
    { type:'开场' },
    { type:'景色展示' },
    { type:'游览记录' },
    { type:'美食打卡' },
    { type:'结尾' },
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
  { key:'polish',    label:'字幕润色',         text:'请帮我润色以下短视频口播字幕，要求：\n1. 保持口语化、自然流畅\n2. 适合短视频节奏，每句不超过 20 字\n3. 不改变核心意思，如有重复可适当删减\n\n字幕内容如下：\n' },
  { key:'pace',      label:'短视频节奏',        text:'请把以下字幕改写成适合短视频口播的稿子，要求：\n1. 每句话简短有力\n2. 语气轻松自然，适合快节奏视频\n3. 保持原内容核心，不要添加无关内容\n\n字幕内容如下：\n' },
  { key:'shorten',   label:'缩短口播',          text:'请帮我把以下字幕压缩，要求：\n1. 删除重复内容和过渡语句\n2. 保留核心信息\n3. 整体缩短 20–30%，保持口语化风格\n\n字幕内容如下：\n' },
  { key:'compress',  label:'压缩更短版本',       text:'请把以下字幕极度压缩，要求：\n1. 保留最核心的 3–5 句\n2. 去掉所有过渡、铺垫\n3. 适合在 30 秒以内讲完\n\n字幕内容如下：\n' },
  { key:'natural',   label:'更口语自然',         text:'请把以下字幕改得更像真人在说话，要求：\n1. 加入口语化表达\n2. 语气更亲切自然，可适当加入语气词\n3. 减少书面化表达\n\n字幕内容如下：\n' },
  { key:'emotional', label:'更有情绪感',         text:'请把以下字幕改得更有情绪感和故事感，要求：\n1. 加入更多情感描写和细节\n2. 让听众有代入感\n3. 语气生动，不平铺直叙\n\n字幕内容如下：\n' },
  { key:'voiceover', label:'适合配音稿',         text:'请根据以下字幕生成适合文字转语音（TTS）的配音稿，要求：\n1. 语句流畅，适合朗读\n2. 避免特殊符号，每句控制在 15–20 字以内\n3. 适合标准普通话朗读\n\n字幕内容如下：\n' },
  { key:'smooth',    label:'更顺口保持原意',     text:'请把以下字幕在不改变原意的前提下，改得更加顺口流畅，要求：\n1. 不改变核心信息\n2. 读起来更顺，没有别扭的停顿\n3. 每句控制在合理长度\n\n字幕内容如下：\n' },
]

const COPY_TASKS = [
  { key:'referenceTitle',      label:'对标标题',       placeholder:'粘贴对标视频的标题，供 AI 参考改写...' },
  { key:'finalTitle',          label:'我的标题',        placeholder:'粘贴 AI 改写好的标题，或直接填写...' },
  { key:'referenceWechatBody', label:'对标公众号正文',   placeholder:'粘贴对标公众号文章正文，供 AI 参考改写...' },
  { key:'finalWechatBody',     label:'我的公众号正文',   placeholder:'粘贴 AI 改写好的公众号正文...' },
  { key:'referenceXhs',        label:'对标小红书正文',   placeholder:'粘贴对标小红书笔记正文，供 AI 参考...' },
  { key:'finalXhs',            label:'我的小红书正文',   placeholder:'粘贴 AI 改写好的小红书正文...' },
]

// Prompts live on REFERENCE tasks (arrays for multiple variants).
// Final tasks have null (user just pastes AI result and saves).
const COPY_PROMPT_MAP = {
  referenceTitle: [
    { key:'short_video', label:'短视频标题', text:'请参考【对标标题】的表达方式、情绪、卖点和吸引力，结合【我的视频字幕/口播稿】，为我的视频生成 5 个适合短视频平台的标题。\n\n要求：\n1. 不要照抄对标标题\n2. 保留对标标题的吸引力和结构\n3. 标题要自然、有点击欲\n4. 适合中文短视频/图文内容\n5. 每个标题不超过 30 字\n\n【对标标题】\n' },
    { key:'xhs_title',   label:'小红书标题', text:'请参考【对标标题】，结合【我的视频字幕/口播稿】，为我的内容生成 5 个适合小红书的标题。\n\n要求：\n1. 小红书风格，可以活泼亲切\n2. 加入关键词，方便被搜索\n3. 可以加 emoji，但不超过 2 个\n4. 每个标题不超过 25 字\n\n【对标标题】\n' },
    { key:'wechat_title',label:'公众号标题', text:'请参考【对标标题】，结合【我的视频字幕/口播稿】，为我的内容生成 5 个适合公众号的推文标题。\n\n要求：\n1. 公众号风格，可以有一些悬念感\n2. 引发读者点击欲望\n3. 适合图文推文格式\n4. 每个标题不超过 25 字\n\n【对标标题】\n' },
    { key:'clickbait',   label:'更有点击欲', text:'请参考【对标标题】，结合【我的视频字幕/口播稿】，生成 5 个点击欲极强的标题。\n\n要求：\n1. 用问题、数字、对比等方式增强点击欲\n2. 不要夸张虚假，要真实可信\n3. 保留对标标题的情绪结构\n\n【对标标题】\n' },
    { key:'life',        label:'生活化不夸张',text:'请参考【对标标题】，结合【我的视频字幕/口播稿】，生成 5 个生活化、不夸张的标题。\n\n要求：\n1. 真实亲切，像朋友推荐\n2. 不用夸大词、不用"绝""最"等\n3. 贴近生活场景\n\n【对标标题】\n' },
    { key:'food_tut',    label:'美食/教程类',  text:'请参考【对标标题】，结合【我的视频字幕/口播稿】，生成 5 个适合美食或教程类内容的标题。\n\n要求：\n1. 突出"学会"或"能做"的获得感\n2. 简洁直接，易于搜索\n3. 适合美食或技巧教程类内容\n\n【对标标题】\n' },
  ],
  referenceWechatBody: [
    { key:'standard',    label:'参考对标生成', text:'请参考【对标公众号正文】的结构、叙述顺序、情绪和表达风格，结合【我的视频字幕/口播稿】，为我的内容改写一篇公众号正文。\n\n要求：\n1. 不要照抄对标正文\n2. 保留对标正文的叙事结构和情绪推进\n3. 内容要替换成我的视频内容\n4. 语言自然，适合公众号正文\n5. 可以适当补充生活化背景，但不要编造离谱信息\n\n【对标公众号正文】\n' },
    { key:'structure',   label:'保留结构替换', text:'请保留【对标公众号正文】的段落结构和各段功能（开头钩子、中间推进、结尾呼吁），把内容替换成【我的视频字幕/口播稿】的内容。\n\n要求：\n1. 段落结构和数量基本一致\n2. 用我的内容替换每段的具体信息\n3. 不要照抄原文表达\n\n【对标公众号正文】\n' },
    { key:'story',       label:'故事感更强',   text:'请参考【对标公众号正文】的风格，结合【我的视频字幕/口播稿】，写一篇故事感更强的公众号正文。\n\n要求：\n1. 用叙事手法，有起承转合\n2. 加入细节和场景描写\n3. 让读者有代入感\n4. 适合公众号正文\n\n【对标公众号正文】\n' },
    { key:'tutorial',    label:'教程型正文',   text:'请参考【对标公众号正文】的风格，结合【我的视频字幕/口播稿】，写一篇教程型公众号正文。\n\n要求：\n1. 有清晰的步骤或要点\n2. 语言简洁，方便读者操作\n3. 可以加粗关键步骤\n4. 结尾有互动或行动号召\n\n【对标公众号正文】\n' },
    { key:'life_share',  label:'生活分享型',   text:'请参考【对标公众号正文】，结合【我的视频字幕/口播稿】，写一篇生活分享型公众号正文。\n\n要求：\n1. 语气温暖亲切\n2. 像真人真实分享，不像广告\n3. 有生活感和细节\n4. 适合生活类内容\n\n【对标公众号正文】\n' },
    { key:'natural_pov', label:'更真实真人感', text:'请参考【对标公众号正文】，结合【我的视频字幕/口播稿】，写一篇更像真人分享的公众号正文。\n\n要求：\n1. 第一人称视角，真实感强\n2. 语言自然，不刻意\n3. 可以加入自己的感受和思考\n4. 不要像企业宣传\n\n【对标公众号正文】\n' },
  ],
  referenceXhs: [
    { key:'standard',    label:'参考对标生成', text:'请参考【对标小红书正文】的开头钩子、情绪、卖点和表达节奏，结合【我的视频字幕/口播稿】，为我的内容改写一篇小红书正文。\n\n要求：\n1. 不要照抄对标正文\n2. 更生活化、更有分享感\n3. 开头要有吸引力\n4. 适合小红书发布\n5. 可以加入适当 emoji，但不要太多\n\n【对标小红书正文】\n' },
    { key:'grass',       label:'更种草生活化', text:'请参考【对标小红书正文】，结合【我的视频字幕/口播稿】，改写一篇更有种草感和生活化的小红书正文。\n\n要求：\n1. 读起来像朋友在推荐\n2. 有真实体验感，不像广告\n3. 多用生活化词汇\n4. 加入合适 emoji\n\n【对标小红书正文】\n' },
    { key:'food_tut',    label:'美食教程版',   text:'请参考【对标小红书正文】，结合【我的视频字幕/口播稿】，写一篇适合美食或教程类的小红书正文。\n\n要求：\n1. 开头说明做什么\n2. 步骤清晰，便于跟做\n3. 结尾有互动问题或评论引导\n4. 加入合适 emoji\n\n【对标小红书正文】\n' },
    { key:'hook',        label:'开头更抓人',   text:'请参考【对标小红书正文】，结合【我的视频字幕/口播稿】，写一篇开头极其抓人的小红书正文。\n\n要求：\n1. 第一句必须让人想继续看\n2. 可以用问题、反差、悬念开头\n3. 后面自然展开内容\n4. 加入合适 emoji\n\n【对标小红书正文】\n' },
    { key:'short',       label:'简短口语版',   text:'请参考【对标小红书正文】，结合【我的视频字幕/口播稿】，写一篇简短口语化的小红书正文。\n\n要求：\n1. 200 字以内\n2. 口语化，读起来像说话\n3. 抓住一个核心卖点\n4. 结尾加 1–2 个 hashtag\n\n【对标小红书正文】\n' },
    { key:'family',      label:'家庭日常分享', text:'请参考【对标小红书正文】，结合【我的视频字幕/口播稿】，写一篇适合宝妈或家庭日常分享的小红书正文。\n\n要求：\n1. 温暖亲切，贴近家庭日常\n2. 强调实用性和性价比\n3. 语气像在群里分享心得\n4. 加入合适 emoji\n\n【对标小红书正文】\n' },
  ],
  finalTitle: null,
  finalWechatBody: null,
  finalXhs: null,
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
    subtitle: '',   // 不注入假字幕；真实字幕由字幕 JSON 导入后覆盖
    selected: true,  // 基础分段默认全选，用户手动取消才排除
  }))
}

// Build segments from real subtitle segments.
// Accepts both {start,end,text} (raw from /transcribe-video or JSON import)
// and {startSec,endSec,text} (internal format) — uses whichever is present.
// Algorithm: group 2-4 subtitles per segment targeting 5-15 s duration.
function generateSegmentsFromSubtitles(video, vidIndex, subs) {
  if (!subs || !subs.length) return []

  // Normalise: accept either .start/.end or .startSec/.endSec
  const ns = subs.map(s => ({
    ...s,
    _start: s.start    ?? s.startSec ?? 0,
    _end:   s.end      ?? s.endSec   ?? 0,
  }))

  const TARGET_MAX_DUR = 15  // split before segment exceeds this
  const MIN_SUBS = 2
  const MAX_SUBS = 4

  // Greedy: keep adding subs until we've hit MIN_SUBS + (MAX_SUBS or time limit)
  const groups = []
  let i = 0
  while (i < ns.length) {
    const g = [ns[i]]
    let j = i + 1
    while (j < ns.length) {
      const dur = ns[j]._end - g[0]._start
      if (g.length >= MIN_SUBS && (g.length >= MAX_SUBS || dur >= TARGET_MAX_DUR)) break
      g.push(ns[j])
      j++
    }
    groups.push(g)
    i = j
  }

  // Merge trailing singleton into previous group
  if (groups.length >= 2 && groups[groups.length - 1].length < 2) {
    const tail = groups.pop()
    groups[groups.length - 1] = groups[groups.length - 1].concat(tail)
  }

  const totalGroups = groups.length
  const getType = gi => {
    if (gi === 0)                                  return '开场'
    if (gi === totalGroups - 1)                    return '结尾'
    if (totalGroups >= 4 && gi === totalGroups - 2) return '成品展示'
    return '制作步骤'
  }

  return groups.map((g, gi) => {
    const startSec    = g[0]._start
    const endSec      = g[g.length - 1]._end
    const type        = getType(gi)
    const subtitle    = g.map(s => s.text.trim()).filter(Boolean).join(' ')
    const subtitleIds = g.map(s => s.id).filter(Boolean)
    return {
      id:          `${video.id}-rs${gi}`,
      startSec,
      endSec,
      startStr:    fmt(startSec),
      endStr:      fmt(endSec),
      type,
      subtitle,
      subtitleIds,
      selected:    true,  // 真实字幕分段默认全选
    }
  })
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

// v0.7.4-hotfix: subtitles based on editSegs (respects cut/delete/speed)
function buildCompSubtitlesFromEditSegs(editSegs, videoAnalysis, uploadedVideos) {
  if (!editSegs || !editSegs.length) return []
  const result = []
  let acc = 0
  editSegs.forEach((es) => {
    if (es.deleted) return
    const rawDur = Math.max(0, es.endSec - es.startSec)
    const spd = es.speed ?? 1
    const actualDur = rawDur / Math.max(0.1, spd)
    const vid = uploadedVideos[es.videoIndex]
    const ana = videoAnalysis?.[vid?.id]
    if (ana?.subtitles?.length) {
      ana.subtitles
        .filter(s => s.startSec < es.endSec && s.endSec > es.startSec)
        .forEach((s, oi) => {
          const clipStart = Math.max(s.startSec, es.startSec)
          const clipEnd   = Math.min(s.endSec,   es.endSec)
          result.push({
            id: `${es.id}-csub-${oi}`,
            text: s.text,
            compStart: +(acc + (clipStart - es.startSec) / spd).toFixed(2),
            compEnd:   +(acc + (clipEnd   - es.startSec) / spd).toFixed(2),
            segIdx: es.origSegIdx,
            esId: es.id,
          })
        })
    }
    acc += actualDur
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

// editSegs timeline (v0.7.4): synthesizes `seg` shape compatible with render/playback
function buildEditTimeline(editSegs) {
  let acc = 0
  const segments = []
  ;(editSegs||[]).forEach(es => {
    if (es.deleted) return
    const rawDur = es.endSec - es.startSec
    const spd = es.speed ?? 1
    const actualDur = rawDur / Math.max(0.1, spd)
    const seg = { videoIndex: es.videoIndex, startSec: es.startSec, endSec: es.endSec, label: es.label, type: es.type||'', subtitle:'', startStr: fmt(es.startSec), endStr: fmt(es.endSec) }
    segments.push({ segIdx: es.origSegIdx, esId: es.id, seg, compStart: acc, compEnd: acc + actualDur, actualDur, speed: spd })
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

// v0.9.8: Export pre-check modal ─────────────────────────────────────────────
function ExportCheckModal({ rc, comp, sourceVideos, onClose, onConfirm, exporting, mode = 'video' }) {
  const voice = rc.voice || rc.voiceMeta
  const stickers = rc.stickers || []
  const dedupeEffects = rc.dedupeEffects || []
  const bgEffects = rc.backgroundEffects || []
  const fmtT = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t/60), s = Math.floor(t%60); return `${m}:${String(s).padStart(2,'0')}` }
  const checks = []

  // ── 强拦截项 ──────────────────────────────────────────────────────────────
  const hasSegs = !!(rc.editSegs?.length > 0 ||
    (comp?.segments?.length > 0 &&
     (rc.deletedSegIdxs?.length || 0) < (comp?.segments?.length || 0)))
  checks.push({
    type: hasSegs ? 'ok' : 'error',
    label: '视频片段',
    detail: hasSegs ? `${comp?.segments?.length || 0} 个片段已就绪` : '无视频片段，无法导出',
  })

  // 配音：不再因为未导入 / 未同步 阻止导出
  const voiceOk = !!(voice?.storedFileName)
  const voiceWarn = !!(voice && !voice.storedFileName)
  if (voiceOk) {
    checks.push({
      type: 'ok',
      label: '本条配音',
      detail: `已同步 · ${voice.originalName || voice.fileName || ''}`,
    })
  } else if (voiceWarn) {
    checks.push({
      type: 'warn',
      label: '本条配音',
      detail: '配音未同步到本地服务，仍可继续导出（建议导出后重新同步）',
    })
  } else {
    checks.push({
      type: 'warn',
      label: '本条配音',
      detail: '尚未导入本条配音，仍可继续导出（成品将不包含配音轨）',
    })
  }

  // ── 软提示项（不拦截） ────────────────────────────────────────────────────
  const hasFinalSubs = !!(rc.finalSubtitles?.length > 0)
  const subsSaved = !!rc.finalSubtitlesSavedAt
  const subsAligned = rc.subtitleAlign?.status === 'aligned'
  if (!hasFinalSubs) {
    checks.push({ type: 'warn', label: '成品字幕', detail: '未找到字幕，将只导出视频轨' })
  } else if (!subsSaved) {
    checks.push({ type: 'warn', label: '成品字幕', detail: `${rc.finalSubtitles.length} 句（未保存），建议先保存` })
  } else if (!subsAligned) {
    checks.push({ type: 'warn', label: '成品字幕', detail: `已保存 ${rc.finalSubtitles.length} 句，但未自动对齐配音` })
  } else {
    checks.push({ type: 'ok', label: '成品字幕', detail: `已保存 ${rc.finalSubtitles.length} 句 · 已自动对齐配音` })
  }

  checks.push({
    type: 'ok', label: '字幕样式',
    detail: rc.subtitleStyle ? '已自定义样式' : '默认样式',
  })

  const rf = rc.reframe
  checks.push({
    type: 'ok', label: '取景',
    detail: rf?.enabled ? `${rf.aspect} · 缩放 ${(rf.scale * 100).toFixed(0)}%` : '默认（保留原比例）',
  })

  if (stickers.length > 0) {
    const textCount = stickers.filter(s => !s.isEmoji && s.text).length
    const emojiCount = stickers.filter(s => s.isEmoji).length
    const imgCount = stickers.filter(s => s.type === 'image').length
    const parts = []
    if (textCount) parts.push(`文字 ${textCount} 个（✅ 导出）`)
    if (emojiCount) parts.push(`emoji ${emojiCount} 个（⚠ 暂不导出）`)
    if (imgCount)   parts.push(`图片 ${imgCount} 个（⚠ 暂不导出）`)
    checks.push({ type: emojiCount > 0 || imgCount > 0 ? 'warn' : 'ok', label: '贴图（时间线）', detail: parts.join(' · ') + ` · 共 ${stickers.length} 段` })
  } else {
    checks.push({ type: 'ok', label: '贴图（时间线）', detail: '无' })
  }

  if (dedupeEffects.length > 0) {
    const lines = dedupeEffects.map(e => {
      const labels = Object.entries(e.params||{}).filter(([,v])=>v).map(([k])=>({mirror:'镜像',brightness:'亮度',contrast:'对比度',saturation:'饱和度',scale:'缩放',border:'边框'}[k]||k)).join('+')
      return `${fmtT(e.start)}-${fmtT(e.end)} ${labels||'无'}`
    }).join(' · ')
    checks.push({ type: 'ok', label: '去重 / 滤镜（时间线）', detail: `${dedupeEffects.length} 段 · ${lines}` })
  } else {
    checks.push({ type: 'ok', label: '去重 / 滤镜（时间线）', detail: '未添加' })
  }

  if (bgEffects.length > 0) {
    const unsynced = bgEffects.filter(e => !e.storedFileName).length
    checks.push({
      type: unsynced > 0 ? 'warn' : 'ok',
      label: '背景包装（时间线）',
      detail: unsynced > 0 ? `${bgEffects.length} 段，其中 ${unsynced} 段未同步将跳过` : `${bgEffects.length} 段 · ${bgEffects.map(e=>`${fmtT(e.start)}-${fmtT(e.end)}`).join(' · ')}`,
    })
  } else {
    checks.push({ type: 'ok', label: '背景包装（时间线）', detail: '未添加' })
  }

  checks.push({ type: 'ok', label: '导出画质', detail: '清晰度优先：所有效果合并为一次重编码，不加噪点' })

  const hasBlocker = checks.some(c => c.type === 'error')
  const ICON = { ok: '✅', warn: '⚠️', error: '❌' }

  const isJianying = mode === 'jianying'

  return (
    <div className="ecm-overlay" onClick={onClose}>
      <div className="ecm-panel" onClick={e => e.stopPropagation()}>
        <div className="ecm-header">
          <span className="ecm-title">{isJianying ? '导出到剪映草稿' : '导出前检查'}</span>
          <span className="ecm-comp-name">{comp?.name || ''}</span>
          <button className="ecm-close" onClick={onClose}>×</button>
        </div>
        {isJianying && (
          <div className="ecm-banner">
            将自动生成剪映草稿。如果当前没有可用成品视频，系统会先生成一个中间 mp4，再生成剪映草稿。
          </div>
        )}
        <div className="ecm-list">
          {checks.map((c, i) => (
            <div key={i} className={`ecm-row ${c.type}`}>
              <span className="ecm-ico">{ICON[c.type]}</span>
              <span className="ecm-label">{c.label}</span>
              <span className="ecm-detail">{c.detail}</span>
            </div>
          ))}
        </div>
        {hasBlocker && (
          <div className="ecm-blocker-hint">
            ❌ 缺少关键视频素材，无法继续导出。
          </div>
        )}
        <div className="ecm-actions">
          <button className="ecm-btn-cancel" onClick={onClose}>返回修改</button>
          <button className="ecm-btn-confirm" disabled={hasBlocker || exporting} onClick={onConfirm}>
            {exporting
              ? (isJianying ? '生成中…' : '导出中…')
              : (isJianying ? '继续导出剪映草稿' : '继续导出成品视频')}
          </button>
        </div>
      </div>
    </div>
  )
}

const REFRAME_ASPECTS = [
  {key:'保留原比例', label:'原比例', ratio:null},
  {key:'16:9', label:'16:9 横屏', ratio:16/9},
  {key:'4:3', label:'4:3 横版', ratio:4/3},
  {key:'3:4', label:'3:4 竖版', ratio:3/4},
  {key:'9:16', label:'9:16 竖屏', ratio:9/16},
  {key:'1:1', label:'1:1 方形', ratio:1},
  {key:'2:1', label:'2:1 宽幅', ratio:2},
  {key:'2.35:1', label:'2.35:1 影院', ratio:2.35},
]

const DEFAULT_SUB_STYLE = {
  fontFamily: 'Microsoft YaHei',
  fontSize: 72,
  color: 'white',
  outlineColor: 'black',
  outline: true,
  outlineWidth: 4,
  backgroundMode: 'none',
  backgroundColor: 'black',
  backgroundOpacity: 0.45,
  position: 'bottom',
  marginV: 60,
  subtitleX: null,
  subtitleY: null,
}
const FONT_OPTIONS = [
  ['Microsoft YaHei', '微软雅黑'],
  ['SimHei', '黑体'],
  ['SimSun', '宋体'],
  ['KaiTi', '楷体'],
  ['FangSong', '仿宋'],
  ['LiSu', '隶书'],
  ['YouYuan', '幼圆'],
  ['Arial', 'Arial'],
  ['Impact', 'Impact'],
]
const FONT_FAMILY_CSS = {
  'Microsoft YaHei': 'Microsoft YaHei,PingFang SC,sans-serif',
  'SimHei': 'SimHei,Heiti SC,sans-serif',
  'SimSun': 'SimSun,serif',
  'KaiTi': 'KaiTi,Kai,serif',
  'FangSong': 'FangSong,FangSong_GB2312,serif',
  'LiSu': 'LiSu,serif',
  'YouYuan': 'YouYuan,sans-serif',
  'Arial': 'Arial,Helvetica,sans-serif',
  'Impact': 'Impact,Haettenschweiler,sans-serif',
}
const COLOR_OPTIONS = [
  ['white', '#fff', '白'],
  ['yellow', '#ff0', '黄'],
  ['black', '#111', '黑'],
  ['red', '#f33', '红'],
  ['blue', '#48f', '蓝'],
  ['green', '#3c3', '绿'],
  ['orange', '#f90', '橙'],
  ['pink', '#f8a', '粉'],
  ['purple', '#b5f', '紫'],
]

const STICKER_PRESETS = [
  {key:'thumbs', emoji:'👍', label:'点赞', isEmoji:true},
  {key:'star',   emoji:'⭐', label:'星星', isEmoji:true},
  {key:'fire',   emoji:'🔥', label:'火爆', isEmoji:true},
  {key:'heart',  emoji:'❤️', label:'心心', isEmoji:true},
  {key:'arrow',  emoji:'➡️', label:'看这', isEmoji:true},
  {key:'wow',    emoji:'😱', label:'震惊', isEmoji:true},
  {key:'clap',   emoji:'👏', label:'鼓掌', isEmoji:true},
  {key:'bulb',   emoji:'💡', label:'干货', isEmoji:true},
  {key:'follow', text:'关注', label:'关注', isEmoji:false},
  {key:'save',   text:'收藏', label:'收藏', isEmoji:false},
  {key:'share',  text:'转发', label:'转发', isEmoji:false},
  {key:'learn',  text:'学会了', label:'学会了', isEmoji:false},
  {key:'step1',  text:'①', label:'步骤①', isEmoji:false},
  {key:'step2',  text:'②', label:'步骤②', isEmoji:false},
  {key:'hot',    text:'爆款', label:'爆款', isEmoji:false},
]

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
  const [editingSegSub, setEditingSegSub] = useState(null)  // {segIdx: number}
  const [editingSegSubText, setEditingSegSubText] = useState('')
  const [editingCompSub, setEditingCompSub] = useState(null)  // {compId, segIdx}
  const [editingCompSubText, setEditingCompSubText] = useState('')
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
  const [refineSubPromptKey, setRefineSubPromptKey] = useState(SUBTITLE_PROMPTS[0].key)
  const [refineCopyTask, setRefineCopyTask]     = useState('referenceTitle')
  const [refineCopyVariantKey, setRefineCopyVariantKey] = useState(null)

  // ── export-prep selected comp (v0.8.3-hotfix) ──
  const [epSelCompId, setEpSelCompId]           = useState(null)

  // ── export-prep local export service (v0.9.1) ──
  const [epExportStatus, setEpExportStatus]     = useState('idle') // 'idle'|'loading'|'success'|'error'
  const [epExportMsg, setEpExportMsg]           = useState('')
  // ── v0.9.7: refine-page quick export + subtitle auto-align ──
  const [refineExportStatus, setRefineExportStatus] = useState('idle') // 'idle'|'loading'|'success'|'error'
  const [refineExportMsg, setRefineExportMsg]       = useState('')
  const [lastExportedMp4, setLastExportedMp4]       = useState('')
  const [lastExportedMp4Sig, setLastExportedMp4Sig] = useState('') // full sig: id+segs+voice+subs+burnInSub
  const [lastJianyingMp4, setLastJianyingMp4]       = useState('') // clean mp4 for Jianying (no burned subs)
  const [lastJianyingMp4Sig, setLastJianyingMp4Sig] = useState('') // sig: id+segs+voice (no subs)
  const [jianyingExportStatus, setJianyingExportStatus] = useState('idle') // 'idle'|'loading'|'success'|'error'
  const [jianyingExportMsg, setJianyingExportMsg]       = useState('')
  // v0.9.10: 最近一次成功生成的剪映草稿路径（用于"打开草稿文件夹"按钮）
  const [lastJianyingDraftPath, setLastJianyingDraftPath] = useState('')
  const [lastJianyingDraftName, setLastJianyingDraftName] = useState('')
  // 剪映草稿导出选项：字幕轨 / 配音音频轨 / 视频原声
  // 配音音频轨当前版本不支持独立音频（配音已合成进 mp4）
  const [jianyingOpts, setJianyingOpts]               = useState({
    subtitle: true,
    voice: true,
    keepOriginalAudio: true,
  })
  const jianyingAudioTrackSupported = false  // TODO: export_with_pyjianying.py 支持独立音频轨时改为 true
  const [alignBusyId, setAlignBusyId]               = useState(null)   // compId currently aligning
  // ── v0.9.8: export pre-check modal + per-comp panels ──
  const [showExportCheck, setShowExportCheck]       = useState(false)
  const [exportCheckComp, setExportCheckComp]       = useState(null)   // {comp, rc, mode: 'video'|'jianying'} snapshot
  const [showBgWrapPanel, setShowBgWrapPanel]       = useState(false)

  // ── step-2 refine (v0.7) ──
  const [refineCompId, setRefineCompId]         = useState(null)
  const [refineMarks, setRefineMarks]           = useState({})      // {compId:[{id,type,targetType,segIdx,subIdx,compStart,compEnd}]}
  const [refineMarkUndo, setRefineMarkUndo]     = useState(null)    // previous marks[compId] for undo
  const [refinePrevPos, setRefinePrevPos]       = useState(0)       // playhead position in comp time
  const [refineIsPlaying, setRefineIsPlaying]   = useState(false)
  const [refinePlaySegIdx, setRefinePlaySegIdx] = useState(0)
  const [refineSelSeg, setRefineSelSeg]         = useState(null)    // explicitly selected segIdx
  const [refineVidPlaying, setRefineVidPlaying] = useState(false)   // actual video element play state
  const [refineVoicePlaying, setRefineVoicePlaying] = useState(false)
  const [refineVoicePos, setRefineVoicePos]         = useState(0)
  const [refineSelEsId, setRefineSelEsId]           = useState(null)  // selected edit-seg id (v0.7.4)
  const [refineTrimState, setRefineTrimState]       = useState(null)  // v0.7.5 trim drag preview: {esId,edge,previewStartSec,previewEndSec}
  const [refineSubTab, setRefineSubTab]   = useState('script') // v0.9.5: 'script'|'subs'
  const [splitMenuSubId, setSplitMenuSubId] = useState(null)  // v0.9.5h: open split-menu row
  const [subHistory, setSubHistory] = useState({})  // v0.9.5h2: per-comp subtitle undo history
  const [showSubStylePanel, setShowSubStylePanel] = useState(false)  // v0.9.5h4: per-comp style panel open
  const [showStickerPanel, setShowStickerPanel]   = useState(false)  // v0.9.6: sticker panel
  const [showDedupPanel, setShowDedupPanel]       = useState(false)  // v0.9.6: dedup in refine
  const [selectedEffectId, setSelectedEffectId]   = useState(null)   // v0.9.8h1: selected timeline effect

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
  const [burnInSub, setBurnInSub]   = useState(true)   // v0.9.3 burn summaryScript subtitles
  const [coverOrigSub, setCoverOrigSub]           = useState(false) // v0.9.3 cover bottom strip
  const [coverOrigSubHeight, setCoverOrigSubHeight] = useState('12%') // v0.9.3 strip height
  // v0.9.4: reframe canvas
  const [reframeEnabled, setReframeEnabled] = useState(false)
  const [reframeAspect, setReframeAspect]   = useState('16:9')
  const [reframeScale, setReframeScale]     = useState(1.10)
  const [reframeOffsetX, setReframeOffsetX] = useState(0)
  const [reframeOffsetY, setReframeOffsetY] = useState(0)
  // v0.9.4: original subtitle handling mode
  const [origSubMode, setOrigSubMode]       = useState('keep') // 'keep'|'crop'|'cover'
  // v0.9.4: subtitle style
  const [subFontFamily, setSubFontFamily]   = useState('Microsoft YaHei')
  const [subFontSize, setSubFontSize]       = useState(72)
  const [subColor, setSubColor]             = useState('white')
  const [subOutline, setSubOutline]         = useState(true)
  const [subOutlineColor, setSubOutlineColor] = useState('black')
  const [subOutlineWidth, setSubOutlineWidth] = useState(4)
  const [subBg, setSubBg]                   = useState('none') // 'none'|'black'|'white'|'yellow'
  const [subBgOpacity, setSubBgOpacity]     = useState(0.5)
  const [subPosition, setSubPosition]       = useState('bottom') // 'bottom'|'lower'|'middle'|'top'
  const [subMarginV, setSubMarginV]         = useState(60)
  // v0.9.5: background music
  const [bgmFile, setBgmFile]       = useState(null)  // {fileName, originalName, storedFileName, synced, duration}
  const [bgmVolume, setBgmVolume]   = useState(0.18)
  const [exportQuality, setExportQuality] = useState('高清')  // v0.9.5h: 标准/高清/超清
  const [dedup, setDedup] = useState({
    crop:true, scale:true, mirror:false, speed:true,
    bgImage:false, picInPic:false, subDistort:false, endImage:true,
  })
  const [toast, setToast] = useState('')
  const [batchImportResult, setBatchImportResult] = useState(null)
  const [batchResultExpanded, setBatchResultExpanded] = useState(false)
  const [showImportGuide, setShowImportGuide]     = useState(false)
  const [showAdvancedGuide, setShowAdvancedGuide] = useState(false)

  const timerRef              = useRef(null)
  const fileInputRef          = useRef(null)
  const videoRef              = useRef(null)
  const editorVideoRef        = useRef(null)
  const currentlyAnalyzingRef = useRef(null)
  const transcribeQueueRef    = useRef([])   // videoIds waiting to transcribe (sequential)
  const transcribingRef       = useRef(false) // true while one video is being transcribed
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
  const refineTlRef        = useRef(null)   // v0.7.5: timeline DOM element for trim drag
  const refineVoiceRef      = useRef(null)
  const refineVoiceInputRef = useRef(null)
  const refinePlanImportRef = useRef(null)    // v0.7.6: hidden file input for plan JSON import
  const refinePlayEsIdxRef  = useRef(0)       // index into active editTimeline.segments
  const refineEditTimelineRef = useRef(null)  // populated only during editSegs playback
  const rfDraggedRef = useRef(false)  // v0.9.5h: suppress click after reframe drag
  const subEditSnapRef = useRef(null) // v0.9.5h2: tracks focused subtitle to snapshot once per focus
  const subDragRef = useRef(false)    // v0.9.6: true while subtitle overlay is being dragged
  const bgWrapInputRef = useRef(null) // v0.9.8: background image file input
  const effTlRef = useRef(null)       // v0.9.8h1: effect timeline track element (for drag math)
  const effDragRef = useRef(null)     // v0.9.8h1: active effect drag state

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
  }, [step, uploadedVideos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── sequential analysis: base segments first, whisper runs in background ──

  function startNextAnalysis() {
    if (currentlyAnalyzingRef.current) return
    const videos   = uploadedVideosRef.current
    const analysis = videoAnalysisRef.current
    const waiting  = videos.find(v=>analysis[v.id]?.status==='waiting')
    if (!waiting) return
    currentlyAnalyzingRef.current = waiting.id

    const vid    = uploadedVideosRef.current.find(v=>v.id===waiting.id)
    const vidIdx = uploadedVideosRef.current.findIndex(v=>v.id===waiting.id)

    // ① 立刻生成时间等分基础分段，保证第 2 页无论如何都有内容可看
    const baseSegs = generateSegments(vid, vidIdx)
    setVideoAnalysis(prev=>{
      const next={
        ...prev,
        [waiting.id]:{
          status:'done', progress:100,
          segments:baseSegs, subtitleCount:0,
          subtitles:[], subtitleSource:'none',
          subtitleStatus:'pending',   // 字幕识别即将在后台启动
          subtitleError:null, subtitlePhase:null,
          phase:null,
        }
      }
      videoAnalysisRef.current=next
      return next
    })

    // ② 释放锁，继续处理队列中下一个视频
    currentlyAnalyzingRef.current=null
    setTimeout(startNextAnalysis, 100)

    // ③ 加入顺序识别队列（不并发，避免 Python 服务被阻塞）
    enqueueTranscribe(waiting.id)
  }

  // ── 顺序字幕识别队列（一次只处理一个视频） ──
  function enqueueTranscribe(videoId) {
    if (transcribeQueueRef.current.includes(videoId)) return  // 防重复
    transcribeQueueRef.current.push(videoId)
    if (!transcribingRef.current) drainTranscribeQueue()
  }

  async function drainTranscribeQueue() {
    if (transcribingRef.current) return
    const videoId = transcribeQueueRef.current.shift()
    if (!videoId) return
    transcribingRef.current = true
    try {
      const vid    = uploadedVideosRef.current.find(v=>v.id===videoId)
      const vidIdx = uploadedVideosRef.current.findIndex(v=>v.id===videoId)
      if (vid) await tryTranscribeBackground(videoId, vid, vidIdx)
    } finally {
      transcribingRef.current = false
      drainTranscribeQueue()  // 处理队列中下一个
    }
  }

  // 后台字幕识别：成功则替换字幕+分段，失败只标记错误，绝不清空 segments
  async function tryTranscribeBackground(videoId, vid, vidIdx) {
    const setSubState = (patch) =>
      setVideoAnalysis(prev=>{
        const next={...prev,[videoId]:{...prev[videoId],...patch}}
        videoAnalysisRef.current=next
        return next
      })

    setSubState({ subtitleStatus:'running', subtitlePhase:'连接本地服务…' })

    try {
      // 1. 检查本地服务 + whisper
      let healthData
      try {
        const hr = await fetch('http://127.0.0.1:8765/health', {
          signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
        })
        healthData = await hr.json()
      } catch(fetchErr) {
        const isTimeout = fetchErr?.name==='AbortError' || fetchErr?.name==='TimeoutError'
        throw {
          code:'NO_SERVICE',
          message: isTimeout
            ? '本地服务无响应（连接超时），请检查服务是否正常运行'
            : '本地识别服务未启动，请运行：python tools/local_export_server.py',
        }
      }
      if (!healthData?.whisper?.available) {
        const reason = healthData?.whisper?.reason || '未知原因'
        throw { code:'NO_WHISPER', message:`Whisper 未就绪：${reason}` }
      }

      // 2. 上传视频（若未同步）
      setSubState({ subtitlePhase:'上传视频…' })
      const currentVid = uploadedVideosRef.current.find(v=>v.id===videoId)
      let storedFileName = currentVid?.storedFileName
      if (!storedFileName) {
        const blob = await (await fetch(currentVid.url)).blob()
        const r    = await uploadToLocalService('/upload-video', blob, currentVid.name)
        storedFileName = r.fileName
        setUploadedVideos(prev=>prev.map(v=>
          v.id===videoId ? {...v,synced:true,storedFileName:r.fileName} : v
        ))
      }

      // 3. 字幕识别
      setSubState({ subtitlePhase:'识别字幕中…（需要几分钟）' })
      const controller = new AbortController()
      const timer = setTimeout(()=>controller.abort(), 15*60*1000)
      let td
      try {
        const tr = await fetch('http://127.0.0.1:8765/transcribe-video', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ storedFile: storedFileName }),
          signal: controller.signal,
        })
        td = await tr.json()
      } finally {
        clearTimeout(timer)
      }
      if (!td.ok) throw { code:'TRANSCRIBE_FAIL', message: td.error || '字幕识别失败' }

      // 4. 识别成功 → 用真实字幕更新分段（替换基础分段）
      const rawSegs = td.segments || []
      const freshVid    = uploadedVideosRef.current.find(v=>v.id===videoId)
      const freshVidIdx = uploadedVideosRef.current.findIndex(v=>v.id===videoId)
      const subs = rawSegs.map((s,i)=>({
        id:`sub-${videoId}-${i}`,
        startSec:s.start, endSec:s.end,
        text:s.text, start:s.start, end:s.end,
      }))
      const realSegs = generateSegmentsFromSubtitles(freshVid, freshVidIdx, subs)
      setSubState({
        segments:realSegs, subtitleCount:subs.length,
        subtitles:subs, subtitleSource:'real',
        subtitleStatus:'real', subtitleError:null, subtitlePhase:null,
      })
    } catch(err) {
      const isAbort = err?.name==='AbortError'
      const msg = isAbort
        ? '识别超时（超过15分钟），请检查 whisper.cpp 是否正常运行'
        : (err?.message || '字幕识别失败')
      // 失败只标记字幕错误，绝不清空 segments 或改 status
      setSubState({ subtitleStatus:'failed', subtitleError:msg, subtitlePhase:null })
    }
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

  function handleSaveSegSubEdit(segIdx, text) {
    const videoId = currentVideoId
    setVideoAnalysis(prev => {
      const segs = (prev[videoId]?.segments || []).map((s, i) =>
        i === segIdx ? { ...s, subtitle: text } : s
      )
      const next = { ...prev, [videoId]: { ...prev[videoId], segments: segs } }
      videoAnalysisRef.current = next
      return next
    })
    setEditingSegSub(null)
    setEditingSegSubText('')
  }

  function handleSaveCompSubEdit(compId, segIdx, text) {
    const comp = compositions.find(c => c.id === compId)
    if (!comp) return
    const seg = comp.segments[segIdx]
    if (!seg) return
    const vidId = uploadedVideos[seg.videoIndex]?.id
    const segInVid = seg.segInVid

    // Update videoAnalysis: replace matching subtitle items so getSegSubtitleFromAna returns
    // the edited text. Also update seg.subtitle fallback.
    setVideoAnalysis(prev => {
      const ana = prev[vidId] || {}
      const matchingSubs = (ana.subtitles || []).filter(
        s => s.startSec < seg.endSec && s.endSec > seg.startSec
      )
      let newSubs = ana.subtitles || []
      if (matchingSubs.length > 0) {
        const matchIds = new Set(matchingSubs.map(s => s.id))
        const firstStart = matchingSubs[0].startSec
        const lastEnd   = matchingSubs[matchingSubs.length - 1].endSec
        const editedSub = {
          id: `${seg.id}-edited-${Date.now()}`,
          startSec: firstStart, endSec: lastEnd,
          start: firstStart, end: lastEnd,
          text: text.trim() || text,
          corrected: true,
        }
        newSubs = [...(ana.subtitles || []).filter(s => !matchIds.has(s.id)), editedSub]
          .sort((a, b) => a.startSec - b.startSec)
      }
      const newSegs = segInVid != null
        ? (ana.segments || []).map((s, i) => i === segInVid ? { ...s, subtitle: text } : s)
        : (ana.segments || [])
      const next = { ...prev, [vidId]: { ...ana, subtitles: newSubs, segments: newSegs } }
      videoAnalysisRef.current = next
      return next
    })

    // Also update compositions directly so col3SubText recomputes immediately
    setCompositions(prev => prev.map(c => {
      if (c.id !== compId) return c
      const segs = c.segments.map((s, i) => i === segIdx ? { ...s, subtitle: text } : s)
      return { ...c, segments: segs }
    }))

    setEditingCompSub(null)
    setEditingCompSubText('')
  }

  function handleExportCorrectedSubtitles() {
    if (!currentVideoId) return
    const ana = videoAnalysis[currentVideoId]
    if (ana?.subtitleStatus !== 'real' || !ana?.subtitles?.length) {
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

  // v0.9.3: 上传文件到本地导出服务（自动同步素材）
  async function uploadToLocalService(endpoint, blob, originalName, extraFields={}) {
    const fd = new FormData()
    fd.append('file', blob, originalName)
    fd.append('originalName', originalName)
    for (const [k,v] of Object.entries(extraFields)) fd.append(k, String(v))
    const resp = await fetch(`http://127.0.0.1:8765${endpoint}`, { method:'POST', body:fd })
    const data = await resp.json()
    if (!data || !data.ok) throw new Error(data?.error || '同步失败')
    return data
  }

  async function handleFileSelect(e) {
    const files=Array.from(e.target.files); if (!files.length) return
    const idBase=Date.now()
    let syncedAny=false, serviceDown=false
    const newVideos=await Promise.all(files.map(async(file,i)=>{
      const url=URL.createObjectURL(file)
      const meta=await readVideoMeta(url)
      let synced=false, storedFileName=null, syncedAt=null
      try {
        const r=await uploadToLocalService('/upload-video', file, file.name)
        synced=true; storedFileName=r.fileName; syncedAt=new Date().toISOString(); syncedAny=true
      } catch(err) {
        if (err instanceof TypeError) serviceDown=true
      }
      return { id:idBase+i, name:file.name, originalName:file.name, storedFileName, synced, syncedAt,
        sizeStr:formatSize(file.size), dur:meta.dur||0, durStr:meta.dur>0?fmt(meta.dur):'—',
        res:meta.width>0?`${meta.width}×${meta.height}`:'—', url }
    }))
    setUploadedVideos(prev=>[...prev,...newVideos])
    setSelectedVideoId(prev=>prev??(newVideos[0]?.id??null))
    e.target.value=''
    if (serviceDown) showToast('本地导出服务未启动，当前只能预览；导出前请启动服务并在导出准备页点击同步')
    else if (syncedAny) showToast('视频已导入并自动同步到本地导出服务')
  }

  // v0.9.3: 同步指定成品用到的、尚未同步的原视频
  async function syncCompVideos(comp, rc) {
    const hasEditSegs=!!(rc.editSegs&&rc.editSegs.length>0)
    const {segments}=hasEditSegs?buildEditTimeline(rc.editSegs):buildDerivedTimeline(comp,rc.deletedSegIdxs,rc.speedMap)
    const usedIdx=[...new Set(segments.filter(ds=>!ds.seg?.deleted).map(ds=>ds.seg.videoIndex))]
    const pending=usedIdx.map(i=>uploadedVideos[i]).filter(v=>v&&!v.synced&&v.url)
    if (pending.length===0) { showToast('该成品的原视频均已同步'); return }
    let ok=0, down=false
    for (const v of pending) {
      try {
        const blob=await (await fetch(v.url)).blob()
        const r=await uploadToLocalService('/upload-video', blob, v.name)
        setUploadedVideos(prev=>prev.map(x=>x.id===v.id?{...x,synced:true,storedFileName:r.fileName,syncedAt:new Date().toISOString()}:x))
        ok++
      } catch(err) { if (err instanceof TypeError) down=true }
    }
    if (down) showToast('本地导出服务未启动，请先双击「启动本地导出服务.bat」，再点击同步')
    else showToast(`已同步 ${ok} 个原视频到本地导出服务`)
  }

  // v0.9.3: 同步指定成品的本条配音
  async function syncCompVoice(compId) {
    const rc=defaultRcFor(refinedComps[compId])
    const v=rc.voice
    if (!v||!v.url) { showToast('未找到可同步的配音，请重新导入'); return }
    try {
      const blob=await (await fetch(v.url)).blob()
      const r=await uploadToLocalService('/upload-audio', blob, v.originalName||v.fileName, {compId:String(compId)})
      updateRefinedComp(compId, { voice:{...v, storedFileName:r.fileName, synced:true, syncedAt:new Date().toISOString()} })
      showToast('本条配音已同步到本地导出服务')
    } catch(err) {
      if (err instanceof TypeError) showToast('本地导出服务未启动，请先双击「启动本地导出服务.bat」，再点击同步')
      else showToast('配音同步失败：'+(err.message||''))
    }
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
            subtitleSource:'real', subtitleStatus:'real', subtitleError:null,
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
          subtitleSource: 'real', subtitleStatus:'real', subtitleError:null,
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
    const videosWithoutRealSubtitles = uploadedVideos.filter(v => {
      const ana = videoAnalysisRef.current[v.id]
      return ana?.subtitleStatus !== 'real' || !(ana?.subtitles?.length > 0)
    })
    if (videosWithoutRealSubtitles.length) {
      const names = videosWithoutRealSubtitles.map(v => v.name).join('、')
      showToast(`字幕识别未完成或失败，请先完成真实字幕识别。${names ? `未完成：${names}` : ''}`)
      return
    }
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
    const aud=refineVoiceRef.current; if(aud) aud.pause()
    setRefineVoicePos(0)
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

    // editSegs mode (v0.7.4)
    if (rc.editSegs && rc.editSegs.length > 0) {
      const etl=buildEditTimeline(rc.editSegs)
      if (!etl.segments.length) { showToast('所有片段已删除，无法播放'); return }
      const currentPos=refinePrevPos
      const atEnd=currentPos>=etl.totalDuration-0.2
      let startEntry=etl.segments[0], seekTime=etl.segments[0].seg.startSec
      if (!atEnd&&currentPos>0) {
        for (const s of etl.segments) {
          if (currentPos<=s.compEnd||s===etl.segments[etl.segments.length-1]) {
            startEntry=s
            const offsetInSeg=Math.max(0,currentPos-s.compStart)*s.speed
            seekTime=s.seg.startSec+Math.min(offsetInSeg,s.seg.endSec-s.seg.startSec-0.01)
            break
          }
        }
      } else if (atEnd) {
        setRefinePrevPos(0)
      }
      setRefineIsPlaying(true); refineIsPlayingRef.current=true
      refinePlayEsIdxRef.current=etl.segments.indexOf(startEntry)
      refineEditTimelineRef.current=etl
      refinePlayCompIdRef.current=comp.id
      refinePrevSeekRef.current=seekTime
      const vid=refinePrevRef.current
      if (vid) { vid.currentTime=seekTime; vid.play().catch(()=>{}) }
      // sync voice
      const aud=refineVoiceRef.current
      if(aud&&aud.src){ aud.currentTime=atEnd?0:Math.max(0,currentPos); aud.play().catch(()=>{}) }
      return
    }

    // original deletedSegIdxs mode
    refineEditTimelineRef.current=null
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
    // sync voice
    const aud=refineVoiceRef.current
    if(aud&&aud.src){ aud.currentTime=atEnd?0:Math.max(0,currentPos); aud.play().catch(()=>{}) }
  }

  function stopRefinePlay() {
    const vid=refinePrevRef.current; if(vid) vid.pause()
    const aud=refineVoiceRef.current; if(aud) aud.pause()
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
      voice:null, // runtime: {fileName, fileType, duration, importedAt, source:'external', url} — url is objectUrl, not exported
      voiceMeta:null, // v0.7.6-hotfix: imported voice metadata without playable url (awaiting re-import)
      audioPolicy:{ muteOriginalVideo:false },
      editSegs:null,            // null = use deletedSegIdxs mode; array = cut/edit mode (v0.7.4)
      editSegsUndoStack:[],     // stack of prior editSegs snapshots for multi-step undo (v0.7.4-hotfix)
      savedAt:null,
      planExportedAt:null,      // v0.7.6: last export timestamp
      planImportedAt:null,      // v0.7.6: last import timestamp
      importReport:null,        // v0.7.6-hotfix: integrity report after import
      finalSubtitles: null,         // v0.9.4: [{id,start,end,text}] user-edited per-comp subtitles
      finalSubtitlesSavedAt: null,  // v0.9.4: timestamp when finalSubtitles was saved
      reframe: null,  // v0.9.5: {enabled,aspect,scale,offsetX,offsetY} per-comp
      subtitleStyle: null,  // v0.9.5h4: per-comp subtitle style, null = use DEFAULT_SUB_STYLE
      stickers: null,  // v0.9.6: [{id,key,emoji,text,isEmoji,x,y,scale}] per-comp
      subtitleAlign: null,  // v0.9.7: {status:'aligned',engine,alignedAt,message,mismatch}
      dedupOpts: null,      // v0.9.8: (legacy/export-prep) per-comp {mirror,brightness,contrast,saturation,lightScale}
      backgroundWrap: null, // v0.9.8: (legacy) single background wrap
      dedupeEffects: null,     // v0.9.8h1: [{id,type:'dedupe',start,end,params:{mirror,brightness,contrast,saturation,scale,border}}]
      backgroundEffects: null, // v0.9.8h1: [{id,type:'background',start,end,imageUrl,imageFileName,storedFileName,synced,videoScale,videoX,videoY}]
      ...(existing||{}),
    }
  }
  function updateRefinedComp(compId, updates) {
    setRefinedComps(prev=>({...prev,[compId]:defaultRcFor({...prev[compId],...updates})}))
  }

  // v0.9.4: split script text into timed subtitle objects
  function splitScriptToSubtitles(text, totalDuration) {
    if (!text || !text.trim() || totalDuration <= 0) return []
    const rawLines = text.trim().split('\n').map(l=>l.trim()).filter(Boolean)
    const sentences = []
    for (const line of rawLines) {
      const parts = line.split(/(?<=[。！？；…])/)
      for (let part of parts) {
        part = part.trim(); if (!part) continue
        if (part.length > 20) {
          const subs = part.split(/(?<=[，、：])/)
          for (let sp of subs) {
            sp = sp.trim(); if (!sp) continue
            while (sp.length > 20) { sentences.push(sp.slice(0,20)); sp = sp.slice(20) }
            if (sp) sentences.push(sp)
          }
        } else { sentences.push(part) }
      }
    }
    if (!sentences.length) return []
    const total = sentences.reduce((s,x)=>s+x.length,0) || 1
    let t = 0; const base = Date.now()
    return sentences.map((s,i)=>{
      const dur = Math.max(0.8, Math.min(6.0, totalDuration*s.length/total))
      const end = Math.min(t+dur, totalDuration)
      const sub = {id:`sub-${base}-${i}`, start:Math.round(t*100)/100, end:Math.round(end*100)/100, text:s}
      t = end; return sub
    })
  }

  function handleGenerateSubs(compId, comp, rc) {
    if (rc.finalSubtitles && rc.finalSubtitles.length > 0 &&
        !window.confirm('重新生成将覆盖现有字幕，确定吗？')) return
    if (!(rc.summaryScript && rc.summaryScript.trim())) { showToast('字幕汇总稿为空，请先在精修页填写'); return }
    recordSubSnapshot(compId)
    const hasE = !!(rc.editSegs && rc.editSegs.length > 0)
    const {totalDuration} = hasE ? buildEditTimeline(rc.editSegs) : buildDerivedTimeline(comp, rc.deletedSegIdxs, rc.speedMap)
    const dur = rc.voice?.duration || totalDuration || 60
    const subs = splitScriptToSubtitles(rc.summaryScript, dur)
    if (!subs.length) { showToast('字幕切分结果为空'); return }
    // v0.9.7: 这是按字数粗切，未与配音对齐——清除对齐标记，提示用户去自动对齐
    updateRefinedComp(compId, {finalSubtitles: subs, finalSubtitlesSavedAt: null, subtitleAlign: null})
    showToast(`已粗略生成 ${subs.length} 句字幕（未与配音对齐），建议点击「自动对齐配音」`)
  }

  // v0.9.7: 用本条配音做本地语音识别，自动对齐字幕时间轴
  async function alignSubtitles(compId, comp, rc) {
    const voiceSrc = rc.voice || rc.voiceMeta
    if (!voiceSrc || !(voiceSrc.storedFileName || voiceSrc.fileName)) {
      showToast('请先导入本条配音，再自动对齐字幕。'); return
    }
    const hasSubs = rc.finalSubtitles && rc.finalSubtitles.length > 0
    const hasScript = rc.summaryScript && rc.summaryScript.trim()
    if (!hasSubs && !hasScript) {
      showToast('请先保存最终字幕稿或生成成品字幕，再自动对齐。'); return
    }
    setAlignBusyId(compId)
    showToast('正在分析本条配音并对齐字幕，请稍等……')
    let result
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000)
      const resp = await fetch('http://127.0.0.1:8765/align-subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compId: String(compId),
          voice: {
            fileName: voiceSrc.fileName || '',
            storedFileName: voiceSrc.storedFileName || null,
            originalName: voiceSrc.originalName || voiceSrc.fileName || '',
          },
          summaryScript: rc.summaryScript || '',
          finalSubtitles: rc.finalSubtitles || null,
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      result = await resp.json()
    } catch (e) {
      setAlignBusyId(null)
      if (e.name === 'AbortError') showToast('自动对齐超时，请尝试更短的配音或更小的模型。')
      else if (e instanceof TypeError) showToast('自动对齐失败：本地导出服务未启动，请先启动本地导出服务。')
      else showToast(`自动对齐失败：${e.message}`)
      return
    }
    setAlignBusyId(null)
    if (result.engine === 'unavailable') {
      showToast(result.message || '当前未安装本地语音识别组件，无法自动对齐。')
      return
    }
    if (!result.ok) {
      showToast(result.error || '自动对齐失败，请检查本条配音文件是否已同步到本地服务。')
      return
    }
    recordSubSnapshot(compId)
    updateRefinedComp(compId, {
      finalSubtitles: result.subtitles,
      finalSubtitlesSavedAt: null,
      subtitleAlign: {
        status: 'aligned',
        engine: result.engine || '',
        alignedAt: new Date().toISOString(),
        message: result.message || '',
        mismatch: !!result.mismatch,
      },
    })
    showToast(result.message || `已根据本条配音自动对齐 ${result.subtitles.length} 条字幕。`)
  }

  function updateSubText(compId, subId, text) {
    setRefinedComps(prev=>{
      const rc = defaultRcFor(prev[compId])
      const subs = (rc.finalSubtitles||[]).map(s=>s.id===subId?{...s,text}:s)
      return {...prev,[compId]:{...rc,finalSubtitles:subs,finalSubtitlesSavedAt:null}}
    })
  }

  function deleteSub(compId, subId) {
    recordSubSnapshot(compId)
    setRefinedComps(prev=>{
      const rc = defaultRcFor(prev[compId])
      const subs = (rc.finalSubtitles||[]).filter(s=>s.id!==subId)
      return {...prev,[compId]:{...rc,finalSubtitles:subs,finalSubtitlesSavedAt:null}}
    })
  }

  function clearSubPunct(compId) {
    recordSubSnapshot(compId)
    setRefinedComps(prev=>{
      const rc = defaultRcFor(prev[compId])
      const subs = (rc.finalSubtitles||[]).map(s=>({...s,text:s.text.replace(/[。，！？；：、…]/g,'')}))
      return {...prev,[compId]:{...rc,finalSubtitles:subs,finalSubtitlesSavedAt:null}}
    })
    showToast('已清理常见标点')
  }

  function saveFinalSubtitles(compId) {
    const rc = defaultRcFor(refinedComps[compId])
    const subs = rc.finalSubtitles || []
    const idx = compositions.findIndex(c => c.id === compId)
    const last = subs[subs.length - 1]
    // 保存只写当前 compId，绝不写全局；带 compId 日志便于核对方案隔离
    console.log(`[字幕保存] compId=${compId} index=${idx} subtitles=${subs.length} first="${subs[0]?.text?.slice(0,20) ?? ''}" last="${last?.text?.slice(0,20) ?? ''}"`)
    updateRefinedComp(compId, {finalSubtitlesSavedAt: new Date().toISOString()})
    showToast('成品字幕已保存')
  }

  // v0.9.5: per-comp reframe helpers
  function getCompReframe(compId) {
    const rc = defaultRcFor(refinedComps[compId])
    return rc.reframe || { enabled: false, aspect: '保留原比例', scale: 1.0, offsetX: 0, offsetY: 0 }
  }
  function setCompReframe(compId, updates) {
    updateRefinedComp(compId, { reframe: { ...getCompReframe(compId), ...updates } })
  }

  // v0.9.5h4: per-comp subtitle style helpers
  function getCompSubStyle(compId) {
    const raw = refinedComps[compId]?.subtitleStyle || {}
    const merged = { ...DEFAULT_SUB_STYLE, ...raw }
    // v0.9.5h4c: migrate old 'background' field → backgroundMode/backgroundColor
    if (!raw.backgroundMode && raw.background !== undefined) {
      merged.backgroundMode = raw.background === 'none' ? 'none' : 'text'
      merged.backgroundColor = (raw.background && raw.background !== 'none') ? raw.background : 'black'
    }
    if (!raw.backgroundMode && raw.background === undefined) {
      merged.backgroundMode = 'none'
    }
    return merged
  }
  function setCompSubStyle(compId, updates) {
    updateRefinedComp(compId, { subtitleStyle: { ...getCompSubStyle(compId), ...updates } })
  }

  // ── v0.9.8h1: 统一时间线效果层 helpers ─────────────────────────────────────
  // 所有视觉效果（贴图/去重/背景）都是「时间线效果」：有 start/end，可在轨道上拖动，
  // 预览按播放头实时显示，导出按时间段生效。
  const r2 = (x) => Math.round((x || 0) * 100) / 100
  const effectActiveAt = (eff, t) => t >= (eff.start ?? 0) && t < (eff.end ?? 1e9)
  function getEffField(compId, field) { return refinedComps[compId]?.[field] || [] }
  function setEffField(compId, field, arr) { updateRefinedComp(compId, { [field]: arr }) }
  function updateEffectItem(compId, field, id, updates) {
    setEffField(compId, field, getEffField(compId, field).map(e => e.id === id ? { ...e, ...updates } : e))
  }
  function deleteEffectItem(compId, field, id) {
    setEffField(compId, field, getEffField(compId, field).filter(e => e.id !== id))
    if (selectedEffectId === id) setSelectedEffectId(null)
  }
  // default a duration window from current playhead (+3s, clamped to total)
  function defaultEffWindow(totalDur) {
    const s = r2(Math.max(0, refinePrevPos || 0))
    return { start: s, end: r2(Math.min((totalDur || s + 3), s + 3)) }
  }

  // ── stickers (now time-ranged) ──
  function getCompStickers(compId) {
    return (refinedComps[compId]?.stickers || []).map(s => ({
      x: 50, y: 50, scale: 1, opacity: 1, rotation: 0,
      start: s.start ?? 0, end: s.end ?? 1e9,
      ...s,
    }))
  }
  function addSticker(compId, preset, totalDur) {
    const w = defaultEffWindow(totalDur)
    const s = { id: 'stk' + Date.now(), ...preset, x: 50, y: 50, scale: 1, opacity: 1, rotation: 0, ...w }
    updateRefinedComp(compId, { stickers: [...(refinedComps[compId]?.stickers || []), s] })
    setSelectedEffectId(s.id)
  }
  function updateStickerPos(compId, sid, x, y) {
    updateRefinedComp(compId, { stickers: (refinedComps[compId]?.stickers || []).map(s => s.id===sid ? {...s, x, y} : s) })
  }
  function resizeSticker(compId, sid, delta) {
    updateRefinedComp(compId, { stickers: (refinedComps[compId]?.stickers || []).map(s => s.id===sid ? {...s, scale: Math.max(0.3, Math.min(4, (s.scale||1)+delta))} : s) })
  }
  function deleteSticker(compId, sid) {
    updateRefinedComp(compId, { stickers: (refinedComps[compId]?.stickers || []).filter(s => s.id!==sid) })
    if (selectedEffectId === sid) setSelectedEffectId(null)
  }

  // ── dedupe effects (time-ranged, per-segment) ──
  const DEDUPE_PARAM_DEFAULT = { mirror: false, brightness: false, contrast: false, saturation: false, scale: false, border: false }
  function getDedupeEffects(compId) { return getEffField(compId, 'dedupeEffects') }
  function addDedupeEffect(compId, start, end, label) {
    const e = { id: 'dd' + Date.now(), type: 'dedupe', label: label || '去重', start: r2(start), end: r2(end), params: { ...DEDUPE_PARAM_DEFAULT, mirror: true } }
    setEffField(compId, 'dedupeEffects', [...getDedupeEffects(compId), e])
    setSelectedEffectId(e.id)
  }
  function toggleDedupeParam(compId, id, key) {
    const eff = getDedupeEffects(compId).find(e => e.id === id); if (!eff) return
    updateEffectItem(compId, 'dedupeEffects', id, { params: { ...DEDUPE_PARAM_DEFAULT, ...(eff.params || {}), [key]: !(eff.params || {})[key] } })
  }

  // ── background effects (time-ranged) ──
  function getBackgroundEffects(compId) { return getEffField(compId, 'backgroundEffects') }
  async function importBgImage(compId, file, totalDur) {
    if (!file) return
    const url = URL.createObjectURL(file)
    let synced = false, storedFileName = null
    try {
      const r = await uploadToLocalService('/upload-image', file, file.name, { compId: String(compId) })
      synced = true; storedFileName = r.fileName
    } catch (e) { /* service may be down - still allow preview */ }
    const e = {
      id: 'bg' + Date.now(), type: 'background', label: '背景',
      start: 0, end: r2(totalDur || 9999),
      imageUrl: url, imageFileName: file.name, storedFileName, synced,
      videoScale: 0.8, videoX: 0, videoY: 0,
    }
    setEffField(compId, 'backgroundEffects', [...getBackgroundEffects(compId), e])
    setSelectedEffectId(e.id)
    showToast(synced ? '背景图已导入并同步，默认作用全程（可在轨道上调整时段）' : '背景图已导入（仅预览）；启动本地导出服务后再导出')
  }

  // compute combined preview FX for current playhead (transform + css filter + active bg)
  function getPreviewFx(compId, rf) {
    const t = refinePrevPos || 0
    const dds = getDedupeEffects(compId).filter(e => effectActiveAt(e, t))
    let mirror = false, scaleUp = false, brightness = false, contrast = false, saturation = false, border = false
    dds.forEach(e => { const p = e.params || {}; mirror = mirror || p.mirror; scaleUp = scaleUp || p.scale; brightness = brightness || p.brightness; contrast = contrast || p.contrast; saturation = saturation || p.saturation; border = border || p.border })
    const bg = getBackgroundEffects(compId).find(e => effectActiveAt(e, t)) || null
    const tparts = []
    if (rf.enabled) tparts.push(`scale(${rf.scale}) translate(${(rf.offsetX*100/rf.scale).toFixed(1)}%, ${(-rf.offsetY*100/rf.scale).toFixed(1)}%)`)
    if (bg) tparts.push(`translate(${bg.videoX||0}%, ${bg.videoY||0}%) scale(${bg.videoScale||1})`)
    if (scaleUp) tparts.push('scale(1.06)')
    if (mirror) tparts.push('scaleX(-1)')
    const fparts = []
    if (brightness) fparts.push('brightness(1.06)')
    if (contrast) fparts.push('contrast(1.08)')
    if (saturation) fparts.push('saturate(1.12)')
    return { transform: tparts.join(' '), filter: fparts.join(' '), bg, border, active: dds.length > 0 || !!bg }
  }

  // generic effect block drag (move / resize) on the effect timeline
  function startEffectDrag(e, compId, field, eff, mode, totalDur) {
    e.stopPropagation(); e.preventDefault()
    stopRefinePlay()
    setSelectedEffectId(eff.id)
    const lane = e.currentTarget.closest('.refine-fx-track-lane'); if (!lane) return
    const rect = lane.getBoundingClientRect()
    const MIN = 0.4
    effDragRef.current = { startX: e.clientX, origStart: eff.start ?? 0, origEnd: eff.end ?? totalDur, mode }
    const onMove = (ev) => {
      const d = effDragRef.current; if (!d) return
      const dxRatio = (ev.clientX - d.startX) / rect.width
      const dt = dxRatio * totalDur
      let ns = d.origStart, ne = d.origEnd
      if (d.mode === 'move') { ns = d.origStart + dt; ne = d.origEnd + dt; const len = d.origEnd - d.origStart; ns = Math.max(0, Math.min(totalDur - len, ns)); ne = ns + len }
      else if (d.mode === 'l') { ns = Math.max(0, Math.min(d.origEnd - MIN, d.origStart + dt)) }
      else if (d.mode === 'r') { ne = Math.min(totalDur, Math.max(d.origStart + MIN, d.origEnd + dt)) }
      updateEffectItem(compId, field, eff.id, { start: r2(ns), end: r2(ne) })
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); effDragRef.current = null }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  // v0.9.8h1: 编辑片段调速（editSegs 模式）
  function setEditSegSpeed(compId, esId, speed) {
    setRefinedComps(prev => {
      const rc = defaultRcFor(prev[compId])
      const editSegs = (rc.editSegs || []).map(es => es.id === esId ? { ...es, speed } : es)
      return { ...prev, [compId]: { ...rc, editSegs } }
    })
  }

  // v0.9.5h2: subtitle undo helpers
  function recordSubSnapshot(compId) {
    const curSubs = refinedComps[compId]?.finalSubtitles || []
    setSubHistory(prev => ({
      ...prev,
      [compId]: [...(prev[compId] || []), JSON.parse(JSON.stringify(curSubs))].slice(-10)
    }))
  }
  function undoSubOp(compId) {
    const hist = subHistory[compId] || []
    if (!hist.length) { showToast('暂无可撤销操作'); return }
    const prevSubs = hist[hist.length - 1]
    updateRefinedComp(compId, { finalSubtitles: prevSubs, finalSubtitlesSavedAt: null })
    setSubHistory(prev => ({ ...prev, [compId]: (prev[compId] || []).slice(0, -1) }))
    showToast('已撤销字幕操作')
  }

  // v0.9.5: subtitle edit helpers for refine page
  function mergeSub(compId, subId) {
    recordSubSnapshot(compId)
    setRefinedComps(prev => {
      const rc = prev[compId] || {}
      const subs = [...(rc.finalSubtitles || [])]
      const idx = subs.findIndex(s => s.id === subId)
      if (idx <= 0) return prev
      const merged = {
        ...subs[idx - 1],
        end: subs[idx].end,
        text: subs[idx - 1].text + subs[idx].text,
      }
      subs.splice(idx - 1, 2, merged)
      return { ...prev, [compId]: { ...defaultRcFor(rc), finalSubtitles: subs, finalSubtitlesSavedAt: null } }
    })
  }
  function splitSub(compId, subId, text1, text2) {
    recordSubSnapshot(compId)
    setRefinedComps(prev => {
      const rc = prev[compId] || {}
      const subs = [...(rc.finalSubtitles || [])]
      const idx = subs.findIndex(s => s.id === subId)
      if (idx < 0) return prev
      const orig = subs[idx]
      const mid = (orig.start + orig.end) / 2
      const s1 = { ...orig, end: mid, text: text1, id: orig.id + '_a' }
      const s2 = { id: orig.id + '_b', start: mid, end: orig.end, text: text2 }
      subs.splice(idx, 1, s1, s2)
      return { ...prev, [compId]: { ...defaultRcFor(rc), finalSubtitles: subs, finalSubtitlesSavedAt: null } }
    })
  }
  function addSubNewline(compId, subId) {
    recordSubSnapshot(compId)
    setRefinedComps(prev => {
      const rc = prev[compId] || {}
      const subs = (rc.finalSubtitles || []).map(s => {
        if (s.id !== subId) return s
        const text = s.text
        // Already has newline — append another
        if (text.includes('\n')) return { ...s, text: text + '\n' }
        // Insert at midpoint, preferring punctuation boundary
        const mid = Math.ceil(text.length / 2)
        let bp = mid
        const punc = /[，,。！？；、]/
        for (let r = 0; r <= 5; r++) {
          if (mid + r < text.length && punc.test(text[mid + r])) { bp = mid + r + 1; break }
          if (mid - r > 0 && punc.test(text[mid - r - 1])) { bp = mid - r; break }
        }
        return { ...s, text: text.slice(0, bp) + '\n' + text.slice(bp) }
      })
      return { ...prev, [compId]: { ...defaultRcFor(rc), finalSubtitles: subs, finalSubtitlesSavedAt: null } }
    })
  }
  function adjustSubTime(compId, subId, field, delta) {
    setRefinedComps(prev => {
      const rc = prev[compId] || {}
      const subs = (rc.finalSubtitles || []).map(s =>
        s.id === subId ? { ...s, [field]: Math.max(0, +(s[field] + delta).toFixed(1)) } : s
      )
      return { ...prev, [compId]: { ...defaultRcFor(rc), finalSubtitles: subs, finalSubtitlesSavedAt: null } }
    })
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
    showToast('最终字幕稿已保存')
  }
  function saveCopywriting(compId) {
    setRefinedComps(prev=>({...prev,[compId]:{...defaultRcFor(prev[compId]),copyModified:false,copySavedAt:new Date().toISOString()}}))
    showToast('文案已保存')
  }
  function saveRefinedPlan(compId) {
    setRefinedComps(prev=>({...prev,[compId]:{...defaultRcFor(prev[compId]),scriptModified:false,copyModified:false,savedAt:new Date().toISOString()}}))
    showToast('精修方案已保存')
  }

  // v0.7.6: Export refine plan as JSON file
  function exportRefinePlan(compId, comp) {
    const rc = defaultRcFor(refinedComps[compId])
    const hasEditSegs = !!(rc.editSegs && rc.editSegs.length > 0)
    const { segments: derivedSegs, totalDuration } = hasEditSegs
      ? buildEditTimeline(rc.editSegs)
      : buildDerivedTimeline(comp, rc.deletedSegIdxs, rc.speedMap)
    // v0.7.6-hotfix: voice export uses normalized shape; objectUrl is never serialized
    const voiceSrc = rc.voice || rc.voiceMeta || null
    const exportedVoice = voiceSrc ? {
      fileName: voiceSrc.storedFileName || voiceSrc.fileName || voiceSrc.name || '',
      originalName: voiceSrc.originalName || voiceSrc.fileName || voiceSrc.name || '',
      storedFileName: voiceSrc.storedFileName || null,
      synced: !!voiceSrc.synced,
      fileType: voiceSrc.fileType || '',
      duration: voiceSrc.duration || 0,
      importedAt: voiceSrc.importedAt || '',
      source: voiceSrc.source || 'external',
    } : null
    const voiceDuration = voiceSrc?.duration ?? 0
    const durationDiff = voiceSrc ? (voiceDuration - totalDuration) : null
    const now = new Date().toISOString()
    const payload = {
      version: '0.8.2',
      type: 'refine-plan',
      exportedAt: now,
      compositionId: compId,
      compositionName: comp.name,
      summaryScript: rc.summaryScript,
      finalSubtitles: rc.finalSubtitles || null,
      copywriting: rc.copywriting,
      audioPolicy: rc.audioPolicy,
      deletedSegIdxs: rc.deletedSegIdxs,
      speedMap: rc.speedMap,
      editSegs: rc.editSegs,
      voice: exportedVoice,
      // v0.8.2: export settings (saved for v0.9 FFmpeg execution)
      exportSettings: {
        aspectRatio: ratio,
        resolution: exportRes,
        fps: exportFps,
        cropEdge: dedup.crop||false,
        slightZoom: dedup.scale||false,
        mirrorFlip: dedup.mirror||false,
        speedProcess: dedup.speed||false,
        backgroundBase: dedup.bgImage||false,
        visiblePip: dedup.picInPic||false,
        subtitleJitter: dedup.subDistort||false,
        endCardImage: dedup.endImage||false,
        keepOriginalAudio: keepAudio,
        backgroundMusic: addMusic,
        autoSubtitle: autoSub,
        subtitlePosition: subPos,
        mixStrength: intensity,
        burnInSubtitle: burnInSub,
        coverOriginalSub: coverOrigSub,
        coverOrigSubHeight: coverOrigSubHeight,
        origSubMode: origSubMode,
        reframe: rc.reframe || { enabled: false, aspect: '保留原比例', scale: 1.0, offsetX: 0, offsetY: 0 },
        stickers: rc.stickers || [],
        dedupeEffects: rc.dedupeEffects || [],
        backgroundEffects: rc.backgroundEffects || [],
        subtitleStyle: getCompSubStyle(compId),
        bgm: bgmFile&&addMusic?{enabled:true,fileName:bgmFile.storedFileName||bgmFile.fileName,originalName:bgmFile.originalName,volume:bgmVolume}:{enabled:false},
        exportQuality: exportQuality,
      },
      sourceVideos: uploadedVideos.map((v, idx) => ({
        index: idx,
        fileName: v.storedFileName || v.name,
        originalName: v.name,
        storedFileName: v.storedFileName || null,
        synced: !!v.synced,
        duration: v.dur,
      })),
      derivedTimeline: derivedSegs.map(ds => ({
        esId: ds.esId ?? null,
        segIdx: ds.segIdx ?? null,
        label: ds.seg.label,
        type: ds.seg.type,
        videoIndex: ds.seg.videoIndex,
        startSec: ds.seg.startSec,
        endSec: ds.seg.endSec,
        speed: ds.speed,
        compStart: ds.compStart,
        compEnd: ds.compEnd,
        actualDur: ds.actualDur,
      })),
      totalDuration,
      voiceDuration: voiceSrc ? voiceDuration : null,
      durationDiff,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const safeName = comp.name.replace(/[^a-zA-Z0-9一-龥_-]/g, '_')
    a.href = url
    a.download = `refine-plan-${safeName}-${now.slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setRefinedComps(prev => ({ ...prev, [compId]: { ...defaultRcFor(prev[compId]), planExportedAt: now } }))
    showToast('方案已保存')
  }

  // ── 导出签名：compId + segments + voice（不含字幕）用于 Jianying 干净 mp4 缓存 ──
  function buildBaseSig(compId, comp, rc) {
    const idx = compositions.findIndex(c => c.id === compId)
    const hasEdit = !!(rc.editSegs && rc.editSegs.length > 0)
    let segKey
    if (hasEdit) {
      segKey = (rc.editSegs || []).map(e =>
        `${e.videoIndex ?? '?'}:${+(e.startSec||0).toFixed(3)}:${+(e.endSec||0).toFixed(3)}:${+(e.speed||1).toFixed(2)}`
      ).join('|')
    } else {
      const allSegs = comp?.segments || []
      const deleted = new Set(rc.deletedSegIdxs || [])
      const sm = rc.speedMap || {}
      segKey = allSegs.map((s, i) => {
        if (deleted.has(i)) return ''
        return `${s.videoIndex ?? '?'}:${+(s.startSec||0).toFixed(3)}:${+(s.endSec||0).toFixed(3)}:${+(sm[i]||1).toFixed(2)}`
      }).filter(Boolean).join('|')
    }
    const voiceKey = rc.voice ? (rc.voice.storedFileName || rc.voice.fileName || '') : ''
    const muteKey = rc.audioPolicy?.muteOriginalVideo ? '1' : '0'
    return `${compId}@${idx}|${segKey}|v:${voiceKey}|mo:${muteKey}`
  }

  // ── 全量签名：基础签名 + finalSubtitles + burnInSub，用于普通 mp4 缓存 ──
  function buildFullExportSig(compId, comp, rc) {
    const base = buildBaseSig(compId, comp, rc)
    const subKey = (rc.finalSubtitles || [])
      .map(s => `${+(s.start||0).toFixed(2)}:${+(s.end||0).toFixed(2)}:${s.text||''}`)
      .join('§')
    return `${base}|subs:${subKey}|burn:${burnInSub?'1':'0'}`
  }

  // ── 从 finalSubtitles 生成 SRT 文本（每次导出剪映草稿时调用，不缓存）──
  function buildSrtContent(subs) {
    if (!subs || subs.length === 0) return ''
    const fmt = s => {
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
      const sec = Math.floor(s % 60), ms = Math.round((s % 1) * 1000)
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')},${String(ms).padStart(3,'0')}`
    }
    return subs.map((sub, i) =>
      `${i + 1}\n${fmt(sub.start || 0)} --> ${fmt(sub.end || 0)}\n${sub.text || ''}`
    ).join('\n\n') + '\n'
  }

  // ── 统一导出状态入口：所有导出按钮都从这里取当前方案数据，杜绝跨方案串数据 ──
  // 直接从 refinedComps[compId] 读最新 state（onChange 已实时写入，未保存编辑也在内），
  // 绝不读取全局字幕、上一次方案字幕或右侧逐句池。
  function getCurrentRefineExportState(compId, comp) {
    const cid = compId || refineCompId
    const c = comp || (cid ? compositions.find(x => x.id === cid) : null)
    if (!cid || !c) return null
    const rc = defaultRcFor(refinedComps[cid])
    const idx = compositions.findIndex(x => x.id === cid)
    const subs = (rc.finalSubtitles && rc.finalSubtitles.length > 0) ? rc.finalSubtitles : null
    return {
      compId: cid,
      comp: c,
      compositionIndex: idx,
      compositionName: c.name,
      rc,
      finalSubtitles: subs,
      exportSignature: buildBaseSig(cid, c, rc),
    }
  }

  // v0.9.1: POST 当前草稿到本地导出服务（仅构建 payload + 调 /export，返回 {ok,output,srt,message,error}）
  // forJianying=true → 强制 burnInSubtitle:false（Jianying 用干净视频，字幕由剪映字幕轨提供）
  async function doExportToLocalService(compId, comp, dedupOverride = null, forJianying = false) {
    if (!compId || !comp) return { ok: false, error: '参数缺失' }

    const rc = defaultRcFor(refinedComps[compId])
    const hasEditSegs = !!(rc.editSegs && rc.editSegs.length > 0)
    const { segments: derivedSegs, totalDuration } = hasEditSegs
      ? buildEditTimeline(rc.editSegs)
      : buildDerivedTimeline(comp, rc.deletedSegIdxs, rc.speedMap)
    const voiceSrc = rc.voice || rc.voiceMeta || null
    const exportedVoice = voiceSrc ? {
      fileName: voiceSrc.storedFileName || voiceSrc.fileName || voiceSrc.name || '',
      originalName: voiceSrc.originalName || voiceSrc.fileName || voiceSrc.name || '',
      storedFileName: voiceSrc.storedFileName || null,
      synced: !!voiceSrc.synced,
      fileType: voiceSrc.fileType || '',
      duration: voiceSrc.duration || 0,
      importedAt: voiceSrc.importedAt || '',
      source: voiceSrc.source || 'external',
    } : null
    const voiceDuration = voiceSrc?.duration ?? 0
    const durationDiff = voiceSrc ? (voiceDuration - totalDuration) : null
    const now = new Date().toISOString()
    const compositionIndex = compositions.findIndex(c => c.id === compId)
    const exportSignature = buildBaseSig(compId, comp, rc)
    const subCount = rc.finalSubtitles?.length ?? 0
    const firstSubText = rc.finalSubtitles?.[0]?.text ?? ''
    const firstSeg = derivedSegs[0]
    console.log(`[导出] compId=${compId} index=${compositionIndex} name=${comp.name} segments=${derivedSegs.length} hasVoice=${!!exportedVoice} forJianying=${forJianying}`)
    console.log(`[导出] sig=${exportSignature.slice(0,80)} subCount=${subCount} firstSub="${firstSubText.slice(0,30)}" firstSeg=vid${firstSeg?.seg?.videoIndex}:${firstSeg?.seg?.startSec?.toFixed(2)}~${firstSeg?.seg?.endSec?.toFixed(2)}`)
    const payload = {
      version: '0.9.1',
      type: 'refine-plan',
      exportedAt: now,
      compositionId: compId,
      compositionIndex: compositionIndex >= 0 ? compositionIndex : null,
      compositionName: comp.name,
      exportSignature,
      summaryScript: rc.summaryScript,
      finalSubtitles: rc.finalSubtitles || null,
      copywriting: rc.copywriting,
      audioPolicy: rc.audioPolicy,
      deletedSegIdxs: rc.deletedSegIdxs,
      speedMap: rc.speedMap,
      editSegs: rc.editSegs,
      voice: exportedVoice,
      exportSettings: {
        aspectRatio: ratio, resolution: exportRes, fps: exportFps,
        // v0.9.8: per-comp dedup overrides global if provided
        ...(dedupOverride
          ? {
              dedupOpts: dedupOverride,
              mirrorFlip: !!(dedupOverride.mirror), slightZoom: !!(dedupOverride.lightScale),
              cropEdge: false, speedProcess: false, backgroundBase: false,
              visiblePip: false, subtitleJitter: false, endCardImage: false,
            }
          : {
              cropEdge: dedup.crop||false, slightZoom: dedup.scale||false,
              mirrorFlip: dedup.mirror||false, speedProcess: dedup.speed||false,
              backgroundBase: dedup.bgImage||false, visiblePip: dedup.picInPic||false,
              subtitleJitter: dedup.subDistort||false, endCardImage: dedup.endImage||false,
              dedupOpts: null,
            }),
        keepOriginalAudio: keepAudio, backgroundMusic: addMusic,
        autoSubtitle: autoSub, subtitlePosition: subPos, mixStrength: intensity,
        // forJianying=true → 强制关闭字幕烧录，Jianying 草稿使用干净视频 + 可编辑字幕轨
        burnInSubtitle: forJianying ? false : burnInSub,
        coverOriginalSub: coverOrigSub, coverOrigSubHeight: coverOrigSubHeight,
        origSubMode: origSubMode,
        reframe: rc.reframe || { enabled: false, aspect: '保留原比例', scale: 1.0, offsetX: 0, offsetY: 0 },
        stickers: getCompStickers(compId),
        subtitleStyle: getCompSubStyle(compId),
        backgroundWrap: rc.backgroundWrap || { enabled: false },
        // v0.9.8h1: 时间线效果层（带 start/end）
        dedupeEffects: rc.dedupeEffects || [],
        backgroundEffects: (rc.backgroundEffects || []).map(e => ({
          id: e.id, type: e.type, label: e.label, start: e.start, end: e.end,
          imageFileName: e.imageFileName, storedFileName: e.storedFileName, synced: e.synced,
          videoScale: e.videoScale, videoX: e.videoX, videoY: e.videoY,
        })),
        bgm: bgmFile&&addMusic?{enabled:true,fileName:bgmFile.storedFileName||bgmFile.fileName,originalName:bgmFile.originalName,volume:bgmVolume}:{enabled:false},
        exportQuality: exportQuality,
      },
      stickers: getCompStickers(compId),
      sourceVideos: uploadedVideos.map((v, idx) => ({
        index: idx, fileName: v.storedFileName || v.name, originalName: v.name,
        storedFileName: v.storedFileName || null, synced: !!v.synced, duration: v.dur,
      })),
      derivedTimeline: derivedSegs.map(ds => ({
        esId: ds.esId ?? null, segIdx: ds.segIdx ?? null,
        label: ds.seg.label, type: ds.seg.type,
        videoIndex: ds.seg.videoIndex,
        startSec: ds.seg.startSec, endSec: ds.seg.endSec,
        speed: ds.speed, compStart: ds.compStart, compEnd: ds.compEnd,
        actualDur: ds.actualDur,
      })),
      totalDuration,
      voiceDuration: voiceSrc ? voiceDuration : null,
      durationDiff,
    }
    const EXPORT_URL = 'http://127.0.0.1:8765/export'
    let result
    let networkError = null
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 min
      const resp = await fetch(EXPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!resp.ok) {
        let errBody = ''
        try { errBody = await resp.text() } catch { /* ignore */ }
        return { ok: false, error: `本地服务返回 HTTP ${resp.status}：${errBody.slice(0, 300) || '无响应内容'}` }
      }
      result = await resp.json()
    } catch (e) {
      if (e.name === 'AbortError') {
        networkError = '请求超时（超过10分钟），请检查服务窗口日志。'
      } else if (e instanceof TypeError) {
        networkError = `无法连接本地导出服务（${e.name}: ${e.message}）。请求地址：${EXPORT_URL}。请先双击「启动本地导出服务.bat」，等黑窗口出现后再重试。`
      } else {
        networkError = `导出失败（${e.name}: ${e.message}）`
      }
      return { ok: false, error: networkError, networkError }
    }
    if (result && result.ok) {
      return { ok: true, output: result.output || '', srt: result.srt || '', message: result.message || '' }
    }
    return { ok: false, error: (result && result.error) || '生成失败，请查看服务窗口日志。' }
  }

  // v0.9.1: 包装层：调用 doExportToLocalService 并写 UI 状态（保留原 exportToLocalService 行为）
  async function exportToLocalService(compId, comp, setStatus = setEpExportStatus, setMsg = setEpExportMsg, dedupOverride = null) {
    setStatus('loading')
    setMsg('正在生成成品视频，请稍候...')
    const rc = defaultRcFor(refinedComps[compId])
    const fullSig = buildFullExportSig(compId, comp, rc)
    const r = await doExportToLocalService(compId, comp, dedupOverride)
    if (r.ok) {
      setStatus('success')
      setMsg(r.message || '生成成功！成品视频已保存到 export_workspace/output/')
      setLastExportedMp4(r.output || '')
      setLastExportedMp4Sig(fullSig)
    } else {
      setStatus('error')
      setMsg(r.error || '生成失败，请查看服务窗口日志。')
    }
  }

  // ── 导出到剪映草稿（一体化：字幕始终从当前 finalSubtitles 现场生成，绝不复用旧 SRT）──
  async function exportToJianying(compId, comp) {
    // 统一从 getCurrentRefineExportState 取当前方案数据，杜绝跨方案串数据
    const exp = getCurrentRefineExportState(compId, comp)
    if (!exp) {
      setJianyingExportStatus('error')
      setJianyingExportMsg('无法确定当前方案，请重新进入精修页')
      return
    }
    const targetCompId = exp.compId
    const targetComp   = exp.comp
    const rc           = exp.rc
    console.log(`[导出字幕] compId=${targetCompId} index=${exp.compositionIndex} name=${exp.compositionName} subtitles=${exp.finalSubtitles?.length ?? 0} first="${exp.finalSubtitles?.[0]?.text?.slice(0,20) ?? ''}" last="${exp.finalSubtitles?.[exp.finalSubtitles.length-1]?.text?.slice(0,20) ?? ''}"`)
    setJianyingExportStatus('loading')

    // Jianying 专用 mp4 缓存：签名只含 compId + segments + voice
    // （字幕改动不影响干净 mp4，改变字幕只影响 SRT，SRT 始终实时生成）
    const jianyingMp4Sig = buildBaseSig(targetCompId, targetComp, rc)
    const jianyingCacheHit = !!lastJianyingMp4 && lastJianyingMp4Sig === jianyingMp4Sig

    let mp4ToUse = jianyingCacheHit ? lastJianyingMp4 : ''

    if (!mp4ToUse) {
      setJianyingExportMsg('正在准备成品视频（干净版，字幕将由剪映字幕轨提供）…')
      // forJianying=true → burnInSubtitle:false → 干净视频，无烧录字幕
      const r = await doExportToLocalService(targetCompId, targetComp, null, true)
      if (!r || !r.ok) {
        setJianyingExportStatus('error')
        setJianyingExportMsg(r?.error || '准备成品视频失败，请稍后再试。')
        return
      }
      mp4ToUse = r.output || ''
      if (!mp4ToUse) {
        setJianyingExportStatus('error')
        setJianyingExportMsg('生成成品视频失败（未获得输出路径），请查看服务窗口日志。')
        return
      }
      setLastJianyingMp4(mp4ToUse)
      setLastJianyingMp4Sig(jianyingMp4Sig)
    }

    // 始终从当前 rc.finalSubtitles 实时生成 SRT 内容——永不复用任何缓存 SRT
    const freshSubs = (rc.finalSubtitles && rc.finalSubtitles.length > 0) ? rc.finalSubtitles : null
    const srtContent = (jianyingOpts.subtitle && freshSubs) ? buildSrtContent(freshSubs) : ''

    const lastSub = freshSubs?.[freshSubs.length - 1]
    const srtBlocks = srtContent ? srtContent.split('\n\n').filter(b => b.trim()) : []
    const lastSrtBlock = srtBlocks[srtBlocks.length - 1] || ''
    console.log(`[剪映导出] compId=${targetCompId} subs=${freshSubs?.length ?? 0} srtLen=${srtContent.length} srtBlocks=${srtBlocks.length} cacheHit=${jianyingCacheHit}`)
    console.log(`[剪映导出] sig=${jianyingMp4Sig.slice(0, 80)}`)
    console.log(`[剪映导出] mp4=${mp4ToUse}`)
    if (lastSub) {
      console.log(`[剪映导出] 最后字幕: start=${lastSub.start?.toFixed(3)}s end=${lastSub.end?.toFixed(3)}s text="${lastSub.text?.slice(0,60)}"`)
    }
    if (lastSrtBlock) {
      console.log(`[剪映导出] SRT末条: ${lastSrtBlock.slice(0, 200)}`)
    }

    const hasEditSegs = !!(rc.editSegs && rc.editSegs.length > 0)
    const { totalDuration: jianyingExpectedDur } = hasEditSegs
      ? buildEditTimeline(rc.editSegs)
      : buildDerivedTimeline(targetComp, rc.deletedSegIdxs, rc.speedMap)

    const buildJianyingBody = (mp4) => JSON.stringify({
      mp4,
      // 字幕内容直接内嵌——后端写临时 SRT，export_with_jianying.py 收到 --srt，永不触发自动扫描
      subtitleContent: srtContent || undefined,
      expectedDuration: jianyingExpectedDur,
      options: {
        subtitle: !!jianyingOpts.subtitle,
        voice: !!jianyingOpts.voice,
        keepOriginalAudio: !!jianyingOpts.keepOriginalAudio,
        audioTrackSupported: jianyingAudioTrackSupported,
      },
    })

    setJianyingExportMsg('正在生成剪映草稿…')
    try {
      const resp = await fetch('http://127.0.0.1:8765/export-jianying', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildJianyingBody(mp4ToUse),
      })
      const data = await resp.json()
      if (data.ok) {
        setJianyingExportStatus('success')
        setJianyingExportMsg(data.message || '剪映草稿已生成，请关闭并重新打开剪映查看。')
        setLastJianyingDraftName(data.draftName || '')
        setLastJianyingDraftPath(data.draftPath || '')
      } else {
        const missingMp4 = /MP4 文件不存在/.test(data.error || '')
        if (missingMp4) {
          setJianyingExportMsg('正在重新准备成品视频…')
          const r = await doExportToLocalService(targetCompId, targetComp, null, true)
          if (!r || !r.ok) {
            setJianyingExportStatus('error')
            setJianyingExportMsg(r?.error || '重新生成成品视频失败，请稍后再试。')
            return
          }
          mp4ToUse = r.output || ''
          setLastJianyingMp4(mp4ToUse)
          setLastJianyingMp4Sig(jianyingMp4Sig)
          setJianyingExportMsg('正在生成剪映草稿…')
          const retry = await fetch('http://127.0.0.1:8765/export-jianying', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: buildJianyingBody(mp4ToUse),
          })
          const retryData = await retry.json()
          if (retryData.ok) {
            setJianyingExportStatus('success')
            setJianyingExportMsg(retryData.message || '剪映草稿已生成，请关闭并重新打开剪映查看。')
            setLastJianyingDraftName(retryData.draftName || '')
            setLastJianyingDraftPath(retryData.draftPath || '')
          } else {
            setJianyingExportStatus('error')
            const raw = retryData.error || '生成失败，请重试'
            setJianyingExportMsg(raw.length > 200 ? '剪映草稿生成失败，请查看本地服务窗口日志。' : raw)
          }
          return
        }
        // 时长异常等校验失败：清掉干净 mp4 缓存，避免下次重试复用同一份坏文件，确保重新点击必定重新生成
        const durationMismatch = /时长异常/.test(data.error || '')
        if (durationMismatch) {
          console.log(`[剪映导出] 检测到时长异常，已清除缓存 sig=${jianyingMp4Sig.slice(0,80)} mp4=${mp4ToUse}，下次将强制重新生成`)
          setLastJianyingMp4('')
          setLastJianyingMp4Sig('')
        }
        setJianyingExportStatus('error')
        const raw = data.error || '生成失败，请重试'
        setJianyingExportMsg(raw.length > 200 ? '剪映草稿生成失败，请查看本地服务窗口日志。' : raw)
      }
    } catch (e) {
      setJianyingExportStatus('error')
      setJianyingExportMsg('网络错误：本地导出服务未启动，请先双击「启动本地导出服务.bat」。')
    }
  }

  // v0.9.10: 打开剪映软件（前端 → 后端 /open-jianying）
  async function openJianyingApp() {
    try {
      const resp = await fetch('http://127.0.0.1:8765/open-jianying', { method: 'POST' })
      const data = await resp.json().catch(() => ({}))
      if (data.ok) {
        showToast(data.message || '已尝试打开剪映')
      } else {
        showToast(data.error || '未找到剪映，请手动打开')
      }
    } catch (e) {
      showToast('本地导出服务未启动，请先双击「启动本地导出服务.bat」。')
    }
  }

  // v0.9.10: 打开剪映草稿目录（前端 → 后端 /open-path）
  async function openJianyingDraftFolder() {
    const p = lastJianyingDraftPath
    if (!p) {
      showToast('暂无草稿路径，请先生成剪映草稿。')
      return
    }
    try {
      const resp = await fetch('http://127.0.0.1:8765/open-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: p }),
      })
      const data = await resp.json().catch(() => ({}))
      if (data.ok) {
        showToast(data.message || '已打开草稿文件夹')
      } else {
        showToast(data.error || '草稿文件夹不存在，请手动查看剪映本地草稿')
      }
    } catch (e) {
      showToast('本地导出服务未启动，请先双击「启动本地导出服务.bat」。')
    }
  }

  // v0.9.8: 精修页"导出当前成品视频" → 先弹导出前检查弹窗
  function exportCurrentFromRefine(compId, comp) {
    if (!compId || !comp) return
    setExportCheckComp({ compId, comp, mode: 'video' })
    setShowExportCheck(true)
  }

  // 精修页"导出到剪映草稿" → 弹一个轻量检查弹窗（与视频同样的检查规则，但文案不同）
  function exportCurrentToJianyingFromRefine(compId, comp) {
    if (!compId || !comp) return
    setExportCheckComp({ compId, comp, mode: 'jianying' })
    setShowExportCheck(true)
  }

  // 用户在检查弹窗点击"继续导出"后实际执行的导出
  function doConfirmedExport(compId, comp, mode) {
    if (mode === 'jianying') {
      // 剪映草稿：一体化（mp4 不存在时自动先 /export），状态连续显示在 jianying 状态条
      exportToJianying(compId, comp)
      return
    }
    // v0.9.8h1: 时间线效果层（dedupeEffects/backgroundEffects/stickers）由 payload 统一携带
    exportToLocalService(compId, comp, setRefineExportStatus, setRefineExportMsg, null)
  }

  // v0.7.6: Import refine plan from JSON file
  function importRefinePlanFile(compId, file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      let data
      try { data = JSON.parse(e.target.result) } catch { showToast('JSON 解析失败，文件可能损坏'); return }
      if (data.type !== 'refine-plan') { showToast('不是有效的精修方案文件'); return }
      if (!data.version) { showToast('文件缺少版本字段'); return }
      if (data.compositionId && data.compositionId !== compId) {
        if (!window.confirm(`此方案来自成品「${data.compositionName||data.compositionId}」，当前成品不同，仍要导入？`)) return
      }
      const now = new Date().toISOString()
      // v0.7.6-hotfix: normalize voice (compat with old name/duration/url shape)
      const oldVoice = data.voice || null
      const normalizedVoiceMeta = oldVoice ? {
        fileName: oldVoice.fileName || oldVoice.name || '',
        fileType: oldVoice.fileType || '',
        duration: oldVoice.duration || 0,
        importedAt: oldVoice.importedAt || '',
        source: oldVoice.source || 'external',
      } : null
      const hadLegacyVoiceFields = !!(oldVoice && (oldVoice.name || oldVoice.url) && !oldVoice.fileName)
      // build integrity report
      const report = {
        summaryScript: !!(data.summaryScript && data.summaryScript.trim()),
        copywriting: !!(data.copywriting && Object.values(data.copywriting).some(v => v && String(v).trim())),
        editSegs: !!(data.editSegs && data.editSegs.length > 0),
        editsBasic: (data.deletedSegIdxs?.length > 0) || (data.speedMap && Object.keys(data.speedMap).length > 0),
        audioPolicy: !!data.audioPolicy,
        voiceFileName: normalizedVoiceMeta?.fileName || '',
        voiceDuration: normalizedVoiceMeta?.duration || 0,
        totalDuration: data.totalDuration ?? 0,
        durationDiff: data.durationDiff ?? null,
        legacyVoiceCompat: hadLegacyVoiceFields,
        importedAt: now,
      }
      setRefinedComps(prev => {
        const base = defaultRcFor(prev[compId])
        return {
          ...prev,
          [compId]: {
            ...base,
            summaryScript: data.summaryScript ?? base.summaryScript,
            copywriting: data.copywriting ?? base.copywriting,
            audioPolicy: data.audioPolicy ?? base.audioPolicy,
            deletedSegIdxs: data.deletedSegIdxs ?? base.deletedSegIdxs,
            speedMap: data.speedMap ?? base.speedMap,
            editSegs: data.editSegs ?? base.editSegs,
            editSegsUndoStack: [],
            voice: null, // objectUrl cannot survive serialization; user must re-import the file
            voiceMeta: normalizedVoiceMeta,
            savedAt: data.exportedAt ?? null,
            planImportedAt: now,
            planExportedAt: null,
            importReport: report,
          }
        }
      })
      // v0.8.2: restore exportSettings global state if present
      const es = data.exportSettings
      if (es) {
        if (es.aspectRatio) setRatio(es.aspectRatio)
        if (es.resolution)  setExportRes(es.resolution)
        if (es.fps)         setExportFps(es.fps)
        if (es.mixStrength) setIntensity(es.mixStrength)
        if (typeof es.keepOriginalAudio === 'boolean') setKeepAudio(es.keepOriginalAudio)
        if (typeof es.backgroundMusic   === 'boolean') setAddMusic(es.backgroundMusic)
        if (typeof es.autoSubtitle      === 'boolean') setAutoSub(es.autoSubtitle)
        if (es.subtitlePosition) setSubPos(es.subtitlePosition)
        setDedup(prev => ({
          ...prev,
          crop:       typeof es.cropEdge        === 'boolean' ? es.cropEdge        : prev.crop,
          scale:      typeof es.slightZoom      === 'boolean' ? es.slightZoom      : prev.scale,
          mirror:     typeof es.mirrorFlip      === 'boolean' ? es.mirrorFlip      : prev.mirror,
          speed:      typeof es.speedProcess    === 'boolean' ? es.speedProcess    : prev.speed,
          bgImage:    typeof es.backgroundBase  === 'boolean' ? es.backgroundBase  : prev.bgImage,
          picInPic:   typeof es.visiblePip      === 'boolean' ? es.visiblePip      : prev.picInPic,
          subDistort: typeof es.subtitleJitter  === 'boolean' ? es.subtitleJitter  : prev.subDistort,
          endImage:   typeof es.endCardImage    === 'boolean' ? es.endCardImage    : prev.endImage,
        }))
      }
      if (normalizedVoiceMeta?.fileName) {
        showToast(`方案已导入，语音文件「${normalizedVoiceMeta.fileName}」需重新选择。`)
      } else {
        showToast('已导入方案，语音文件需重新选择。')
      }
    }
    reader.onerror = () => showToast('文件读取失败')
    reader.readAsText(file)
  }

  function switchRefineComp(newCompId) {
    const rc=refinedComps[refineCompId]||{}
    if((rc.scriptModified||rc.copyModified)&&!window.confirm('当前方案有未保存的修改，确认切换？（修改仍在内存中，可稍后保存）')) return
    stopRefinePlay()
    setRefineCompId(newCompId)
    setRefineSelSeg(null)
    setRefineSelEsId(null)
    setRefinePrevPos(0)
  }

  function importVoiceFile(compId, file) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const tmp = new Audio(url)
    tmp.addEventListener('loadedmetadata', async () => {
      const dur = isFinite(tmp.duration) ? tmp.duration : 0
      const importedAt = new Date().toISOString()
      // v0.9.3: 自动同步到本地导出服务
      let synced=false, storedFileName=null, syncedAt=null, serviceDown=false
      try {
        const r=await uploadToLocalService('/upload-audio', file, file.name, {compId:String(compId)})
        synced=true; storedFileName=r.fileName; syncedAt=new Date().toISOString()
      } catch(err) { if (err instanceof TypeError) serviceDown=true }
      updateRefinedComp(compId, {
        voice: {
          fileName: file.name,           // 原始名，用于页面显示
          originalName: file.name,
          storedFileName,                // 本地服务返回的安全名，导出时使用
          synced, syncedAt,
          fileType: file.type || '',
          duration: dur,
          importedAt,
          source: 'external',
          url,
        },
        voiceMeta: null, // cleared once a real file is loaded
        audioPolicy: { ...(defaultRcFor(refinedComps[compId]).audioPolicy), muteOriginalVideo: true },
      })
      if (serviceDown) showToast('配音已导入（仅预览）；本地导出服务未启动，导出前请启动服务并点击同步')
      else if (synced) showToast('本条配音已导入并同步到本地导出服务，原视频音频已自动静音')
      else showToast('本条成品配音已导入，原视频音频已自动静音')
    })
    tmp.addEventListener('error', () => showToast('音频文件读取失败'))
  }
  function toggleMuteOriginal(compId) {
    setRefinedComps(prev => {
      const rc = defaultRcFor(prev[compId])
      return { ...prev, [compId]: { ...rc, audioPolicy: { ...rc.audioPolicy, muteOriginalVideo: !rc.audioPolicy.muteOriginalVideo } } }
    })
  }

  // ── edit-seg helpers (v0.7.4) ──
  function initEditSegsFromComp(comp, rc) {
    const { segments: ds } = buildDerivedTimeline(comp, rc.deletedSegIdxs||[], rc.speedMap||{})
    return ds.map((d, i) => ({
      id: `es-${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`,
      origSegIdx: d.segIdx,
      videoIndex: d.seg.videoIndex,
      label: d.seg.label,
      type: d.seg.type || '',
      startSec: d.seg.startSec,
      endSec: d.seg.endSec,
      speed: d.speed,
      deleted: false,
    }))
  }

  // v0.7.4-hotfix: push current editSegs (deep-cloned snapshot) onto undo stack
  function pushEditSegsUndoSnapshot(rc) {
    const snap = rc.editSegs ? rc.editSegs.map(s => ({ ...s })) : null
    return [...(rc.editSegsUndoStack || []), snap]
  }

  function cutAtPos(compId, comp) {
    const rc = defaultRcFor(refinedComps[compId])
    const currentEditSegs = rc.editSegs || initEditSegsFromComp(comp, rc)
    const { segments: etl } = buildEditTimeline(currentEditSegs)
    const pos = refinePrevPos
    const entry = etl.find(s => pos > s.compStart && pos < s.compEnd)
    if (!entry) { showToast('当前位置不在任何片段内'); return }
    const cutSrcTime = entry.seg.startSec + (pos - entry.compStart) * entry.speed
    const MIN_GAP = 0.2
    if (cutSrcTime - entry.seg.startSec < MIN_GAP || entry.seg.endSec - cutSrcTime < MIN_GAP) {
      showToast('当前位置太接近片段边界，无法切分'); return
    }
    const origIdx = currentEditSegs.findIndex(s => s.id === entry.esId)
    if (origIdx < 0) return
    const orig = currentEditSegs[origIdx]
    const ts = Date.now()
    const partA = { ...orig, id:`es-${ts}-a-${Math.random().toString(36).slice(2,5)}`, endSec: cutSrcTime }
    const partB = { ...orig, id:`es-${ts}-b-${Math.random().toString(36).slice(2,5)}`, startSec: cutSrcTime }
    const newEditSegs = [...currentEditSegs]
    newEditSegs.splice(origIdx, 1, partA, partB)
    stopRefinePlay()
    setRefinedComps(prev => {
      const rcP = defaultRcFor(prev[compId])
      return { ...prev, [compId]: { ...rcP, editSegs: newEditSegs, editSegsUndoStack: pushEditSegsUndoSnapshot(rcP) } }
    })
    setRefineSelEsId(partA.id)
    showToast('✂ 已切分')
  }

  function deleteEditSeg(compId, esId) {
    const rc = defaultRcFor(refinedComps[compId])
    if (!rc.editSegs) return
    const newEditSegs = rc.editSegs.map(s => s.id === esId ? { ...s, deleted: true } : s)
    stopRefinePlay()
    setRefinedComps(prev => {
      const rcP = defaultRcFor(prev[compId])
      return { ...prev, [compId]: { ...rcP, editSegs: newEditSegs, editSegsUndoStack: pushEditSegsUndoSnapshot(rcP) } }
    })
    showToast('已删除该小段')
  }

  function restoreEditSeg(compId, esId) {
    const rc = defaultRcFor(refinedComps[compId])
    if (!rc.editSegs) return
    const newEditSegs = rc.editSegs.map(s => s.id === esId ? { ...s, deleted: false } : s)
    stopRefinePlay()
    setRefinedComps(prev => {
      const rcP = defaultRcFor(prev[compId])
      return { ...prev, [compId]: { ...rcP, editSegs: newEditSegs, editSegsUndoStack: pushEditSegsUndoSnapshot(rcP) } }
    })
    showToast('已恢复该小段')
  }

  function undoEditSegs(compId) {
    let didUndo = false
    stopRefinePlay()
    setRefinedComps(prev => {
      const rcP = defaultRcFor(prev[compId])
      const stack = rcP.editSegsUndoStack || []
      if (stack.length === 0) return prev
      const newStack = stack.slice(0, -1)
      const last = stack[stack.length - 1]   // restore previous snapshot
      didUndo = true
      return { ...prev, [compId]: { ...rcP, editSegs: last, editSegsUndoStack: newStack } }
    })
    setRefineSelEsId(null)
    if (didUndo) showToast('已撤销一步')
    else showToast('没有可撤销的操作')
  }

  function applyTrim(compId, esId, newStartSec, newEndSec) {
    const MIN_SEG = 0.3
    if (newEndSec - newStartSec < MIN_SEG) { showToast('片段太短，无法裁剪'); return }
    stopRefinePlay()
    setRefinedComps(prev => {
      const rcP = defaultRcFor(prev[compId])
      if (!rcP.editSegs) return prev
      const newEditSegs = rcP.editSegs.map(s =>
        s.id === esId ? { ...s, startSec: newStartSec, endSec: newEndSec } : s
      )
      return { ...prev, [compId]: { ...rcP, editSegs: newEditSegs, editSegsUndoStack: pushEditSegsUndoSnapshot(rcP) } }
    })
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
          {[{n:1,label:'素材准备'},{n:2,label:'字幕分段'},{n:3,label:'精修导出'}].flatMap(({n,label},i)=>{
            const isActive=step===n, isDone=step>n, isLocked=n===3&&!isGenerated&&step<3
            return [
              i>0&&<div key={`sep-${n}`} className={`step-nav-sep ${isDone?'done':''}`}/>,
              // v0.9.10: 顶部"3 精修导出"点击直接进入精修页（不再跳旧 export-prep）
              <div key={n} className={`step-nav-item ${isActive?'active':''} ${isDone?'done':''} ${isLocked?'locked':''}`}
                onClick={()=>{
                  if (step===n || isLocked) return
                  if (n===3) {
                    // 旧主流程被弱化：直接进精修页（主操作已在精修页内提供）
                    setStep(2)
                    setSubStep('refine')
                    if (compositions.length>0 && !refineCompId) {
                      setRefineCompId(compositions[0].id)
                    }
                    return
                  }
                  setStep(n)
                }}
                title={isLocked?'请先完成混剪方案生成':(n===3?'进入精修页（在此导出成品视频 / 导出到剪映草稿）':undefined)}>
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
              导入视频素材
            </button>
            {uploadedVideos.length>0&&<span className="s1-count">已导入 <strong>{uploadedVideos.length}</strong> 个视频 · 总时长 {fmt(totalDuration)}</span>}
            <span className="s1-hint">支持 MP4 · MOV · AVI · 多选 · 仅本地处理，不上传服务器</span>
          </div>
          {uploadedVideos.length===0&&(
            <div className="s1-intro-desc">先导入 3–5 个原始视频素材，进入下一步后可识别字幕并按字幕切分片段。</div>
          )}
          <div className="s1-content">
            {uploadedVideos.length===0?(
              <div className="s1-empty" onClick={handleImportClick}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                <p>点击或拖拽导入本地视频文件</p>
                <span>支持多选 · 仅在本地处理，不会上传到任何服务器</span>
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
                      {(()=>{
                        const ana=videoAnalysis[v.id]
                        const subSt=ana?.subtitleStatus   // pending/running/real/failed/none
                        const segCnt=ana?.segments?.length||0
                        const subCnt=ana?.subtitleCount||0
                        const status=ana?.status
                        if (!ana||status==='waiting') return <div className="s1-card-status s1-status-wait">等待识别…</div>
                        // subtitle running phase (non-blocking — segments already exist)
                        if (status==='done'&&(subSt==='pending'||subSt==='running'))
                          return <div className="s1-card-status s1-status-run">{ana.subtitlePhase||'字幕识别中…'} <span className="s1-seg-cnt">分段 {segCnt} 个</span></div>
                        if (status==='done'&&subSt==='failed') return (
                          <div className="s1-card-status s1-status-err" title={ana.subtitleError}>
                            <span className="s1-seg-cnt">分段 {segCnt} 个</span>
                            <span>· 字幕失败</span>
                            <button className="s1-retry-btn" onClick={()=>{
                              setVideoAnalysis(prev=>({...prev,[v.id]:{...prev[v.id],subtitleStatus:'pending',subtitleError:null}}))
                              enqueueTranscribe(v.id)
                            }}>重试</button>
                          </div>
                        )
                        return (
                          <div className="s1-card-status s1-status-done">
                            <span className={subSt==='real'?'s1-sub-ok':'s1-sub-none'}>{subSt==='real'?`字幕 ${subCnt} 条`:'暂无字幕'}</span>
                            <span className="s1-seg-cnt">分段 {segCnt} 个</span>
                          </div>
                        )
                      })()}
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
            {/* 其他素材说明 — 默认折叠，不干扰主流程 */}
            <div className="s1-guide-collapsible">
              <button className="s1-guide-toggle" onClick={()=>setShowAdvancedGuide(p=>!p)}>
                {showAdvancedGuide?'▲ 收起':'▼ 其他素材在哪里处理？（字幕文件 / 配音 / 精修方案）'}
              </button>
              {showAdvancedGuide&&(
                <div className="s1-guide s1-guide-inline">
                  <div className="s1-guide-grid">
                    <div className="s1-guide-card s1-gc-next">
                      <div className="s1-guide-card-head">
                        <span className="s1-guide-icon">📄</span>
                        <span className="s1-guide-label">字幕文件</span>
                        <span className="s1-guide-step-tag s1-tag-next">第二步</span>
                      </div>
                      <div className="s1-guide-desc">在第二步（字幕分段页）导入已识别好的字幕文件，或通过本地 tools/whisper 工具生成。字幕文件 ≠ 精修方案，请勿混淆。</div>
                    </div>
                    <div className="s1-guide-card s1-gc-later">
                      <div className="s1-guide-card-head">
                        <span className="s1-guide-icon">🎙</span>
                        <span className="s1-guide-label">最终语音 / 配音</span>
                        <span className="s1-guide-step-tag s1-tag-later">精修页</span>
                      </div>
                      <div className="s1-guide-desc">配音在精修页的「最终语音轨道」区域导入，不在这里操作。</div>
                    </div>
                    <div className="s1-guide-card s1-gc-later">
                      <div className="s1-guide-card-head">
                        <span className="s1-guide-icon">📦</span>
                        <span className="s1-guide-label">精修方案</span>
                        <span className="s1-guide-step-tag s1-tag-later">精修页</span>
                      </div>
                      <div className="s1-guide-desc">精修方案在精修页导出/恢复，不在这里操作。精修方案 ≠ 字幕文件。</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="step-footer">
            <div/>
            <button className={`step-next-btn ${uploadedVideos.length===0?'disabled':''}`} onClick={()=>uploadedVideos.length===0?showToast('请先导入视频素材'):setStep(2)}>
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
                            {editingCompSub?.compId===editingSeg?.compId&&editingCompSub?.segIdx===editingSeg?.segIdx ? (
                              <div className="r3-sub-edit-wrap" onClick={e=>e.stopPropagation()}>
                                <textarea
                                  className="r3-sub-edit-ta"
                                  value={editingCompSubText}
                                  onChange={e=>setEditingCompSubText(e.target.value)}
                                  autoFocus
                                  rows={3}
                                />
                                <div className="r3-sub-edit-acts">
                                  <button className="r3-sub-edit-save" onClick={()=>handleSaveCompSubEdit(editingSeg.compId,editingSeg.segIdx,editingCompSubText)}>保存字幕</button>
                                  <button className="r3-sub-edit-cancel" onClick={()=>{setEditingCompSub(null);setEditingCompSubText('')}}>取消</button>
                                </div>
                              </div>
                            ) : (
                              <div className="r3-cur-sub-wrap">
                                {col3SubText&&<div className="r3-cur-sub">{col3SubText}</div>}
                                <button className="r3-sub-edit-btn" onClick={e=>{e.stopPropagation();setEditingCompSub({compId:editingSeg.compId,segIdx:editingSeg.segIdx});setEditingCompSubText(col3SubText||'')}}>✎ 编辑字幕</button>
                              </div>
                            )}
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
                  const segSub=getSegSubtitleFromAna(seg,uploadedVideos[seg.videoIndex]?.id,videoAnalysis)
                  return (
                    <div key={seg.id+'_'+si}
                      className={`comp-seg-blk${isSelected?' editing':''}${isLocked?' locked':''}`}
                      style={{width:w,background:stc+'cc',borderTop:`3px solid ${stc}`}}
                      title={`${seg.label} · ${seg.type} · V${seg.videoIndex+1}\n${seg.startStr}–${seg.endStr} · ${fmt(dur)}${segSub?'\n字幕：'+segSub:''}`}
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
                      <span className="comp-seg-inline">
                        <span className="comp-seg-label">{seg.label}</span>
                        <span className="comp-seg-src"> V{seg.videoIndex+1}</span>
                        <span className="comp-seg-type">{seg.type}</span>
                      </span>
                      {segSub&&<span className="comp-seg-sub">{segSub.slice(0,24)}{segSub.length>24?'…':''}</span>}
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

          {/* ── refine view v0.7.2 ── */}
          {subStep==='refine'&&(()=>{
            const comp=compositions.find(c=>c.id===refineCompId)
            if (!comp) return (
              <div className="refine-error">未找到成品方案 <button onClick={()=>setSubStep('compose')}>← 返回</button></div>
            )
            const rc=defaultRcFor(refinedComps[comp.id])
            const deletedSegIdxs=rc.deletedSegIdxs
            const speedMap=rc.speedMap
            // v0.7.4: use editSegs timeline when cuts have been made
            const hasEditSegs=!!(rc.editSegs&&rc.editSegs.length>0)
            const {segments:derivedSegs,totalDuration:derivedDur}=hasEditSegs
              ?buildEditTimeline(rc.editSegs)
              :buildDerivedTimeline(comp,deletedSegIdxs,speedMap)
            // v0.7.4-hotfix: in editSegs mode, subtitles follow editSegs timeline
            const compSubs=hasEditSegs
              ?buildCompSubtitlesFromEditSegs(rc.editSegs,videoAnalysis,uploadedVideos)
              :buildCompSubtitles(comp,videoAnalysis,uploadedVideos)
            // current segment resolution
            const curDerivedEntry=derivedSegs.find(ds=>refinePrevPos>=ds.compStart&&refinePrevPos<ds.compEnd)||derivedSegs[0]
            // editSegs mode: track by esId; original mode: track by segIdx
            const curEsEntry=hasEditSegs?(derivedSegs.find(ds=>ds.esId===refineSelEsId)||curDerivedEntry):null
            const curSegIdx=refineSelSeg??curDerivedEntry?.segIdx??0
            const curSeg=hasEditSegs?curEsEntry?.seg:comp.segments[curSegIdx]
            const curVid=curSeg?uploadedVideos[curSeg.videoIndex]:null
            // cut readiness
            const MIN_CUT_GAP=0.2
            const cutEntry=derivedSegs.find(s=>refinePrevPos>s.compStart&&refinePrevPos<s.compEnd)
            let canCut=!!cutEntry, cannotCutReason=''
            if(cutEntry){
              const cutSrc=cutEntry.seg.startSec+(refinePrevPos-cutEntry.compStart)*cutEntry.speed
              if(cutSrc-cutEntry.seg.startSec<MIN_CUT_GAP||cutEntry.seg.endSec-cutSrc<MIN_CUT_GAP){canCut=false;cannotCutReason='太接近片段边界'}
            } else { cannotCutReason='播放头不在片段内' }
            const editDeletedCount=hasEditSegs?(rc.editSegs||[]).filter(s=>s.deleted).length:0
            const canUndoEdit=(rc.editSegsUndoStack||[]).length>0
            const playheadPct=derivedDur>0?Math.min(100,(refinePrevPos/derivedDur)*100):0
            const curSubIdx=compSubs.findIndex(s=>refinePrevPos>=s.compStart&&refinePrevPos<s.compEnd)
            const scriptText=rc.summaryScript
            const copyTask=COPY_TASKS.find(t=>t.key===refineCopyTask)||COPY_TASKS[0]
            const copyText=(rc.copywriting||{})[refineCopyTask]||''
            const copyPromptArr=COPY_PROMPT_MAP[refineCopyTask]  // array or null
            // for reference tasks: pick selected variant (default first)
            const copyPromptVariants=Array.isArray(copyPromptArr)?copyPromptArr:null
            const selVariantKey=refineCopyVariantKey||(copyPromptVariants?copyPromptVariants[0].key:null)
            const copyPrompt=copyPromptVariants?copyPromptVariants.find(v=>v.key===selVariantKey)||copyPromptVariants[0]:null
            const isDeleted=si=>deletedSegIdxs.includes(si)
            const getSpeed=si=>speedMap[si]??1
            const deletedCount=deletedSegIdxs.length
            const selSubPrompt=SUBTITLE_PROMPTS.find(p=>p.key===refineSubPromptKey)
            // save status helpers
            const scriptStatus=rc.scriptModified?'已修改未保存':rc.scriptSavedAt?`已保存 ${rc.scriptSavedAt.slice(11,16)}`:'未修改'
            const copyStatus=rc.copyModified?'已修改未保存':rc.copySavedAt?`已保存 ${rc.copySavedAt.slice(11,16)}`:'未修改'
            const planStatus=rc.savedAt?`方案已保存 ${rc.savedAt.slice(11,16)}`:'方案未保存'
            const planExportStatus=rc.planExportedAt?`已导出 ${rc.planExportedAt.slice(11,16)}`:''
            const planImportStatus=rc.planImportedAt?`已导入 ${rc.planImportedAt.slice(11,16)}`:''
            const voice=rc.voice||null
            const voiceMeta=rc.voiceMeta||null
            const hasVoiceForJianying = !!(voice || voiceMeta)
            const importReport=rc.importReport||null
            const muteOriginal=rc.audioPolicy?.muteOriginalVideo??false
            const voiceDur=voice?.duration??0
            const durDiff=voice?(voiceDur-derivedDur):0
            const durDiffStr=voice?(Math.abs(durDiff)<0.5?'基本一致'
              :durDiff>0?`视频短 ${fmt(Math.abs(durDiff))}`
              :`视频长 ${fmt(Math.abs(durDiff))}`):''

            // v0.7.5: trim drag — captures derivedDur, derivedSegs, comp.id
            const MIN_TRIM_SEG = 0.3
            const startTrimDrag = (e, edge, ds) => {
              e.stopPropagation()
              e.preventDefault()
              stopRefinePlay()
              const tlEl = refineTlRef.current; if(!tlEl) return
              const snapDur = derivedDur
              refineTlDragRef.current = {
                esId: ds.esId, edge,
                origStartSec: ds.seg.startSec, origEndSec: ds.seg.endSec,
                speed: ds.speed, compStart: ds.compStart,
                totalDur: snapDur,
                curStartSec: ds.seg.startSec, curEndSec: ds.seg.endSec,
                changed: false,
              }
              const onMove = (ev) => {
                const drag = refineTlDragRef.current; if(!drag) return
                const rect = tlEl.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (ev.clientX-rect.left)/rect.width))
                const compPos = ratio * drag.totalDur
                const srcPos = drag.origStartSec + (compPos - drag.compStart) * drag.speed
                if (drag.edge === 'tail') {
                  drag.curEndSec = Math.max(drag.origStartSec + MIN_TRIM_SEG, Math.min(drag.origEndSec, srcPos))
                } else {
                  drag.curStartSec = Math.max(drag.origStartSec, Math.min(drag.origEndSec - MIN_TRIM_SEG, srcPos))
                }
                drag.changed = true
                setRefineTrimState({ esId: drag.esId, edge: drag.edge, previewStartSec: drag.curStartSec, previewEndSec: drag.curEndSec })
              }
              const onUp = () => {
                document.removeEventListener('mousemove', onMove)
                document.removeEventListener('mouseup', onUp)
                const drag = refineTlDragRef.current
                if (drag && drag.changed && drag.curEndSec - drag.curStartSec >= MIN_TRIM_SEG) {
                  applyTrim(comp.id, drag.esId, drag.curStartSec, drag.curEndSec)
                }
                refineTlDragRef.current = null
                setRefineTrimState(null)
              }
              document.addEventListener('mousemove', onMove)
              document.addEventListener('mouseup', onUp)
            }

            return (
              <div className="refine-view">
                {/* Hidden voice file input */}
                <input type="file" accept="audio/*" style={{display:'none'}} ref={refineVoiceInputRef}
                  onChange={e=>{ const f=e.target.files?.[0]; if(f) importVoiceFile(comp.id,f); e.target.value='' }} />
                {/* Hidden background image input */}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{display:'none'}} ref={bgWrapInputRef}
                  onChange={e=>{ const f=e.target.files?.[0]; if(f) importBgImage(comp.id,f,derivedDur); e.target.value='' }} />
                {/* Hidden plan JSON import input */}
                <input type="file" accept=".json" style={{display:'none'}} ref={refinePlanImportRef}
                  onChange={e=>{ const f=e.target.files?.[0]; if(f) importRefinePlanFile(comp.id,f); e.target.value='' }} />
                {/* v0.9.8: Export pre-check modal (video / jianying 共用) */}
                {showExportCheck && exportCheckComp?.compId === comp.id && (
                  <ExportCheckModal
                    comp={exportCheckComp.comp}
                    rc={defaultRcFor(refinedComps[exportCheckComp.compId])}
                    sourceVideos={uploadedVideos}
                    mode={exportCheckComp.mode || 'video'}
                    exporting={
                      exportCheckComp.mode === 'jianying'
                        ? (jianyingExportStatus === 'loading')
                        : (refineExportStatus === 'loading')
                    }
                    onClose={()=>setShowExportCheck(false)}
                    onConfirm={()=>{
                      const mode = exportCheckComp.mode || 'video'
                      setShowExportCheck(false)
                      doConfirmedExport(exportCheckComp.compId, exportCheckComp.comp, mode)
                    }}
                  />
                )}
                {/* Banner */}
                <div className="refine-banner">
                  <button className="refine-back-btn" onClick={()=>{stopRefinePlay();setSubStep('compose')}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回组合方案
                  </button>
                  <span className="refine-banner-title">成品精修方案工作台</span>
                  {hasEditSegs&&<span className="refine-del-badge refine-cut-badge">✂ 精剪模式</span>}
                  {(hasEditSegs?editDeletedCount:deletedCount)>0&&<span className="refine-del-badge">{hasEditSegs?editDeletedCount:deletedCount} 段已删</span>}
                  <span className="refine-cur-comp-tag">
                    当前导出：{comp.name} / 共 {compositions.length} 条
                  </span>
                  <span className="refine-banner-dur">总时长 {fmt(derivedDur)}{derivedDur!==comp.totalDur?` （原 ${fmt(comp.totalDur)}）`:''}</span>
                  <div className="refine-proto-notice">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    所有修改保存进最终方案 · 暂未生成视频文件 · 后续导出阶段执行
                  </div>
                  <div className="refine-banner-actions">
                    <button className="refine-save-plan-btn" onClick={()=>saveRefinedPlan(comp.id)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                      保存
                    </button>
                    <button className="refine-export-now-btn" disabled={refineExportStatus==='loading'||jianyingExportStatus==='loading'}
                      onClick={()=>{stopRefinePlay();exportCurrentFromRefine(comp.id,comp)}}
                      title="弹出导出前检查，确认后直接导出这一条成品视频">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      {refineExportStatus==='loading'?'导出中…':'导出当前成品视频'}
                    </button>
                    <button className="refine-export-now-btn jianying-now-btn" disabled={refineExportStatus==='loading'||jianyingExportStatus==='loading'}
                      onClick={()=>{stopRefinePlay();exportCurrentToJianyingFromRefine(comp.id,comp)}}
                      title="一键生成剪映草稿；如当前没有现成 mp4，会自动先调 /export 准备一个中间 mp4">
                      <span style={{marginRight:1}}>🎬</span>
                      {jianyingExportStatus==='loading'?'生成中…':'导出到剪映草稿'}
                    </button>
                    <details className="refine-more-actions">
                      <summary className="refine-more-actions-toggle">更多操作</summary>
                      <div className="refine-more-actions-menu">
                        <button className="refine-export-plan-btn" onClick={()=>exportRefinePlan(comp.id,comp)}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          保存当前方案
                        </button>
                        <button className="refine-import-plan-btn" onClick={()=>refinePlanImportRef.current?.click()}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="17"/></svg>
                          恢复之前方案
                        </button>
                        <button className="refine-banner-legacy-link" onClick={()=>{stopRefinePlay();setSubStep('export-prep')}}
                          title="旧版多区导出页（备用，一般无需进入）">
                          高级 / 旧版导出
                        </button>
                      </div>
                    </details>
                  </div>
                  {refineExportStatus!=='idle'&&refineExportMsg&&(
                    <div className={`refine-export-now-msg ${refineExportStatus}`}>
                      {refineExportStatus==='loading'&&<span className="refine-export-now-spin"/>}
                      {refineExportMsg}
                      {refineExportStatus!=='loading'&&(
                        <button className="refine-export-now-close" title="关闭" onClick={()=>{setRefineExportStatus('idle');setRefineExportMsg('')}}>×</button>
                      )}
                    </div>
                  )}
                  {/* 剪映选项 + 状态：与视频导出按钮并列，状态在操作时连续展示 */}
                  <div className="jianying-export-block">
                    <div className="jianying-export-opts">
                      <label className="jianying-opt">
                        <input type="checkbox" checked={jianyingOpts.subtitle} onChange={e=>setJianyingOpts(o=>({...o,subtitle:e.target.checked}))}/>
                        <span>带字幕轨</span>
                      </label>
                      <label className={`jianying-opt${!hasVoiceForJianying?' disabled':''}`} title={!hasVoiceForJianying?'当前无独立配音文件':jianyingAudioTrackSupported?'':'当前版本配音已合成在视频中，独立音频轨下个版本支持'}>
                        <input type="checkbox" checked={jianyingOpts.voice} disabled={!hasVoiceForJianying||!jianyingAudioTrackSupported} onChange={e=>setJianyingOpts(o=>({...o,voice:e.target.checked}))}/>
                        <span>带配音音频轨</span>
                      </label>
                      <label className="jianying-opt" title="视频原声按当前成品导出逻辑（配音已合成进 mp4）">
                        <input type="checkbox" checked={jianyingOpts.keepOriginalAudio} onChange={e=>setJianyingOpts(o=>({...o,keepOriginalAudio:e.target.checked}))}/>
                        <span>保留视频原声</span>
                      </label>
                    </div>
                    {hasVoiceForJianying&&!jianyingAudioTrackSupported&&(
                      <div className="jianying-opt-hint">当前版本配音已合成在视频中，独立音频轨下个版本支持</div>
                    )}
                    {jianyingExportStatus!=='idle'&&jianyingExportMsg&&(
                      <div className={`refine-export-now-msg jianying ${jianyingExportStatus}`}>
                        {jianyingExportStatus==='loading'&&<span className="refine-export-now-spin"/>}
                        {jianyingExportStatus==='success'&&jianyingExportMsg}
                        {jianyingExportStatus==='error'&&(
                          <span>❌ {jianyingExportMsg}
                            <button className="refine-export-now-close" title="关闭" onClick={()=>{setJianyingExportStatus('idle');setJianyingExportMsg('')}}>×</button>
                          </span>
                        )}
                      </div>
                    )}
                    {jianyingExportStatus==='success'&&(
                      <div className="jianying-success-actions">
                        <button className="jianying-success-btn" onClick={openJianyingApp}
                          title="通过本地服务尝试启动剪映软件">
                          🚀 打开剪映
                        </button>
                        <button className="jianying-success-btn" onClick={openJianyingDraftFolder}
                          title={lastJianyingDraftPath ? `本地路径：${lastJianyingDraftPath}` : '通过本地服务打开草稿文件夹'}
                          disabled={!lastJianyingDraftPath}>
                          📁 打开草稿文件夹
                        </button>
                        {lastJianyingDraftName&&(
                          <span className="jianying-success-draftname" title={lastJianyingDraftPath}>
                            草稿名：{lastJianyingDraftName}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* v0.7.6-hotfix: Plan import integrity panel */}
                {importReport&&(
                  <div className="refine-import-report">
                    <div className="refine-import-report-head">
                      <span className="refine-import-report-title">方案导入检查</span>
                      <span className="refine-import-report-time">导入于 {importReport.importedAt.slice(11,16)}</span>
                      {importReport.legacyVoiceCompat&&<span className="refine-import-report-tag">已兼容旧语音字段</span>}
                      <button className="refine-import-report-close" title="关闭"
                        onClick={()=>setRefinedComps(prev=>({...prev,[comp.id]:{...defaultRcFor(prev[comp.id]),importReport:null}}))}>×</button>
                    </div>
                    <div className="refine-import-report-grid">
                      <span className={`refine-irk ${importReport.summaryScript?'ok':'miss'}`}>字幕稿：{importReport.summaryScript?'已恢复':'缺失'}</span>
                      <span className={`refine-irk ${importReport.copywriting?'ok':'miss'}`}>文案：{importReport.copywriting?'已恢复':'缺失'}</span>
                      <span className={`refine-irk ${importReport.editSegs?'ok':'miss'}`}>剪辑小段：{importReport.editSegs?'已恢复':'无切刀数据'}</span>
                      <span className={`refine-irk ${importReport.editsBasic?'ok':'miss'}`}>删除/调速：{importReport.editsBasic?'已恢复':'无修改'}</span>
                      <span className={`refine-irk ${importReport.audioPolicy?'ok':'miss'}`}>原视频声音策略：{importReport.audioPolicy?'已恢复':'缺失'}</span>
                      <span className={`refine-irk ${voice?'ok':(importReport.voiceFileName?'need':'miss')}`}>
                        最终语音：{voice?'已重新导入':(importReport.voiceFileName?`需要重新导入 ${importReport.voiceFileName}`:'未记录语音')}
                      </span>
                      {importReport.totalDuration>0&&<span className="refine-irk">视频方案时长：{fmt(importReport.totalDuration)}</span>}
                      {importReport.voiceDuration>0&&<span className="refine-irk">语音时长：{fmt(importReport.voiceDuration)}</span>}
                      {importReport.durationDiff!==null&&importReport.voiceDuration>0&&(
                        <span className="refine-irk">差值：{Math.abs(importReport.durationDiff)<0.5?'基本一致':importReport.durationDiff>0?`视频短 ${fmt(Math.abs(importReport.durationDiff))}`:`视频长 ${fmt(Math.abs(importReport.durationDiff))}`}</span>
                      )}
                    </div>
                    {importReport.voiceFileName&&!voice&&(
                      <div className="refine-import-report-hint">
                        方案中记录了最终语音文件：<b>{importReport.voiceFileName}</b>。请重新导入同名语音文件用于预览和后续导出。
                      </div>
                    )}
                  </div>
                )}

                {/* Body: main + right sidebar */}
                <div className="refine-body">
                  <div className="refine-main">

                    {/* Top 4-column row */}
                    <div className="refine-top">

                      {/* Col 1: Composition list */}
                      <div className="refine-cl">
                        <div className="refine-col-head">成品方案</div>
                        {compositions.map((c,ci)=>{
                          const crc=refinedComps[c.id]||{}
                          const isCur=c.id===comp.id
                          const status=crc.scriptModified||crc.copyModified?'已修改未保存':crc.savedAt?'已精修':''
                          return (
                            <div key={c.id}
                              className={`refine-cl-item${isCur?' active':''}`}
                              onClick={()=>!isCur&&switchRefineComp(c.id)}>
                              <span className="refine-cl-num">方案 {ci+1}</span>
                              <span className="refine-cl-name">{c.name}</span>
                              {status&&<span className={`refine-cl-status${crc.scriptModified||crc.copyModified?' dirty':' saved'}`}>{status}</span>}
                            </div>
                          )
                        })}
                        <div className="refine-cl-plan-note">
                          <div className="refine-cl-plan-item">
                            <span className="refine-cl-plan-lbl">删除</span>
                            <span className="refine-cl-plan-val">{deletedCount} 段</span>
                          </div>
                          <div className="refine-cl-plan-item">
                            <span className="refine-cl-plan-lbl">调速</span>
                            <span className="refine-cl-plan-val">{Object.keys(speedMap).length} 段</span>
                          </div>
                          <div className="refine-cl-plan-item">
                            <span className="refine-cl-plan-lbl">总时长</span>
                            <span className="refine-cl-plan-val">{fmt(derivedDur)}</span>
                          </div>
                          <div className={`refine-cl-plan-status${rc.savedAt?' ok':''}`}>{planStatus}</div>
                        </div>
                      </div>

                      {/* Col 2: Video preview */}
                      <div className="refine-vc">
                        <div className="refine-vc-head">
                          <span>预览 · {comp.name}</span>
                          <button className={`refine-tl-playbtn${refineIsPlaying?' playing':''}`}
                            onClick={()=>refineIsPlaying?stopRefinePlay():startRefinePlay(comp)}>
                            {refineIsPlaying
                              ?<><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>暂停</>
                              :<><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>播放</>}
                          </button>
                        </div>
                        {(()=>{
                          const rf=getCompReframe(comp.id)
                          const CONT_A=16/9
                          const tRatio=rf.enabled&&rf.aspect&&rf.aspect!=='保留原比例'?REFRAME_ASPECTS.find(a=>a.key===rf.aspect)?.ratio:null
                          let bW=100,bH=100,bL=0,bT=0
                          if(tRatio){
                            if(tRatio>CONT_A){bW=100;bH=parseFloat((100*CONT_A/tRatio).toFixed(2))}
                            else{bH=100;bW=parseFloat((100*tRatio/CONT_A).toFixed(2))}
                            bL=parseFloat(((100-bW)/2).toFixed(2));bT=parseFloat(((100-bH)/2).toFixed(2))
                          }
                          const aFSub=rc.finalSubtitles?.find(s=>refinePrevPos>=s.start&&refinePrevPos<s.end)
                          const fx=getPreviewFx(comp.id,rf)
                          return (
                        <div className="refine-video-wrap"
                          onClick={()=>{
                            if(rfDraggedRef.current){rfDraggedRef.current=false;return}
                            const vid=refinePrevRef.current; if(!vid||!curVid) return
                            if(refineIsPlayingRef.current) stopRefinePlay()
                            else if(refineVidPlaying) vid.pause()
                            else startRefinePlay(comp)
                          }}
                          onMouseDown={rf.enabled?(e)=>{
                            const el=e.currentTarget,sx=e.clientX,sy=e.clientY
                            const sox=rf.offsetX,soy=rf.offsetY,cw=el.clientWidth,ch=el.clientHeight
                            rfDraggedRef.current=false
                            const mv=(me)=>{const dx=me.clientX-sx,dy=me.clientY-sy;if(!rfDraggedRef.current&&Math.abs(dx)<3&&Math.abs(dy)<3)return;rfDraggedRef.current=true;setCompReframe(comp.id,{offsetX:Math.max(-0.5,Math.min(0.5,sox+dx/cw)),offsetY:Math.max(-0.5,Math.min(0.5,soy-dy/ch))})}
                            const mu=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',mu)}
                            document.addEventListener('mousemove',mv);document.addEventListener('mouseup',mu)
                          }:undefined}
                          style={{
                            cursor: rf.enabled?'grab':'pointer',
                            ...(fx.bg&&fx.bg.imageUrl?{backgroundImage:`url(${fx.bg.imageUrl})`,backgroundSize:'cover',backgroundPosition:'center'}:{}),
                          }}
                        >
                          {curVid?(
                            <video
                              ref={refinePrevRef}
                              key={curVid.id}
                              src={curVid.url}
                              preload="auto"
                              playsInline
                              muted={muteOriginal}
                              className="refine-video"
                              style={{transformOrigin:'center center',...(fx.transform?{transform:fx.transform}:{}),...(fx.filter?{filter:fx.filter}:{})}}
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
                                // editSegs mode (v0.7.4)
                                if(refineEditTimelineRef.current){
                                  const etl=refineEditTimelineRef.current
                                  const esIdx=refinePlayEsIdxRef.current
                                  const s=etl.segments[esIdx]; if(!s) return
                                  const offsetInSeg=(vid.currentTime-s.seg.startSec)/s.speed
                                  const compPos2=s.compStart+Math.max(0,offsetInSeg)
                                  setRefinePrevPos(compPos2)
                                  setRefineSelEsId(s.esId)
                                  // voice drift correction
                                  const aud2=refineVoiceRef.current
                                  if(aud2&&aud2.src&&!aud2.paused&&Math.abs(aud2.currentTime-compPos2)>0.3) aud2.currentTime=compPos2
                                  if(vid.currentTime>=s.seg.endSec-0.15){
                                    const nextEsIdx=esIdx+1
                                    if(nextEsIdx>=etl.segments.length){
                                      vid.pause(); if(aud2) aud2.pause(); setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成')
                                    } else {
                                      const nextS=etl.segments[nextEsIdx]
                                      refinePlayEsIdxRef.current=nextEsIdx
                                      if(nextS.seg.videoIndex===s.seg.videoIndex){ vid.currentTime=nextS.seg.startSec; vid.play().catch(()=>{}) }
                                      else { refinePrevSeekRef.current=nextS.seg.startSec }
                                    }
                                  }
                                  return
                                }
                                // original mode
                                const c2=compositionsRef.current.find(x=>x.id===refinePlayCompIdRef.current); if(!c2) return
                                const segIdx=refinePlaySegIdxRef.current
                                const seg2=c2.segments[segIdx]; if(!seg2) return
                                const rcNow=refinedComps[c2.id]||{}
                                const deletedNow=rcNow.deletedSegIdxs||[]
                                const speedNow=rcNow.speedMap||{}
                                const {segments:dsNow}=buildDerivedTimeline(c2,deletedNow,speedNow)
                                const dsEntry=dsNow.find(ds=>ds.segIdx===segIdx)
                                const spd2=dsEntry?.speed||1
                                const offsetInSeg=(vid.currentTime-seg2.startSec)/spd2
                                const posInComp=(dsEntry?.compStart||0)+Math.max(0,offsetInSeg)
                                setRefinePrevPos(posInComp)
                                setRefineSelSeg(segIdx)
                                // voice drift correction
                                const aud3=refineVoiceRef.current
                                if(aud3&&aud3.src&&!aud3.paused&&Math.abs(aud3.currentTime-posInComp)>0.3) aud3.currentTime=posInComp
                                if(vid.currentTime>=seg2.endSec-0.15){
                                  const activeIdxs2=c2.segments.map((_,i)=>i).filter(i=>!deletedNow.includes(i))
                                  const curActivePos=activeIdxs2.indexOf(segIdx)
                                  const nextSegIdx=curActivePos>=0&&curActivePos<activeIdxs2.length-1?activeIdxs2[curActivePos+1]:-1
                                  if(nextSegIdx<0){
                                    vid.pause(); if(aud3) aud3.pause(); setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成')
                                  } else {
                                    const nextSeg2=c2.segments[nextSegIdx]
                                    refinePlaySegIdxRef.current=nextSegIdx; setRefinePlaySegIdx(nextSegIdx)
                                    if(nextSeg2.videoIndex===seg2.videoIndex){ vid.currentTime=nextSeg2.startSec; vid.play().catch(()=>{}) }
                                    else { refinePrevSeekRef.current=nextSeg2.startSec }
                                  }
                                }
                              }}
                              onEnded={()=>{
                                if(!refineIsPlayingRef.current) return
                                if(refineEditTimelineRef.current){
                                  const nextIdx=refinePlayEsIdxRef.current+1
                                  if(nextIdx>=refineEditTimelineRef.current.segments.length){ refineVoiceRef.current?.pause(); setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成') }
                                  return
                                }
                                const c2=compositionsRef.current.find(x=>x.id===refinePlayCompIdRef.current); if(!c2) return
                                const rcNow=refinedComps[c2.id]||{}
                                const deletedNow=rcNow.deletedSegIdxs||[]
                                const activeIdxs2=c2.segments.map((_,i)=>i).filter(i=>!deletedNow.includes(i))
                                const curPos2=activeIdxs2.indexOf(refinePlaySegIdxRef.current)
                                if(curPos2<0||curPos2>=activeIdxs2.length-1){ refineVoiceRef.current?.pause(); setRefineIsPlaying(false); refineIsPlayingRef.current=false; showToast('播放完成') }
                              }}
                            />
                          ):(
                            <div className="refine-no-vid">点击时间轴选择片段</div>
                          )}
                          {tRatio&&(
                            <div style={{position:'absolute',left:`${bL}%`,top:`${bT}%`,width:`${bW}%`,height:`${bH}%`,boxShadow:'0 0 0 9999px rgba(0,0,0,0.45)',border:'2px solid rgba(255,255,255,0.8)',pointerEvents:'none',zIndex:2,boxSizing:'border-box'}}/>
                          )}
                          {fx.border&&(
                            <div style={{position:'absolute',inset:0,border:'10px solid rgba(255,255,255,0.9)',pointerEvents:'none',zIndex:2,boxSizing:'border-box'}}/>
                          )}
                          {aFSub&&(()=>{
                            const ss=getCompSubStyle(comp.id)
                            const previewFs=Math.round(ss.fontSize*270/1080)
                            const namedCol=COLOR_OPTIONS.find(([c])=>c===ss.color)?.[1]
                            const col=namedCol||(ss.color?.startsWith('#')?ss.color:'#fff')
                            const namedOC=ss.outlineColor==='black'?'#000':ss.outlineColor==='white'?'#fff':(ss.outlineColor?.startsWith('#')?ss.outlineColor:'#000')
                            const ts=ss.outline?`0 0 ${ss.outlineWidth}px ${namedOC},1px 1px ${Math.ceil(ss.outlineWidth/2)}px ${namedOC}`:'none'
                            const bMode=ss.backgroundMode||'none'
                            const bgAlpha=ss.backgroundOpacity??0.45
                            const bgCss={'black':`rgba(0,0,0,${bgAlpha})`,'white':`rgba(255,255,255,${bgAlpha})`,'yellow':`rgba(255,255,0,${bgAlpha})`,'red':`rgba(255,51,51,${bgAlpha})`}[ss.backgroundColor||'black']||`rgba(0,0,0,${bgAlpha})`
                            const outerBg=bMode==='bar'?bgCss:'transparent'
                            const fontFam=FONT_FAMILY_CSS[ss.fontFamily]||ss.fontFamily||'sans-serif'
                            const hasCustomPos=ss.subtitleX!=null&&ss.subtitleY!=null
                            const posStyle=hasCustomPos
                              ?{left:`${ss.subtitleX}%`,top:`${ss.subtitleY}%`,transform:'translate(-50%,-50%)',width:`${bW}%`}
                              :{left:`${bL}%`,bottom:`calc(${bT}% + 6px)`,width:`${bW}%`}
                            return (
                            <div
                              style={{position:'absolute',...posStyle,textAlign:'center',color:col,fontSize:previewFs,fontWeight:700,textShadow:ts,background:outerBg,pointerEvents:'auto',zIndex:3,lineHeight:1.5,boxSizing:'border-box',fontFamily:fontFam,padding:bMode==='bar'?'2px 4px':0,cursor:'grab',userSelect:'none'}}
                              onMouseDown={e=>{
                                e.stopPropagation()
                                const startX=e.clientX,startY=e.clientY
                                const sx=ss.subtitleX??50,sy=ss.subtitleY??85
                                const cr=e.currentTarget.parentElement.getBoundingClientRect()
                                let dragged=false
                                const mv=(me)=>{
                                  const dx=(me.clientX-startX)/cr.width*100
                                  const dy=(me.clientY-startY)/cr.height*100
                                  if(!dragged&&Math.abs(dx)<0.5&&Math.abs(dy)<0.5)return
                                  dragged=true; subDragRef.current=true
                                  setCompSubStyle(comp.id,{subtitleX:Math.max(2,Math.min(98,sx+dx)),subtitleY:Math.max(2,Math.min(98,sy+dy))})
                                }
                                const mu=()=>{
                                  document.removeEventListener('mousemove',mv)
                                  document.removeEventListener('mouseup',mu)
                                  setTimeout(()=>{subDragRef.current=false},100)
                                }
                                document.addEventListener('mousemove',mv)
                                document.addEventListener('mouseup',mu)
                              }}
                            >
                              {aFSub.text.split('\n').map((l,li)=>(
                                bMode==='text'
                                  ?<div key={li}><span style={{background:bgCss,padding:'2px 8px',borderRadius:3,display:'inline-block'}}>{l||' '}</span></div>
                                  :<div key={li}>{l||' '}</div>
                              ))}
                            </div>
                            )
                          })()}
                          <div className={`refine-play-btn${refineVidPlaying?' playing':''}`}>
                            {refineVidPlaying
                              ?<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                              :<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff"><polygon points="6 3 20 12 6 21 6 3"/></svg>}
                          </div>
                          {getCompStickers(comp.id).filter(stk=>effectActiveAt(stk,refinePrevPos)).map(stk=>(
                            <div key={stk.id}
                              className={`refine-sticker${stk.isEmoji?' emoji':' badge'}${selectedEffectId===stk.id?' selected':''}`}
                              style={{left:`${stk.x??50}%`,top:`${stk.y??50}%`,transform:`translate(-50%,-50%) scale(${stk.scale||1})`,opacity:stk.opacity??1}}
                              onMouseDown={e=>{
                                e.stopPropagation()
                                const startX=e.clientX,startY=e.clientY
                                const sx=stk.x??50,sy=stk.y??50
                                const cr=e.currentTarget.parentElement.getBoundingClientRect()
                                const mv=(me)=>{
                                  rfDraggedRef.current=true
                                  updateStickerPos(comp.id,stk.id,
                                    Math.max(0,Math.min(100,sx+(me.clientX-startX)/cr.width*100)),
                                    Math.max(0,Math.min(100,sy+(me.clientY-startY)/cr.height*100)))
                                }
                                const mu=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',mu)}
                                document.addEventListener('mousemove',mv);document.addEventListener('mouseup',mu)
                              }}
                            >
                              {stk.isEmoji?stk.emoji:stk.text}
                              <span className="refine-sticker-del" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();deleteSticker(comp.id,stk.id)}}>×</span>
                              <span className="refine-sticker-scale-up" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();resizeSticker(comp.id,stk.id,0.2)}}>+</span>
                              <span className="refine-sticker-scale-dn" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();resizeSticker(comp.id,stk.id,-0.2)}}>−</span>
                            </div>
                          ))}
                        </div>
                          )
                        })()}
                        <div className="refine-video-meta">
                          {curSeg?(
                            <>
                              <span style={{color:SEG_TYPE_COLORS[curSeg.type]||'#6366f1',fontWeight:600}}>{curSeg.label}</span>
                              <span className="refine-vm-dot">·</span>
                              <span className="refine-vm-type">{curSeg.type}</span>
                              <span className="refine-vm-dot">·</span>
                              <span className="refine-vm-vsrc">V{curSeg.videoIndex+1}</span>
                              {isDeleted(curSegIdx)&&<span className="refine-vm-del">已标删</span>}
                              {getSpeed(curSegIdx)!==1&&<span className="refine-vm-spd">×{getSpeed(curSegIdx)}</span>}
                            </>
                          ):<span className="refine-vm-hint">模拟预览</span>}
                          <span className="refine-vm-spacer"/>
                          <span className="refine-vm-time">{fmt(refinePrevPos)}/{fmt(derivedDur)}</span>
                        </div>
                        {curSubIdx>=0&&compSubs[curSubIdx]&&(
                          <div className="refine-vc-cursub"><span style={{fontSize:9,color:'var(--text-muted)',marginRight:3,opacity:0.7}}>参考</span>{compSubs[curSubIdx].text}</div>
                        )}
                      </div>

                      {/* Col 2b: Canvas framing (画面取景) */}
                      <div className="refine-reframe">
                        <div className="refine-col-head">
                          <span>画面取景</span>
                          {(()=>{const rf=getCompReframe(comp.id);return rf.enabled?<span className="refine-save-status saved">{rf.aspect} · {Math.round(rf.scale*100)}%</span>:<span className="refine-save-status">未启用</span>})()}
                        </div>
                        {(()=>{
                          const rf = getCompReframe(comp.id)
                          return (<>
                            <div className="refine-rf-toggle-row">
                              <label className={`ep-toggle-label ${rf.enabled?'on':''}`} onClick={()=>setCompReframe(comp.id,{enabled:!rf.enabled})}>
                                <span className={`ep-toggle-pill ${rf.enabled?'on':''}`}/>
                                {rf.enabled?'取景已开启':'开启取景模式'}
                              </label>
                              {rf.enabled&&<button className="refine-tb-btn" onClick={()=>setCompReframe(comp.id,{enabled:false,aspect:'保留原比例',scale:1.0,offsetX:0,offsetY:0})}>重置</button>}
                            </div>
                            {rf.enabled&&(<>
                              <div className="refine-rf-aspects">
                                {[{key:'保留原比例',label:'原比例'},{key:'16:9',label:'16:9'},{key:'4:3',label:'4:3'},{key:'3:4',label:'3:4'},{key:'9:16',label:'9:16'},{key:'1:1',label:'1:1'},{key:'2:1',label:'2:1'},{key:'2.35:1',label:'2.35:1'}].map(a=>(
                                  <button key={a.key} className={`ep-sg-btn ep-sg-btn-xs ${rf.aspect===a.key?'active':''}`}
                                    onClick={()=>setCompReframe(comp.id,{aspect:a.key})}>{a.label}</button>
                                ))}
                              </div>
                              <div className="refine-rf-row">
                                <span className="ep-ss-lbl" style={{width:36}}>放大</span>
                                <span className="refine-rf-mm">×1</span>
                                <input type="range" min="1.0" max="3.0" step="0.05" value={rf.scale}
                                  onChange={e=>setCompReframe(comp.id,{scale:parseFloat(e.target.value)})}
                                  className="ep-range" style={{flex:1}}/>
                                <span className="refine-rf-mm">×3</span>
                                <span className="ep-ss-val" style={{minWidth:34}}>{Math.round(rf.scale*100)}%</span>
                                <button className="refine-rf-rst" onClick={()=>setCompReframe(comp.id,{scale:1.0})} title="重置放大">↺</button>
                              </div>
                              <div className="refine-rf-row">
                                <span className="ep-ss-lbl" style={{width:36}}>上移</span>
                                <span className="refine-rf-mm">-50</span>
                                <input type="range" min="-0.5" max="0.5" step="0.01" value={rf.offsetY}
                                  onChange={e=>setCompReframe(comp.id,{offsetY:parseFloat(e.target.value)})}
                                  className="ep-range" style={{flex:1}}/>
                                <span className="refine-rf-mm">+50</span>
                                <span className="ep-ss-val" style={{minWidth:34}}>{rf.offsetY>0?'+':''}{Math.round(rf.offsetY*100)}%</span>
                                <button className="refine-rf-rst" onClick={()=>setCompReframe(comp.id,{offsetY:0})} title="重置上移">↺</button>
                              </div>
                              <div className="refine-rf-row">
                                <span className="ep-ss-lbl" style={{width:36}}>右移</span>
                                <span className="refine-rf-mm">-50</span>
                                <input type="range" min="-0.5" max="0.5" step="0.01" value={rf.offsetX}
                                  onChange={e=>setCompReframe(comp.id,{offsetX:parseFloat(e.target.value)})}
                                  className="ep-range" style={{flex:1}}/>
                                <span className="refine-rf-mm">+50</span>
                                <span className="ep-ss-val" style={{minWidth:34}}>{rf.offsetX>0?'+':''}{Math.round(rf.offsetX*100)}%</span>
                                <button className="refine-rf-rst" onClick={()=>setCompReframe(comp.id,{offsetX:0})} title="重置右移">↺</button>
                              </div>
                              <div className="ep-ss-hint" style={{marginTop:6}}>放大+上移可把底部原字幕裁出画面</div>
                              {rf.aspect&&rf.aspect!=='保留原比例'&&rf.scale<1.5&&(
                                <div className="ep-ss-hint" style={{marginTop:3,color:'var(--warn,#f59e0b)'}}>
                                  ⚠ 画面较小，导出可能出现黑边，请手动放大或移动
                                </div>
                              )}
                            </>)}
                          </>)
                        })()}
                      </div>

                      {/* Col 3: Summary script + final subtitles */}
                      <div className="refine-sc">
                        <div className="refine-sc-tabs">
                          <button className={`refine-sc-tab${refineSubTab==='script'?' active':''}`} onClick={()=>setRefineSubTab('script')}>最终字幕稿</button>
                          <button className={`refine-sc-tab${refineSubTab==='subs'?' active':''}`} onClick={()=>setRefineSubTab('subs')}>
                            成品字幕
                            {rc.finalSubtitles&&rc.finalSubtitles.length>0&&(
                              <span className={`refine-sc-tab-badge ${rc.finalSubtitlesSavedAt?'ok':'warn'}`}>
                                {rc.finalSubtitlesSavedAt?`✓${rc.finalSubtitles.length}`:`${rc.finalSubtitles.length}*`}
                              </span>
                            )}
                          </button>
                          <button className={`refine-sc-tab${refineSubTab==='style'?' active':''}`} onClick={()=>setRefineSubTab('style')}>🎨 字幕样式</button>
                        </div>
                        {refineSubTab==='script'&&<>
                        <div className="refine-col-head">
                          <span>最终字幕稿</span>
                          <span className={`refine-save-status${rc.scriptModified?' dirty':rc.scriptSavedAt?' saved':''}`}>{scriptStatus}</span>
                        </div>
                        <div className="refine-sc-desc">当前成品的最终字幕稿，也是生成本条配音的文案。可直接修改，也可复制出去给外部 AI 改写后再粘回来。</div>
                        <textarea
                          className="refine-textarea"
                          placeholder={'点击"从逐句生成"自动填入，或直接粘贴 AI 改写后的字幕稿...'}
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
                            navigator.clipboard.writeText(scriptText).then(()=>showToast('已复制')).catch(()=>showToast('复制失败，请手动 Ctrl+C'))
                          }} disabled={!scriptText}>复制字幕稿</button>
                          <button className="refine-tb-btn" onClick={async ()=>{
                            try {
                              const text = await navigator.clipboard.readText()
                              if (!text.trim()) { showToast('剪贴板为空'); return }
                              if (!window.confirm(`是否用剪贴板内容覆盖当前字幕汇总稿？\n\n前100字：\n${text.slice(0,100)}${text.length>100?'...':''}`)) return
                              updateRefinedComp(comp.id, {summaryScript: text, scriptModified: true})
                              showToast('已粘贴外部改写稿，点击"保存最终字幕稿"确认')
                            } catch {
                              showToast('无法自动读取剪贴板，请直接在上方文本框 Ctrl+V 粘贴')
                            }
                          }}>粘贴改写稿</button>
                          <button className="refine-tb-btn" onClick={()=>{
                            downloadTextFile(scriptText,`${comp.name}_字幕稿.txt`)
                          }} disabled={!scriptText}>导出 TXT</button>
                          <button className="refine-tb-btn success" onClick={()=>saveScript(comp.id)} disabled={!rc.scriptModified}>保存最终字幕稿</button>
                        </div>
                        <div className="refine-prompt-section">
                          <div className="refine-prompt-head">字幕改写提示词 <span className="refine-prompt-hint">（复制后到 DeepSeek/豆包 改写，结果粘回上方）</span></div>
                          <select className="refine-copy-task-select" value={refineSubPromptKey||''} onChange={e=>setRefineSubPromptKey(e.target.value)}>
                            {SUBTITLE_PROMPTS.map(p=>(<option key={p.key} value={p.key}>{p.label}</option>))}
                          </select>
                          {selSubPrompt&&(
                            <div className="refine-prompt-preview">
                              <div className="refine-prompt-text">{selSubPrompt.text}<span className="refine-prompt-placeholder">（字幕稿自动插入）</span></div>
                              <button className="refine-tb-btn primary" style={{marginTop:5}} onClick={()=>{
                                const full=selSubPrompt.text+(scriptText||'[请先生成汇总稿]')
                                navigator.clipboard.writeText(full).then(()=>showToast('提示词+字幕稿 已复制'))
                              }}>复制提示词+字幕稿</button>
                            </div>
                          )}
                        </div>
                        </>}
                        {refineSubTab==='subs'&&(
                          <div className="refine-subs-editor">
                            <div className="refine-subs-head">
                              <div className="refine-subs-status">
                                {rc.finalSubtitles&&rc.finalSubtitles.length>0
                                  ?(rc.finalSubtitlesSavedAt
                                    ?<span className="rs-status ok">成品字幕：已保存 {rc.finalSubtitles.length} 句{rc.subtitleAlign?.status==='aligned'?' · 已自动对齐':''}</span>
                                    :(rc.subtitleAlign?.status==='aligned'
                                      ?<span className="rs-status warn">成品字幕：已自动对齐，未保存（{rc.finalSubtitles.length} 句）</span>
                                      :<span className="rs-status warn">成品字幕：粗略生成，未与配音自动对齐（{rc.finalSubtitles.length} 句，未保存）</span>))
                                  :<span className="rs-status miss">成品字幕：最终导出使用，请先生成</span>}
                              </div>
                            </div>
                            <div className="refine-subs-toolbar">
                              <button className="refine-tb-btn primary" onClick={()=>handleGenerateSubs(comp.id,comp,rc)}>
                                {rc.finalSubtitles&&rc.finalSubtitles.length>0?'重新生成':'从字幕稿生成'}
                              </button>
                              <button className="refine-tb-btn align" disabled={alignBusyId===comp.id}
                                onClick={()=>alignSubtitles(comp.id,comp,rc)}
                                title="用本条配音做本地语音识别，自动对齐字幕时间轴">
                                {alignBusyId===comp.id?'对齐中…':'🎯 自动对齐配音'}
                              </button>
                              {rc.finalSubtitles&&rc.finalSubtitles.length>0&&<>
                                <button className="refine-tb-btn" onClick={()=>clearSubPunct(comp.id)}>清理标点</button>
                                <button className="refine-tb-btn"
                                  onClick={()=>undoSubOp(comp.id)}
                                  disabled={!(subHistory[comp.id]?.length)}
                                  title={subHistory[comp.id]?.length?`可撤销 ${subHistory[comp.id].length} 步`:'暂无可撤销操作'}
                                >撤销字幕</button>
                                <button className="refine-tb-btn success" onClick={()=>saveFinalSubtitles(comp.id)}>保存字幕</button>
                              </>}
                            </div>
                            {!(rc.finalSubtitles&&rc.finalSubtitles.length>0)?(
                              <div className="refine-subs-empty">
                                {rc.summaryScript?.trim()
                                  ?'点击「从字幕稿生成」自动拆分字幕，然后逐句检查修改'
                                  :'请先填写并保存最终字幕稿，再生成成品字幕'}
                              </div>
                            ):(
                              <div className="refine-subs-list">
                                {rc.finalSubtitles.map((sub,i)=>{
                                  const fmtT=s=>{const m=Math.floor(s/60),sec=(s%60).toFixed(1);return`${m}:${String(sec).padStart(4,'0')}`}
                                  return (
                                    <div key={sub.id||i} className="refine-subs-row">
                                      <span className="refine-subs-idx">{i+1}</span>
                                      <div className="refine-subs-times">
                                        <span className="refine-subs-time">
                                          <button className="rs-adj" onClick={()=>adjustSubTime(comp.id,sub.id||`s${i}`,'start',-0.1)}>‹</button>
                                          {fmtT(sub.start)}
                                          <button className="rs-adj" onClick={()=>adjustSubTime(comp.id,sub.id||`s${i}`,'start',0.1)}>›</button>
                                        </span>
                                        <span className="refine-subs-sep">→</span>
                                        <span className="refine-subs-time">
                                          <button className="rs-adj" onClick={()=>adjustSubTime(comp.id,sub.id||`s${i}`,'end',-0.1)}>‹</button>
                                          {fmtT(sub.end)}
                                          <button className="rs-adj" onClick={()=>adjustSubTime(comp.id,sub.id||`s${i}`,'end',0.1)}>›</button>
                                        </span>
                                      </div>
                                      <textarea className="refine-subs-input"
                                        value={sub.text}
                                        rows={sub.text.includes('\n')?2:1}
                                        onChange={e=>updateSubText(comp.id,sub.id||`s${i}`,e.target.value)}
                                        onKeyDown={e=>e.stopPropagation()}
                                        onFocus={()=>{
                                          const k=comp.id+':'+(sub.id||`s${i}`)
                                          if(subEditSnapRef.current!==k){recordSubSnapshot(comp.id);subEditSnapRef.current=k}
                                        }}
                                        onBlur={()=>{subEditSnapRef.current=null}}
                                      />
                                      <div className="refine-subs-ops">
                                        <div style={{position:'relative'}}>
                                          <button className="rs-op rs-split-btn" title="拆分字幕" onClick={e=>{e.stopPropagation();const k=sub.id||`s${i}`;setSplitMenuSubId(splitMenuSubId===k?null:k)}}>拆分</button>
                                          {splitMenuSubId===(sub.id||`s${i}`)&&(
                                            <div className="rs-split-menu">
                                              <button className="rs-split-opt" onClick={()=>{showToast('请把光标移到想断行的位置，直接按 Enter 即可换成两行');setSplitMenuSubId(null)}}>换成两行（手动回车）</button>
                                              <button className="rs-split-opt" onClick={()=>{
                                                const sk=sub.id||`s${i}`
                                                const t1=window.prompt('前半句：',sub.text.split(/[，,。！？；]/)[0]||sub.text.slice(0,Math.ceil(sub.text.length/2)))
                                                if(t1===null){setSplitMenuSubId(null);return}
                                                const t2=window.prompt('后半句：',sub.text.slice(t1.length)||sub.text.slice(Math.ceil(sub.text.length/2)))
                                                if(t2===null){setSplitMenuSubId(null);return}
                                                splitSub(comp.id,sk,t1,t2);setSplitMenuSubId(null)
                                              }}>拆成两条</button>
                                            </div>
                                          )}
                                        </div>
                                        <button className="rs-op" title="合并上一条" onClick={()=>mergeSub(comp.id,sub.id||`s${i}`)} disabled={i===0}>⤴</button>
                                        <button className="rs-op rs-del" title="删除本句" onClick={()=>deleteSub(comp.id,sub.id||`s${i}`)}>×</button>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                        {refineSubTab==='style'&&(()=>{
                          const ss=getCompSubStyle(comp.id)
                          const bMode=ss.backgroundMode||'none'
                          const bgAlpha=ss.backgroundOpacity??0.45
                          const bgCss={'black':`rgba(0,0,0,${bgAlpha})`,'white':`rgba(255,255,255,${bgAlpha})`,'yellow':`rgba(255,255,0,${bgAlpha})`,'red':`rgba(255,51,51,${bgAlpha})`}[ss.backgroundColor||'black']||`rgba(0,0,0,${bgAlpha})`
                          const namedCol=COLOR_OPTIONS.find(([c])=>c===ss.color)?.[1]
                          const textCol=namedCol||(ss.color?.startsWith('#')?ss.color:'#fff')
                          const namedOC=ss.outlineColor==='black'?'#000':ss.outlineColor==='white'?'#fff':(ss.outlineColor?.startsWith('#')?ss.outlineColor:'#000')
                          const ts=ss.outline?`0 0 ${ss.outlineWidth}px ${namedOC},1px 1px ${Math.ceil(ss.outlineWidth/2)}px ${namedOC}`:'none'
                          const fontFam=FONT_FAMILY_CSS[ss.fontFamily]||ss.fontFamily
                          const pickerVal=namedCol||ss.color||'#ffffff'
                          const outPickerVal=ss.outlineColor?.startsWith('#')?ss.outlineColor:(ss.outlineColor==='black'?'#000000':'#ffffff')
                          return (
                          <div className="refine-style-tab" style={{overflowY:'auto',flex:1}}>
                            {/* 字体 */}
                            <div className="rss-section">
                              <span className="rss-label">字体</span>
                              <div className="rss-btn-wrap">
                                {FONT_OPTIONS.map(([f,l])=>(
                                  <button key={f} className={`rss-btn ${ss.fontFamily===f?'active':''}`}
                                    style={{fontFamily:FONT_FAMILY_CSS[f]||f}}
                                    onClick={()=>setCompSubStyle(comp.id,{fontFamily:f})}>{l}</button>
                                ))}
                              </div>
                            </div>
                            {/* 字号 */}
                            <div className="rss-row">
                              <span className="rss-label">字号</span>
                              <div className="rss-btn-wrap" style={{gap:3}}>
                                {[['小',48],['中',60],['大',72],['超大',90]].map(([l,n])=>(
                                  <button key={n} className={`rss-btn ${ss.fontSize===n?'active':''}`}
                                    onClick={()=>setCompSubStyle(comp.id,{fontSize:n})}>{l}</button>
                                ))}
                              </div>
                              <input type="range" min="32" max="120" step="2" value={ss.fontSize}
                                onChange={e=>setCompSubStyle(comp.id,{fontSize:parseInt(e.target.value)})}
                                className="rss-range" style={{flex:1,margin:'0 6px'}}/>
                              <span className="rss-val rss-val-lg">{ss.fontSize}<small>px</small></span>
                            </div>
                            {/* 颜色 */}
                            <div className="rss-row">
                              <span className="rss-label">字色</span>
                              <div className="rss-btn-wrap">
                                {COLOR_OPTIONS.map(([c,hex,l])=>(
                                  <button key={c} className={`rss-color-btn ${ss.color===c?'active':''}`}
                                    style={{background:hex}} title={l}
                                    onClick={()=>setCompSubStyle(comp.id,{color:c})}/>
                                ))}
                              </div>
                              <input type="color" value={pickerVal.length===7?pickerVal:'#ffffff'}
                                onChange={e=>setCompSubStyle(comp.id,{color:e.target.value})}
                                className="rss-color-picker" title="自定义颜色"/>
                            </div>
                            {/* 描边 */}
                            <div className="rss-row">
                              <span className="rss-label">描边</span>
                              <button className={`rss-btn ${!ss.outline?'active':''}`} onClick={()=>setCompSubStyle(comp.id,{outline:false})}>无</button>
                              <button className={`rss-btn ${ss.outline&&ss.outlineColor==='black'&&ss.outlineWidth<6?'active':''}`} onClick={()=>setCompSubStyle(comp.id,{outline:true,outlineColor:'black',outlineWidth:4})}>黑边</button>
                              <button className={`rss-btn ${ss.outline&&ss.outlineColor==='white'&&ss.outlineWidth<6?'active':''}`} onClick={()=>setCompSubStyle(comp.id,{outline:true,outlineColor:'white',outlineWidth:4})}>白边</button>
                              <button className={`rss-btn ${ss.outline&&ss.outlineWidth>=6?'active':''}`} onClick={()=>setCompSubStyle(comp.id,{outline:true,outlineColor:'black',outlineWidth:7})}>粗黑边</button>
                              {ss.outline&&<>
                                <input type="range" min="1" max="8" step="1" value={ss.outlineWidth}
                                  onChange={e=>setCompSubStyle(comp.id,{outlineWidth:parseInt(e.target.value)})}
                                  className="rss-range" style={{width:60,margin:'0 4px'}}/>
                                <span className="rss-val">{ss.outlineWidth}px</span>
                                <input type="color" value={outPickerVal}
                                  onChange={e=>setCompSubStyle(comp.id,{outlineColor:e.target.value})}
                                  className="rss-color-picker" title="描边颜色"/>
                              </>}
                            </div>
                            {/* 背景 */}
                            <div className="rss-row">
                              <span className="rss-label">背景</span>
                              {[['none','无'],['text','文字板'],['bar','整行条']].map(([m,l])=>(
                                <button key={m} className={`rss-btn ${bMode===m?'active':''}`}
                                  onClick={()=>setCompSubStyle(comp.id,{backgroundMode:m})}>{l}</button>
                              ))}
                              {bMode!=='none'&&<>
                                {[['black','黑'],['white','白'],['yellow','黄'],['red','红']].map(([c,l])=>(
                                  <button key={c} className={`rss-btn ${(ss.backgroundColor||'black')===c?'active':''}`}
                                    onClick={()=>setCompSubStyle(comp.id,{backgroundColor:c})}>{l}</button>
                                ))}
                                <input type="range" min="0.1" max="0.85" step="0.05" value={bgAlpha}
                                  onChange={e=>setCompSubStyle(comp.id,{backgroundOpacity:parseFloat(e.target.value)})}
                                  className="rss-range" style={{width:60,margin:'0 4px'}}/>
                                <span className="rss-val">{Math.round(bgAlpha*100)}%</span>
                              </>}
                            </div>
                            {/* 位置 + 边距 */}
                            <div className="rss-row">
                              <span className="rss-label">位置</span>
                              {[['bottom','底部'],['lower','中下'],['middle','中间'],['top','顶部']].map(([p,l])=>(
                                <button key={p} className={`rss-btn ${ss.position===p?'active':''}`}
                                  onClick={()=>setCompSubStyle(comp.id,{position:p})}>{l}</button>
                              ))}
                              <span className="rss-label" style={{marginLeft:6}}>边距</span>
                              <input type="range" min="10" max="300" step="5" value={ss.marginV}
                                onChange={e=>setCompSubStyle(comp.id,{marginV:parseInt(e.target.value)})}
                                className="rss-range" style={{flex:1,margin:'0 4px'}}/>
                              <span className="rss-val">{ss.marginV}px</span>
                            </div>
                            {/* 拖动位置 */}
                            {(ss.subtitleX!=null||ss.subtitleY!=null)&&(
                              <div className="rss-row" style={{marginTop:4}}>
                                <span className="rss-label" style={{color:'var(--accent)'}}>拖动中</span>
                                <span style={{fontSize:10,color:'var(--text-muted)',flex:1}}>X:{Math.round(ss.subtitleX??50)}% Y:{Math.round(ss.subtitleY??85)}%</span>
                                <button className="rss-btn" onClick={()=>setCompSubStyle(comp.id,{subtitleX:null,subtitleY:null})}>重置位置</button>
                              </div>
                            )}
                            {(ss.subtitleX==null&&ss.subtitleY==null)&&(
                              <div style={{fontSize:10,color:'var(--text-muted)',marginTop:4}}>💡 在左侧视频画面拖动字幕可自定义位置</div>
                            )}
                            {/* 预览 */}
                            <div className="rss-preview-wrap" style={{marginTop:8}}>
                              <div className="rss-preview" style={{
                                fontFamily:fontFam,color:textCol,textShadow:ts,
                                background:bMode==='bar'?bgCss:'transparent',
                                padding:bMode==='bar'?'3px 8px':0,
                              }}>
                                <span style={{
                                  background:bMode==='text'?bgCss:'transparent',
                                  padding:bMode==='text'?'3px 10px':0,
                                  borderRadius:bMode==='text'?3:0,
                                  display:'inline-block',
                                }}>字幕样式预览 · 欢迎使用</span>
                              </div>
                              <button className="rss-btn rss-reset-btn" onClick={()=>setCompSubStyle(comp.id,{...DEFAULT_SUB_STYLE})}>恢复默认</button>
                            </div>
                          </div>
                          )
                        })()}
                      </div>

                      {/* Col 4: Copywriting (dropdown-based) */}
                      <div className="refine-cc">
                        <div className="refine-col-head">
                          <span>文案改写</span>
                          <span className={`refine-save-status${rc.copyModified?' dirty':rc.copySavedAt?' saved':''}`}>{copyStatus}</span>
                        </div>
                        <select className="refine-copy-task-select"
                          value={refineCopyTask}
                          onChange={e=>{setRefineCopyTask(e.target.value);setRefineCopyVariantKey(null)}}>
                          {COPY_TASKS.map(t=>(
                            <option key={t.key} value={t.key}>{t.label}</option>
                          ))}
                        </select>
                        <textarea
                          className="refine-textarea refine-copy-body"
                          placeholder={copyTask.placeholder}
                          value={copyText}
                          onChange={e=>{
                            const newCW={...(rc.copywriting||{}),[refineCopyTask]:e.target.value}
                            updateRefinedComp(comp.id,{copywriting:newCW,copyModified:true})
                          }}
                        />
                        <div className="refine-toolbar">
                          <button className="refine-tb-btn" onClick={()=>{
                            navigator.clipboard.writeText(copyText).then(()=>showToast('已复制'))
                          }} disabled={!copyText}>复制内容</button>
                          <button className="refine-tb-btn success" onClick={()=>saveCopywriting(comp.id)} disabled={!rc.copyModified}>保存文案</button>
                        </div>
                        {copyPromptVariants&&(
                          <div className="refine-prompt-section">
                            <div className="refine-prompt-head">改写提示词 <span className="refine-prompt-hint">（复制→DeepSeek/豆包→结果粘到"我的"任务）</span></div>
                            <select className="refine-copy-task-select" value={selVariantKey||''} onChange={e=>setRefineCopyVariantKey(e.target.value)}>
                              {copyPromptVariants.map(v=>(<option key={v.key} value={v.key}>{v.label}</option>))}
                            </select>
                            {copyPrompt&&(
                              <div className="refine-prompt-preview">
                                <div className="refine-prompt-text" style={{fontSize:10}}>{copyPrompt.text.slice(0,80)}…<span className="refine-prompt-placeholder">（对标内容+字幕稿自动插入）</span></div>
                                <button className="refine-tb-btn primary" style={{marginTop:5}} onClick={()=>{
                                  const refContent=copyText||'（尚未填写对标内容）'
                                  const script=scriptText||'（尚未生成字幕稿）'
                                  const full=copyPrompt.text+refContent+'\n\n【我的视频字幕/口播稿】\n'+script
                                  navigator.clipboard.writeText(full).then(()=>showToast('提示词+对标内容+字幕 已复制'))
                                }}>复制（提示词 + 对标 + 我的字幕）</button>
                              </div>
                            )}
                          </div>
                        )}
                        {!copyPrompt&&(
                          <div className="refine-copy-ref-hint">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            这里粘贴 AI 改写好的最终内容并保存。如需改写，先在"对标"任务中粘贴参考内容，然后复制提示词发给 AI。
                          </div>
                        )}
                        <div className="refine-voice-section">
                          <div className="refine-voice-hint">
                            口播稿定稿后，请在下方"最终语音轨道"导入生成好的语音。
                          </div>
                        </div>
                      </div>
                    </div>{/* end refine-top */}

                    {/* v0.9.8h1: 时间线效果层 — 添加贴图/去重/背景（都带 start/end，在下方效果轨控制时长）*/}
                    {(()=>{
                      const curEntry = hasEditSegs ? (curEsEntry||curDerivedEntry) : (derivedSegs.find(ds=>ds.segIdx===curSegIdx)||curDerivedEntry)
                      const curRange = curEntry ? {start:r2(curEntry.compStart), end:r2(curEntry.compEnd)} : {start:0, end:r2(derivedDur)}
                      const stickerList = getCompStickers(comp.id)
                      const dedupeList = getDedupeEffects(comp.id)
                      const bgList = getBackgroundEffects(comp.id)
                      return (
                    <div className="refine-extra-row">
                      {/* 贴图 */}
                      <div className="refine-extra-panel">
                        <div className="refine-extra-head" onClick={()=>setShowStickerPanel(v=>!v)}>
                          🎨 贴图贴纸 ({stickerList.length}) {showStickerPanel?'▾':'▸'}
                        </div>
                        {showStickerPanel&&(<>
                          <div className="refine-fx-tip">点击添加 → 默认从播放头开始持续 3 秒 · 可在下方「贴图轨」拖动调整时段</div>
                          <div className="refine-sticker-grid">
                            {STICKER_PRESETS.map(p=>(
                              <button key={p.key} className="refine-sticker-preset"
                                onClick={()=>addSticker(comp.id,p,derivedDur)}>
                                <span>{p.isEmoji?p.emoji:p.text}</span>
                                <small>{p.label}</small>
                              </button>
                            ))}
                            {stickerList.length>0&&(
                              <button className="refine-sticker-preset" style={{borderColor:'var(--danger,#f33)',color:'var(--danger,#f33)'}}
                                onClick={()=>{updateRefinedComp(comp.id,{stickers:[]});setSelectedEffectId(null)}}>
                                <span>🗑</span><small>清空</small>
                              </button>
                            )}
                          </div>
                          <div className="refine-fx-note">说明：文字贴图可导出；emoji / 图片贴图暂不导出（导出前检查会提示）</div>
                        </>)}
                      </div>
                      {/* 去重/滤镜 */}
                      <div className="refine-extra-panel">
                        <div className="refine-extra-head" onClick={()=>setShowDedupPanel(v=>!v)}>
                          ⚙ 去重 / 滤镜 ({dedupeList.length}) {showDedupPanel?'▾':'▸'}
                        </div>
                        {showDedupPanel&&(<>
                          <div className="refine-fx-tip">去重按片段/时段生效（不再整条统一）· 默认很轻，不加噪点</div>
                          <div className="rss-row" style={{gap:6,flexWrap:'wrap'}}>
                            <button className="refine-tb-btn primary" onClick={()=>addDedupeEffect(comp.id,curRange.start,curRange.end,curSeg?.label||'去重')}>＋ 作用当前片段</button>
                            <button className="refine-tb-btn" onClick={()=>{const w=defaultEffWindow(derivedDur);addDedupeEffect(comp.id,w.start,w.end,'去重')}}>＋ 从播放头+3秒</button>
                          </div>
                          {dedupeList.length===0&&<div className="refine-fx-note">还没有去重效果。选中片段后点「作用当前片段」。</div>}
                          {dedupeList.map(eff=>(
                            <div key={eff.id} className={`refine-fx-item${selectedEffectId===eff.id?' selected':''}`} onClick={()=>setSelectedEffectId(eff.id)}>
                              <div className="refine-fx-item-head">
                                <span className="refine-fx-item-name">{eff.label||'去重'}</span>
                                <span className="refine-fx-item-time">{fmt(eff.start)}–{fmt(eff.end)}</span>
                                <button className="refine-fx-item-del" onClick={e=>{e.stopPropagation();deleteEffectItem(comp.id,'dedupeEffects',eff.id)}}>✕</button>
                              </div>
                              <div className="dedup-grid">
                                {[['mirror','镜像','⇔'],['brightness','亮度','☀'],['contrast','对比','◑'],['saturation','饱和','🎨'],['scale','缩放','⊞'],['border','边框','▢']].map(([k,label,ico])=>(
                                  <label key={k} className={`dedup-chip ${(eff.params||{})[k]?'on':''}`} onClick={e=>e.stopPropagation()}>
                                    <input type="checkbox" checked={!!(eff.params||{})[k]} onChange={()=>toggleDedupeParam(comp.id,eff.id,k)}/>
                                    <span className="dedup-chip-ico">{ico}</span><span>{label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </>)}
                      </div>
                      {/* 背景包装 */}
                      <div className="refine-extra-panel">
                        <div className="refine-extra-head" onClick={()=>setShowBgWrapPanel(v=>!v)}>
                          🖼 背景包装 ({bgList.length}) {showBgWrapPanel?'▾':'▸'}
                        </div>
                        {showBgWrapPanel&&(
                          <div className="refine-bgwrap-panel">
                            <div className="refine-fx-tip">导入背景图 → 默认作用全程 · 可在下方「背景轨」调整时段，并调视频主体位置/缩放</div>
                            <div className="rss-row">
                              <button className="refine-tb-btn primary" onClick={()=>bgWrapInputRef.current?.click()}>＋ 导入背景图</button>
                            </div>
                            {bgList.length===0&&<div className="refine-fx-note">还没有背景效果。</div>}
                            {bgList.map(eff=>(
                              <div key={eff.id} className={`refine-fx-item${selectedEffectId===eff.id?' selected':''}`} onClick={()=>setSelectedEffectId(eff.id)}>
                                <div className="refine-fx-item-head">
                                  {eff.imageUrl&&<div className="refine-bgwrap-preview" style={{backgroundImage:`url(${eff.imageUrl})`,width:28,height:28}}/>}
                                  <span className="refine-fx-item-name">{eff.imageFileName||'背景'}</span>
                                  <span className="refine-fx-item-time">{fmt(eff.start)}–{fmt(eff.end)}</span>
                                  <button className="refine-fx-item-del" onClick={e=>{e.stopPropagation();deleteEffectItem(comp.id,'backgroundEffects',eff.id)}}>✕</button>
                                </div>
                                <div className="rss-row">
                                  <button className="refine-tb-btn" style={{fontSize:10}} onClick={e=>{e.stopPropagation();updateEffectItem(comp.id,'backgroundEffects',eff.id,{start:0,end:r2(derivedDur)})}}>全程</button>
                                  <button className="refine-tb-btn" style={{fontSize:10}} onClick={e=>{e.stopPropagation();updateEffectItem(comp.id,'backgroundEffects',eff.id,{start:curRange.start,end:curRange.end})}}>当前片段</button>
                                </div>
                                <div className="rss-row">
                                  <span className="rss-label">视频缩放</span>
                                  <input type="range" min="0.4" max="1.0" step="0.01" value={eff.videoScale||0.8} className="rss-range" style={{flex:1}}
                                    onClick={e=>e.stopPropagation()} onChange={e=>updateEffectItem(comp.id,'backgroundEffects',eff.id,{videoScale:parseFloat(e.target.value)})}/>
                                  <span className="rss-val">{Math.round((eff.videoScale||0.8)*100)}%</span>
                                </div>
                                <div className="rss-row">
                                  <span className="rss-label">水平</span>
                                  <input type="range" min="-40" max="40" step="1" value={eff.videoX||0} className="rss-range" style={{flex:1}}
                                    onClick={e=>e.stopPropagation()} onChange={e=>updateEffectItem(comp.id,'backgroundEffects',eff.id,{videoX:parseFloat(e.target.value)})}/>
                                  <span className="rss-val">{eff.videoX||0}%</span>
                                </div>
                                <div className="rss-row">
                                  <span className="rss-label">垂直</span>
                                  <input type="range" min="-40" max="40" step="1" value={eff.videoY||0} className="rss-range" style={{flex:1}}
                                    onClick={e=>e.stopPropagation()} onChange={e=>updateEffectItem(comp.id,'backgroundEffects',eff.id,{videoY:parseFloat(e.target.value)})}/>
                                  <span className="rss-val">{eff.videoY||0}%</span>
                                </div>
                                {!eff.storedFileName&&<div className="ep-ss-hint" style={{color:'var(--warn,#f59e0b)'}}>⚠ 背景图未同步到本地服务，导出时将跳过此背景</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                      )
                    })()}

                    {/* Timeline (derived: deleted = absent, speed = width change) */}
                    <div className="refine-tl-section">
                      <div className="refine-tl-controls">
                        <button className={`refine-tl-playbtn${refineIsPlaying?' playing':''}`}
                          onClick={()=>refineIsPlaying?stopRefinePlay():startRefinePlay(comp)}>
                          {refineIsPlaying
                            ?<><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>暂停</>
                            :<><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>播放</>}
                        </button>
                        <span className="refine-tl-timestr">{fmt(refinePrevPos)} / {fmt(derivedDur)}</span>
                        <span className="refine-tl-seg-hint">{derivedSegs.length} 段（共 {comp.segments.length} 段）· 总时长 {fmt(derivedDur)}</span>
                        {(hasEditSegs?editDeletedCount:deletedCount)>0&&<span className="refine-tl-markct">已删 {hasEditSegs?editDeletedCount:deletedCount} 段</span>}
                        {refineTrimState&&(
                          <span className="refine-tl-trim-indicator">
                            {refineTrimState.edge==='tail'?'✂ 裁尾':'✂ 裁头'}
                            {' '}{fmt(refineTrimState.previewEndSec-refineTrimState.previewStartSec)}
                            {' → '}{refineTrimState.edge==='tail'?fmt(refineTrimState.previewEndSec):fmt(refineTrimState.previewStartSec)}
                          </span>
                        )}
                      </div>
                      <div className="refine-timeline"
                        ref={refineTlRef}
                        onMouseDown={e=>{
                          // Skip if clicking on a trim handle (they stop propagation)
                          if(e.target.classList.contains('refine-tl-trim-l')||e.target.classList.contains('refine-tl-trim-r')) return
                          e.stopPropagation()
                          stopRefinePlay()
                          const tlEl=e.currentTarget
                          const updateFromClientX=(clientX)=>{
                            const rect=tlEl.getBoundingClientRect()
                            const ratio=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width))
                            const derivedPos=ratio*derivedDur
                            setRefinePrevPos(derivedPos)
                            const ds=derivedSegs.find(s=>derivedPos>=s.compStart&&derivedPos<s.compEnd)||derivedSegs[derivedSegs.length-1]
                            if(ds){
                              if(hasEditSegs) setRefineSelEsId(ds.esId)
                              else setRefineSelSeg(ds.segIdx)
                              const offsetInSeg=(derivedPos-ds.compStart)*ds.speed
                              const seekT=ds.seg.startSec+Math.min(Math.max(0,offsetInSeg),ds.seg.endSec-ds.seg.startSec-0.01)
                              refinePrevSeekRef.current=seekT
                              const vid=refinePrevRef.current
                              if(vid&&vid.readyState>=2) vid.currentTime=seekT
                              const aud=refineVoiceRef.current
                              if(aud&&aud.src){ aud.currentTime=derivedPos; setRefineVoicePos(derivedPos) }
                            }
                          }
                          updateFromClientX(e.clientX)
                          const onMove=ev=>{ ev.preventDefault(); updateFromClientX(ev.clientX) }
                          const onUp=()=>{
                            document.removeEventListener('mousemove',onMove)
                            document.removeEventListener('mouseup',onUp)
                          }
                          document.addEventListener('mousemove',onMove)
                          document.addEventListener('mouseup',onUp)
                        }}>
                        {derivedSegs.map((ds)=>{
                          const isActive=hasEditSegs
                            ?ds.esId===(refineSelEsId||curDerivedEntry?.esId)
                            :ds.segIdx===curSegIdx
                          // v0.7.5: apply trim preview width
                          const trim=refineTrimState&&refineTrimState.esId===ds.esId
                          const dispStartSec=trim?refineTrimState.previewStartSec:ds.seg.startSec
                          const dispEndSec=trim?refineTrimState.previewEndSec:ds.seg.endSec
                          const dispDur=(dispEndSec-dispStartSec)/Math.max(0.1,ds.speed)
                          const w=`${derivedDur>0?(dispDur/derivedDur)*100:0}%`
                          const stc=SEG_TYPE_COLORS[ds.seg.type]||'#6366f1'
                          return (
                            <div key={hasEditSegs?ds.esId:ds.segIdx}
                              className={`refine-tl-seg${isActive?' active':''}`}
                              style={{width:w,background:stc+(isActive?'ee':'88'),borderTop:`3px solid ${stc}`}}>
                              <span className="refine-tl-seg-lbl">{ds.seg.label}{ds.speed!==1?` ×${ds.speed}`:''}</span>
                            </div>
                          )
                        })}
                        <div className="refine-tl-playhead" style={{left:`${playheadPct}%`}}>
                          <div className="refine-tl-ph-dot"/>
                        </div>
                      </div>
                    </div>

                    {/* v0.9.8h1: 时间线效果轨 — 贴图 / 去重 / 背景，可拖动改时段、拖边缘改时长 */}
                    {(()=>{
                      const tracks = [
                        { field:'stickers', label:'贴图', color:'#a855f7', items:getCompStickers(comp.id).map(s=>({...s, name:s.isEmoji?s.emoji:s.text})) },
                        { field:'dedupeEffects', label:'去重', color:'#10b981', items:getDedupeEffects(comp.id).map(e=>({...e, name:Object.entries(e.params||{}).filter(([,v])=>v).map(([k])=>({mirror:'镜像',brightness:'亮度',contrast:'对比',saturation:'饱和',scale:'缩放',border:'边框'}[k])).join('+')||'去重'})) },
                        { field:'backgroundEffects', label:'背景', color:'#f59e0b', items:getBackgroundEffects(comp.id).map(e=>({...e, name:e.imageFileName||'背景'})) },
                      ]
                      const pct = (v)=>derivedDur>0?Math.max(0,Math.min(100,(v/derivedDur)*100)):0
                      return (
                        <div className="refine-fx-tracks" ref={effTlRef}>
                          {tracks.map(tr=>(
                            <div key={tr.field} className="refine-fx-track">
                              <span className="refine-fx-track-label" style={{color:tr.color}}>{tr.label}</span>
                              <div className="refine-fx-track-lane">
                                {tr.items.length===0&&<span className="refine-fx-track-empty">在上方面板添加{tr.label}效果</span>}
                                {tr.items.map(it=>{
                                  const left=pct(it.start), width=Math.max(2,pct(it.end)-pct(it.start))
                                  return (
                                    <div key={it.id}
                                      className={`refine-fx-block${selectedEffectId===it.id?' selected':''}`}
                                      style={{left:`${left}%`,width:`${width}%`,background:tr.color+(selectedEffectId===it.id?'ee':'aa'),borderColor:tr.color}}
                                      title={`${it.name} ${fmt(it.start)}–${fmt(it.end)}`}
                                      onMouseDown={e=>startEffectDrag(e,comp.id,tr.field,it,'move',derivedDur)}>
                                      <span className="refine-fx-block-handle l" onMouseDown={e=>startEffectDrag(e,comp.id,tr.field,it,'l',derivedDur)}/>
                                      <span className="refine-fx-block-name">{it.name}</span>
                                      <span className="refine-fx-block-handle r" onMouseDown={e=>startEffectDrag(e,comp.id,tr.field,it,'r',derivedDur)}/>
                                    </div>
                                  )
                                })}
                                <div className="refine-fx-track-playhead" style={{left:`${playheadPct}%`}}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}

                    {/* Voice track section */}
                    <div className="refine-voice-track">
                      <div className="refine-vt-head">
                        <span className="refine-vt-label">本条成品配音 <span className="refine-vt-comp-badge">{comp.name}</span></span>
                        <button className="refine-tb-btn primary" onClick={()=>refineVoiceInputRef.current?.click()}>
                          {voice?'更换配音':'+ 导入本条配音'}
                        </button>
                        {voice&&(
                          <button className="refine-tb-btn danger" onClick={()=>{
                            if (!window.confirm('确认删除本条成品的配音？')) return
                            const a=refineVoiceRef.current; if(a){a.pause();a.src=''}
                            updateRefinedComp(comp.id,{voice:null,voiceMeta:null})
                            showToast('本条成品配音已删除')
                          }}>删除配音</button>
                        )}
                        <label className={`refine-vt-mute-toggle${muteOriginal?' on':''}`} title="控制预览时原视频的音频是否播放">
                          <input type="checkbox" checked={muteOriginal} onChange={()=>toggleMuteOriginal(comp.id)} style={{display:'none'}}/>
                          {muteOriginal?'原视频已静音':'原视频有声'}
                        </label>
                      </div>
                      {voice?(
                        <div className="refine-vt-body">
                          <audio ref={refineVoiceRef} src={voice.url} preload="auto"
                            onPlay={()=>setRefineVoicePlaying(true)}
                            onPause={()=>setRefineVoicePlaying(false)}
                            onTimeUpdate={()=>{ const a=refineVoiceRef.current; if(a){ setRefineVoicePos(a.currentTime); if(!refineIsPlayingRef.current) setRefinePrevPos(a.currentTime) } }}
                            onEnded={()=>setRefineVoicePlaying(false)}/>
                          <div className="refine-vt-info">
                            <span className="refine-vt-filename" title={voice.fileName}>{voice.fileName}</span>
                            <span className="refine-vt-dur">{fmt(voiceDur)}</span>
                          </div>
                          <div className="refine-vt-controls">
                            <button className={`refine-tb-btn${refineVoicePlaying?' active':''}`} onClick={()=>{
                              const a=refineVoiceRef.current; if(!a) return
                              refineVoicePlaying?a.pause():a.play().catch(()=>{})
                            }}>{refineVoicePlaying?'⏸ 暂停':'▶ 播放配音'}</button>
                            <span className="refine-vt-pos">{fmt(refineVoicePos)} / {fmt(voiceDur)}</span>
                            {refinePrevPos>voiceDur+0.1&&<span className="refine-vt-over">已超过配音长度</span>}
                          </div>
                          {(()=>{
                            // shared timescale: video & voice share one ruler (v0.9.2-hotfix-3)
                            const tlDur=Math.max(derivedDur,voiceDur||0)||1
                            const playPct=Math.min(100,Math.max(0,(refinePrevPos/tlDur)*100))
                            const voicePct=Math.min(100,(voiceDur/tlDur)*100)
                            const seekFromClientX=(clientX,el)=>{
                              const rect=el.getBoundingClientRect()
                              const ratio=Math.max(0,Math.min(1,(clientX-rect.left)/rect.width))
                              const t=ratio*tlDur
                              const aud=refineVoiceRef.current
                              if(aud&&aud.src) aud.currentTime=Math.min(t,voiceDur||0)
                              setRefineVoicePos(Math.min(t,voiceDur||0))
                              setRefinePrevPos(t)
                              const ds=derivedSegs.find(s=>t>=s.compStart&&t<s.compEnd)||derivedSegs[derivedSegs.length-1]
                              if(ds){
                                if(hasEditSegs) setRefineSelEsId(ds.esId); else setRefineSelSeg(ds.segIdx)
                                const offsetInSeg=(t-ds.compStart)*ds.speed
                                const seekT=ds.seg.startSec+Math.min(Math.max(0,offsetInSeg),ds.seg.endSec-ds.seg.startSec-0.01)
                                refinePrevSeekRef.current=seekT
                                const vid=refinePrevRef.current
                                if(vid&&vid.readyState>=2) vid.currentTime=seekT
                              }
                            }
                            return (
                              <div className="refine-vt-track-row">
                                <div className="refine-vt-track" onMouseDown={e=>{
                                  stopRefinePlay()
                                  const el=e.currentTarget
                                  seekFromClientX(e.clientX,el)
                                  const onMove=ev=>{ ev.preventDefault(); seekFromClientX(ev.clientX,el) }
                                  const onUp=()=>{ document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp) }
                                  document.addEventListener('mousemove',onMove)
                                  document.addEventListener('mouseup',onUp)
                                }}>
                                  <div className="refine-vt-track-fill" style={{width:`${voicePct}%`}}/>
                                  {voicePct<99.5&&<div className="refine-vt-track-gap" style={{left:`${voicePct}%`}} title="此段无配音"/>}
                                  <div className="refine-vt-track-playhead" style={{left:`${playPct}%`}}/>
                                </div>
                              </div>
                            )
                          })()}
                          <div className={`refine-vt-diff${Math.abs(durDiff)<0.5?' ok':durDiff>0?' short':' long'}`}>
                            <span className="refine-vt-diff-item">视频方案时长 <b>{fmt(derivedDur)}</b></span>
                            <span className="refine-vt-diff-item">本条配音时长 <b>{fmt(voiceDur)}</b></span>
                            <span className="refine-vt-diff-item">差值：<b>{durDiffStr}</b></span>
                          </div>
                          <div className="refine-vt-sync-hint">点击上方播放按钮时，视频与本条配音同步播放</div>
                        </div>
                      ):voiceMeta?.fileName?(
                        <div className="refine-vt-empty refine-vt-need-reimport">
                          方案中记录了 <b>{voiceMeta.fileName}</b>（{fmt(voiceMeta.duration||0)}）。请重新导入同名配音文件以恢复预览。
                        </div>
                      ):(
                        <div className="refine-vt-empty">导入本条成品的配音后，可在此对比视频时长和配音时长。<br/>点击上方播放按钮时，视频与本条配音会同步播放。</div>
                      )}
                    </div>

                    {/* Ops panel */}
                    <div className="refine-ops-section">
                      {curSeg?(()=>{
                        const tc=SEG_TYPE_COLORS[curSeg.type]||'#6366f1'
                        const rawDur=curSeg.endSec-curSeg.startSec

                        // ── editSegs mode (v0.7.4) ──
                        if(hasEditSegs){
                          const esDeleted=curEsEntry?!!(rc.editSegs||[]).find(s=>s.id===curEsEntry.esId)?.deleted:false
                          return (
                            <div className="refine-ops-inner">
                              {/* Cut toolbar */}
                              <div className="refine-cut-section">
                                <div className="refine-cut-head">
                                  <span className="refine-cut-title">✂ 精剪操作</span>
                                  <span className="refine-cut-hint">{cannotCutReason&&!canCut?cannotCutReason:''}</span>
                                </div>
                                <div className="refine-cut-flow-hint">推荐操作：拖动播放头找位置 → 切一刀 → 再切一刀 → 选中中间多余小段 → 删除</div>
                                <div className="refine-cut-btns">
                                  <button className="refine-cut-btn primary" disabled={!canCut}
                                    title={canCut?'在当前播放位置切分片段':cannotCutReason}
                                    onClick={()=>cutAtPos(comp.id,comp)}>✂ 切一刀</button>
                                  {canUndoEdit&&(
                                    <button className="refine-cut-btn" onClick={()=>undoEditSegs(comp.id)}>↩ 撤销</button>
                                  )}
                                </div>
                              </div>
                              {/* Current edit seg card */}
                              {curEsEntry&&(
                                <div className="refine-seg-card">
                                  <div className="refine-seg-card-top">
                                    <span className="refine-seg-label" style={{color:tc}}>{curSeg.label}</span>
                                    {curSeg.type&&<span className="refine-seg-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{curSeg.type}</span>}
                                    <span className="refine-seg-vsrc">V{curSeg.videoIndex+1}</span>
                                    {esDeleted&&<span className="refine-seg-del-badge">已删除</span>}
                                  </div>
                                  <div className="refine-seg-card-meta">
                                    {fmt(curSeg.startSec)} – {fmt(curSeg.endSec)} · {fmt(rawDur)}
                                  </div>
                                  <div className="refine-seg-card-meta">
                                    成品位置：{fmt(curEsEntry.compStart)} – {fmt(curEsEntry.compEnd)}
                                  </div>
                                  <div className="refine-ops-row">
                                    {esDeleted?(
                                      <button className="refine-op-btn restore" onClick={()=>restoreEditSeg(comp.id,curEsEntry.esId)}>↩ 恢复此小段</button>
                                    ):(
                                      <button className="refine-op-btn danger" onClick={()=>{ deleteEditSeg(comp.id,curEsEntry.esId); stopRefinePlay() }}>✕ 删除此小段</button>
                                    )}
                                  </div>
                                  {!esDeleted&&(()=>{
                                    const esSpd=(rc.editSegs||[]).find(s=>s.id===curEsEntry.esId)?.speed??1
                                    return (
                                      <div className="refine-speed-section">
                                        <div className="refine-speed-label">⏩ 调速（只作用当前片段 · 对着配音调节节奏）</div>
                                        <div className="refine-speed-row">
                                          {[0.5,0.75,0.9,1,1.25,1.5,2].map(s=>(
                                            <button key={s} className={`refine-speed-btn${esSpd===s?' active':''}`}
                                              onClick={()=>{setEditSegSpeed(comp.id,curEsEntry.esId,s);stopRefinePlay();showToast(`${curSeg.label} 速度 ×${s}，成品时长 ${fmt(rawDur/s)}`)}}>
                                              {s===1?'1× 默认':`×${s}`}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}
                              {/* EditSegs full summary */}
                              <div className="refine-actions-summary">
                                <div className="refine-actions-head">精剪方案（{(rc.editSegs||[]).filter(s=>!s.deleted).length} 段有效 / {(rc.editSegs||[]).length} 段总计 · {fmt(derivedDur)}）</div>
                                {(rc.editSegs||[]).map((es,i)=>{
                                  const esTC=SEG_TYPE_COLORS[es.type]||'#6366f1'
                                  const isCurEs=curEsEntry?.esId===es.id
                                  return (
                                    <div key={es.id}
                                      className={`refine-action-row refine-es-row${es.deleted?' deleted':''}${isCurEs?' current':''}`}
                                      onClick={()=>setRefineSelEsId(es.id)}>
                                      <span className="refine-es-status">{es.deleted?'✕':'✓'}</span>
                                      <span className="refine-action-target" style={{color:esTC}}>{es.label}</span>
                                      <span className="refine-action-val">{fmt(es.endSec-es.startSec)}</span>
                                      <button className="refine-action-del" onClick={e=>{e.stopPropagation();es.deleted?restoreEditSeg(comp.id,es.id):deleteEditSeg(comp.id,es.id)}}>
                                        {es.deleted?'↩':'✕'}
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        }

                        // ── original deletedSegIdxs mode ──
                        const deleted=isDeleted(curSegIdx)
                        const spd=getSpeed(curSegIdx)
                        const actualDur=rawDur/Math.max(0.1,spd)
                        const dsEntry=derivedSegs.find(ds=>ds.segIdx===curSegIdx)
                        return (
                          <div className="refine-ops-inner">
                            {/* Cut toolbar (first cut initializes editSegs mode) */}
                            <div className="refine-cut-section">
                              <div className="refine-cut-head">
                                <span className="refine-cut-title">✂ 精剪操作</span>
                                <span className="refine-cut-hint">{cannotCutReason&&!canCut?cannotCutReason:''}</span>
                              </div>
                              <div className="refine-cut-flow-hint">推荐操作：拖动播放头找位置 → 切一刀 → 再切一刀 → 选中中间多余小段 → 删除</div>
                              <div className="refine-cut-btns">
                                <button className="refine-cut-btn primary" disabled={!canCut}
                                  title={canCut?'在当前播放位置切分片段（进入精剪模式）':cannotCutReason}
                                  onClick={()=>cutAtPos(comp.id,comp)}>✂ 切一刀</button>
                              </div>
                            </div>
                            <div className="refine-seg-card">
                              <div className="refine-seg-card-top">
                                <span className="refine-seg-label" style={{color:tc}}>{curSeg.label}</span>
                                <span className="refine-seg-type" style={{color:tc,borderColor:tc+'44',background:tc+'18'}}>{curSeg.type}</span>
                                <span className="refine-seg-vsrc">V{curSeg.videoIndex+1}</span>
                                {deleted&&<span className="refine-seg-del-badge">已标删</span>}
                                {spd!==1&&<span className="refine-seg-spd-badge">×{spd}</span>}
                              </div>
                              <div className="refine-seg-card-meta">
                                原始：{curSeg.startStr} – {curSeg.endStr} · {fmt(rawDur)}
                                {spd!==1&&<span> → 成品：{fmt(actualDur)}</span>}
                                {deleted&&<span className="refine-seg-del-meta"> · 已从成品方案中删除</span>}
                              </div>
                              {!deleted&&dsEntry&&(
                                <div className="refine-seg-card-meta">成品时间轴：{fmt(dsEntry.compStart)} – {fmt(dsEntry.compEnd)}</div>
                              )}
                              {curSubIdx>=0&&compSubs[curSubIdx]&&(
                                <div className="refine-seg-cursub">{compSubs[curSubIdx].text}</div>
                              )}
                            </div>
                            <div className="refine-ops-row">
                              {deleted?(
                                <button className="refine-op-btn restore" onClick={()=>{toggleDeleteSeg(comp.id,curSegIdx);showToast(`${curSeg.label} 已恢复`)}}>↩ 恢复这一段</button>
                              ):(
                                <button className="refine-op-btn danger" onClick={()=>{toggleDeleteSeg(comp.id,curSegIdx);showToast(`${curSeg.label} 已从成品方案中删除`)}}>✕ 从成品中删除</button>
                              )}
                            </div>
                            <div className="refine-speed-section">
                              <div className="refine-speed-label">⏩ 调速（只作用当前选中片段 · 对着配音调节节奏）</div>
                              <div className="refine-speed-row">
                                {[0.5,0.75,0.9,1,1.25,1.5,2].map(s=>(
                                  <button key={s}
                                    className={`refine-speed-btn${spd===s?' active':''}`}
                                    onClick={()=>{setSegSpeed(comp.id,curSegIdx,s);showToast(`${curSeg.label} 速度设为 ×${s}，成品时长 ${fmt(rawDur/s)}`)}}>
                                    {s===1?'1× 默认':`×${s}`}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {(deletedSegIdxs.length>0||Object.keys(speedMap).length>0)&&(
                              <div className="refine-actions-summary">
                                <div className="refine-actions-head">精修方案摘要（总时长 {fmt(derivedDur)} / 原 {fmt(comp.totalDur)}）</div>
                                {deletedSegIdxs.map(si=>(
                                  <div key={'del-'+si} className="refine-action-row">
                                    <span className="refine-action-type delete">✕ 删除</span>
                                    <span className="refine-action-target">{comp.segments[si]?.label||`第${si+1}段`}</span>
                                    <span className="refine-action-val">{fmt(comp.segments[si]?.endSec-comp.segments[si]?.startSec)}</span>
                                    <button className="refine-action-del" onClick={()=>toggleDeleteSeg(comp.id,si)}>↩</button>
                                  </div>
                                ))}
                                {Object.entries(speedMap).map(([si,spd2])=>(
                                  <div key={'spd-'+si} className="refine-action-row">
                                    <span className="refine-action-type speed">⏩ 调速</span>
                                    <span className="refine-action-target">{comp.segments[+si]?.label||`第${+si+1}段`}</span>
                                    <span className="refine-action-val">×{spd2}</span>
                                    <button className="refine-action-del" onClick={()=>setSegSpeed(comp.id,+si,1)}>↩</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })():(
                        <div className="refine-ops-empty">
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" opacity=".3"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/><polyline points="7 3 7 8 15 8"/></svg>
                          <p>点击时间轴选择片段</p>
                          <p>可删除或调速，或切一刀开始精剪</p>
                        </div>
                      )}
                    </div>
                  </div>{/* end refine-main */}

                  {/* Right sidebar: subtitle list */}
                  <div className="refine-sub-sidebar">
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
                              // v0.7.4-hotfix: jump to subtitle's actual compStart, not segment start
                              const cs=sub.compStart
                              setRefinePrevPos(cs)
                              const ds2=derivedSegs.find(ds=>cs>=ds.compStart&&cs<ds.compEnd)||derivedSegs[derivedSegs.length-1]
                              if(ds2){
                                if(hasEditSegs) setRefineSelEsId(ds2.esId)
                                else setRefineSelSeg(ds2.segIdx)
                                const offsetInSeg=(cs-ds2.compStart)*ds2.speed
                                const seekT=ds2.seg.startSec+Math.min(Math.max(0,offsetInSeg),ds2.seg.endSec-ds2.seg.startSec-0.01)
                                refinePrevSeekRef.current=seekT
                                const vid=refinePrevRef.current
                                if(vid&&vid.readyState>=2) vid.currentTime=seekT
                                const aud=refineVoiceRef.current
                                if(aud&&aud.src){ aud.currentTime=cs; setRefineVoicePos(cs) }
                              }
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
                </div>{/* end refine-body */}
              </div>
            )
          })()}

          {/* ── v0.8.3-hotfix: Export Prep – 5-zone operational workbench ── */}
          {subStep==='export-prep'&&(()=>{
            // ── helper: per-comp status computation
            function compStat(c) {
              const rc2=defaultRcFor(refinedComps[c.id])
              const he2=!!(rc2.editSegs&&rc2.editSegs.length>0)
              const {segments:s2,totalDuration:d2}=he2?buildEditTimeline(rc2.editSegs):buildDerivedTimeline(c,rc2.deletedSegIdxs,rc2.speedMap)
              const act2=s2.filter(ds=>!ds.seg?.deleted)
              const v2=rc2.voice||null
              const vm2=rc2.voiceMeta||null
              const vs2=v2||vm2||null
              const hasCrit=act2.length===0||d2===0
              const hs2=!!(rc2.summaryScript&&rc2.summaryScript.trim())
              // v0.9.3 sync status
              const usedIdx2=[...new Set(act2.map(ds=>ds.seg.videoIndex))]
              const usedVids2=usedIdx2.map(i=>uploadedVideos[i])
              const missVid2=usedVids2.some(v=>!v)
              const vidsSynced2=usedVids2.length>0&&usedVids2.every(v=>v&&v.synced)
              const voiceSynced2=!!(v2&&v2.synced)
              return {rc:rc2,dur:d2,active:act2,voice:v2,voiceSrc:vs2,
                hasCrit,missingVoice:!v2&&!vm2,needReimport:!v2&&!!vm2,
                unsavedDraft:!rc2.savedAt,unexported:!rc2.planExportedAt,hasScript:hs2,
                vidsSynced:vidsSynced2,voiceSynced:voiceSynced2,missingVideo:missVid2,
                hasSubs:!!(rc2.finalSubtitles&&rc2.finalSubtitles.length>0),
                subsSaved:!!(rc2.finalSubtitlesSavedAt)}
            }

            // ── batch stats across all comps
            const allStats=compositions.map(c=>({c,...compStat(c)}))
            const totalCount=compositions.length
            const notSynced=s=>(s.active.length>0&&!s.vidsSynced)||(s.voice&&!s.voiceSynced)||s.missingVideo
            const readyCount=allStats.filter(s=>!s.hasCrit&&!s.missingVoice&&!s.unsavedDraft&&!notSynced(s)).length
            const needsCount=allStats.filter(s=>s.hasCrit||s.missingVoice||notSynced(s)).length
            const savedCount=allStats.filter(s=>!s.unsavedDraft).length
            const missingVoiceCount=allStats.filter(s=>s.missingVoice).length
            const unsyncedCount=allStats.filter(s=>notSynced(s)).length
            const batchStatus=needsCount>0?'error':allStats.some(s=>s.unsavedDraft||s.unexported)?'warn':'ok'
            const batchLabel=batchStatus==='ok'?'全部准备完成':batchStatus==='warn'?'有建议项，但可继续':
              `有 ${needsCount} 条需要处理`

            // ── current selected comp for detail view
            const selId=epSelCompId||refineCompId
            const selComp=compositions.find(c=>c.id===selId)||compositions.find(c=>c.id===refineCompId)
            if(!selComp&&totalCount===0) return (
              <div className="ep-error">暂无成品方案，请先在组合方案页生成成品。
                <button onClick={()=>setSubStep('cut')}>← 返回</button></div>
            )
            if(!selComp) return (
              <div className="ep-error">未找到成品方案 <button onClick={()=>setSubStep('refine')}>← 返回精修</button></div>
            )

            const rc=defaultRcFor(refinedComps[selComp.id])
            const hasEditSegs=!!(rc.editSegs&&rc.editSegs.length>0)
            const {segments:epSegs,totalDuration:epDur}=hasEditSegs
              ?buildEditTimeline(rc.editSegs)
              :buildDerivedTimeline(selComp,rc.deletedSegIdxs,rc.speedMap)
            const voice=rc.voice||null
            const voiceMeta=rc.voiceMeta||null
            const voiceSrc=voice||voiceMeta||null
            const voiceDur=voiceSrc?.duration??0
            const durDiff=voiceSrc?(voiceDur-epDur):null
            const muteOriginal=rc.audioPolicy?.muteOriginalVideo??false
            const cp=rc.copywriting||{}
            const activeSegs=epSegs.filter(ds=>!ds.seg?.deleted)
            const deletedEditCount=hasEditSegs?(rc.editSegs||[]).filter(s=>s.deleted).length:0
            const deletedBaseCount=rc.deletedSegIdxs?.length??0
            const speedCount=Object.keys(rc.speedMap||{}).length
            const cutSegCount=hasEditSegs?(rc.editSegs||[]).length:0
            const anomalySegs=activeSegs.filter(ds=>{
              const vid=uploadedVideos[ds.seg.videoIndex]
              return !vid||(ds.seg.endSec<=ds.seg.startSec)||(ds.actualDur<0.05)
            })
            const missingVideoSegs=activeSegs.filter(ds=>!uploadedVideos[ds.seg.videoIndex])
            const durDiffAbs=durDiff!==null?Math.abs(durDiff):0

            const ckHasSegs=epSegs.length>0, ckDurOk=epDur>0
            const ckVideosExist=uploadedVideos.length>0, ckNoAnomalies=anomalySegs.length===0
            const ckVoiceHasFile=!!voice, ckVoiceRecorded=!!voiceSrc
            const ckMuteOriginal=muteOriginal, ckDraftSaved=!!rc.savedAt
            const ckJsonExported=!!rc.planExportedAt
            const ckScriptExists=!!(rc.summaryScript&&rc.summaryScript.trim())
            // v0.9.3 sync status for selected comp
            const usedVidIdxs=[...new Set(activeSegs.map(ds=>ds.seg.videoIndex))]
            const usedVidObjs=usedVidIdxs.map(i=>uploadedVideos[i])
            const ckVideosSynced=usedVidObjs.length>0&&usedVidObjs.every(v=>v&&v.synced)
            const unsyncedVidCount=usedVidObjs.filter(v=>v&&!v.synced).length
            const ckVoiceSynced=!!(voice&&voice.synced)
            const ckWillBurnSub=burnInSub&&ckScriptExists
            const ckTitleExists=!!(cp.finalTitle&&cp.finalTitle.trim())
            const ckWechatExists=!!(cp.finalWechatBody&&cp.finalWechatBody.trim())
            const ckXhsExists=!!(cp.finalXhs&&cp.finalXhs.trim())
            const ckDurClose=durDiff===null||durDiffAbs<3

            const fmt2=s=>{
              if(s===null||s===undefined) return '—'
              const t=Math.round(s), m=Math.floor(t/60), sec=t%60
              return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
            }

            // ── action items for current selected comp
            const mustItems=[]
            const warnItems=[]
            if(anomalySegs.length>0)               mustItems.push({type:'anomaly',text:`${anomalySegs.length} 个片段存在异常（缺少源视频或时长为 0）`})
            if(!ckVideosExist)                      mustItems.push({type:'noVideo',text:'尚未导入任何视频素材'})
            if(!ckHasSegs||!ckDurOk)               mustItems.push({type:'noSegs',text:'当前成品无有效片段或时长为 0'})
            if(ckVideosExist&&!ckVideosSynced&&!anomalySegs.length) mustItems.push({type:'syncVideo',text:`${unsyncedVidCount} 个原视频尚未同步到本地导出服务`,sub:'导出前需把原视频同步到本地服务，点击下方按钮一键同步（无需手动复制文件）。'})
            if(ckVoiceHasFile&&!ckVoiceSynced)     mustItems.push({type:'syncVoice',text:'本条配音尚未同步到本地导出服务',sub:'点击下方按钮一键同步本条配音（无需手动复制文件）。'})
            if(burnInSub&&!ckScriptExists)          warnItems.push({type:'noScript',text:'已启用「烧录字幕稿」但字幕汇总稿为空',sub:'请返回精修页填写字幕汇总稿，或在导出设置中关闭烧录字幕。',btn:'返回精修页'})
            if(!ckVoiceHasFile&&ckVoiceRecorded)   warnItems.push({type:'reimport',text:`语音「${voiceSrc?.fileName||voiceSrc?.name}」需要重新导入`,sub:'请返回精修页，在「最终语音轨道」重新导入该文件。',btn:'返回精修页导入语音'})
            if(!ckVoiceHasFile&&!ckVoiceRecorded)  warnItems.push({type:'noVoice',text:'尚未导入最终语音文件',sub:'请返回精修页，在「最终语音轨道」导入语音文件。',btn:'返回精修页导入语音'})
            if(!ckMuteOriginal&&ckVoiceRecorded)   warnItems.push({type:'noMute',text:'已记录最终语音，但原视频声音未关闭',sub:'请返回精修页，开启「原视频默认静音」。',btn:'返回精修页设置静音'})
            if(!ckDraftSaved)                       warnItems.push({type:'unsaved',text:'草稿尚未保存',sub:'建议保存当前草稿，方便下次继续编辑。'})
            if(!ckJsonExported)                     warnItems.push({type:'unexported',text:'剪辑草稿尚未导出文件',sub:'建议导出草稿文件存档备份。'})
            if(durDiff!==null&&durDiffAbs>=3)       warnItems.push({type:'durDiff',text:`视频（${fmt2(epDur)}）与语音（${fmt2(voiceDur)}）时长相差 ${fmt2(durDiffAbs)}`})

            const ckSyncOk=(!ckVideosExist||ckVideosSynced)&&(!ckVoiceHasFile||ckVoiceSynced)
            const overallStatus=(!ckHasSegs||!ckDurOk||!ckVideosExist||!ckNoAnomalies||!ckSyncOk)?'error':warnItems.length>0?'warn':'ok'

            // ── video preview: first active segment of selected comp
            const previewSeg=activeSegs[0]||null
            const previewVid=previewSeg?uploadedVideos[previewSeg.seg.videoIndex]:null
            const previewVideoUrl=previewVid?.url||null
            const previewStartSec=previewSeg?(previewSeg.seg.startSec||0):0

            return (
              <div className="ep-view ep-view-v2">
                {/* hidden file input for draft import */}
                <input type="file" accept=".json" style={{display:'none'}} id="ep-draft-import-input"
                  onChange={e=>{ const f=e.target.files?.[0]; if(f) importRefinePlanFile(selComp.id,f); e.target.value='' }} />

                {/* ══ TOP BAR with inline batch status ══ */}
                <div className="ep-topbar ep-topbar-v3">
                  <button className="ep-back-btn" onClick={()=>setSubStep('refine')}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                    返回精修
                  </button>
                  <span className="ep-title-v3">导出前准备</span>
                  <div className="ep-topbar-stats">
                    <span className="ep-ts-item">{totalCount} 条成品</span>
                    <span className={`ep-ts-item ${readyCount===totalCount&&totalCount>0?'ok':''}`}>{readyCount} 可导出</span>
                    {needsCount>0&&<span className="ep-ts-item err">{needsCount} 需处理</span>}
                    {missingVoiceCount>0&&<span className="ep-ts-item warn">{missingVoiceCount} 缺语音</span>}
                    {unsyncedCount>0&&<span className="ep-ts-item err">{unsyncedCount} 待同步</span>}
                    {(savedCount<totalCount)&&<span className="ep-ts-item warn">{totalCount-savedCount} 未保存草稿</span>}
                  </div>
                  <span className={`ep-topbar-badge ep-zbadge-${batchStatus}`}>{batchLabel}</span>
                </div>

                {/* ══ SCROLLABLE BODY ══ */}
                <div className="ep-body ep-body-v2">

                  {/* ── 批量成品总览（紧凑卡片 grid）── */}
                  <div className="ep-section-wrap">
                    <div className="ep-section-title-row">
                      <span className="ep-section-title">批量成品总览</span>
                      <span className="ep-section-sub">点击卡片切换当前成品</span>
                    </div>
                    <div className="ep-batch-grid">
                      {allStats.length===0&&<div className="ep-batch-empty">暂无成品，请先在组合方案页生成成品。</div>}
                      {allStats.map(({c,dur,active,voice:v2,voiceSrc:vs2,hasCrit,missingVoice:mv,unsavedDraft:ud,hasScript:hs,vidsSynced:vsy,voiceSynced:vosy,missingVideo:mvid,hasSubs:hs2,subsSaved:ss2})=>{
                        const isSel=c.id===selComp?.id
                        const sc=hasCrit||mvid?'err':(mv||ud||!vsy||(v2&&!vosy))?'warn':'ok'
                        return (
                          <div key={c.id} className={`ep-bc3 ep-bc3-${sc}${isSel?' ep-bc3-sel':''}`}
                               onClick={()=>setEpSelCompId(c.id)}>
                            <div className="ep-bc3-name">{c.name}</div>
                            <div className="ep-bc3-meta">{fmt2(dur)} · {active.length} 段</div>
                            <div className="ep-bc3-tags">
                              <span className={`ep-bc3-tag ${mvid?'miss':vsy?'ok':'warn'}`} title="原视频是否已同步到本地导出服务">
                                {mvid?'缺源视频':vsy?'视频已同步':'视频未同步'}
                              </span>
                              <span className={`ep-bc3-tag ${v2?(vosy?'ok':'warn'):vs2?'warn':'miss'}`} title={v2?`配音：${v2.originalName||v2.fileName||''}`:vs2?`需重导：${vs2.fileName||''}`:'未绑定配音'}>
                                {v2?(vosy?`配音已同步`:`配音未同步`):vs2?'配音需重导':'缺配音'}
                              </span>
                              <span className={`ep-bc3-tag ${ud?'warn':'ok'}`}>{ud?'草稿未保存':'草稿已保存'}</span>
                              <span className={`ep-bc3-tag ${hs?'ok':'warn'}`}>{hs?'字幕稿已填':'缺字幕稿'}</span>
                              <span className={`ep-bc3-tag ${hs2?(ss2?'ok':'warn'):'miss'}`}>{hs2?(ss2?'字幕已保存':'字幕未保存'):'缺成品字幕'}</span>
                            </div>
                            {isSel&&<div className="ep-bc3-cur">▶ 当前查看</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── 中间工作区：左（预览+待处理）+ 右（导出设置）── */}
                  <div className="ep-work-area">

                    {/* LEFT：视频预览 + 当前成品待处理 */}
                    <div className="ep-work-left">

                      {/* 视频预览 */}
                      <div className="ep-section-wrap">
                        <div className="ep-section-title-row">
                          <span className="ep-section-title">当前成品预览</span>
                          <span className="ep-section-comp-tag">{selComp.name}</span>
                        </div>
                        <div className="ep-preview-video-wrap"
                          style={(()=>{const rfe=getCompReframe(selComp.id);return rfe.enabled&&rfe.aspect!=='保留原比例'?{aspectRatio:String(REFRAME_ASPECTS.find(a=>a.key===rfe.aspect)?.ratio||'auto'),overflow:'hidden'}:{}})()}>
                          {previewVideoUrl?(
                            <video
                              key={`ep-vid-${selComp.id}`}
                              id="ep-preview-video"
                              src={previewVideoUrl}
                              muted
                              preload="metadata"
                              playsInline
                              className="ep-preview-video"
                              style={(()=>{const rfe=getCompReframe(selComp.id);return rfe.enabled?{transform:`scale(${rfe.scale}) translate(${(rfe.offsetX*100/rfe.scale).toFixed(1)}%, ${(-rfe.offsetY*100/rfe.scale).toFixed(1)}%)`,transformOrigin:'center center'}:{}})()}
                              onLoadedMetadata={e=>{e.target.currentTime=previewStartSec}}
                            />
                          ):(
                            <div className="ep-preview-empty">
                              {ckVideosExist?'当前成品无有效片段':'尚未导入视频素材'}
                            </div>
                          )}
                        </div>
                        {previewVideoUrl&&(
                          <div className="ep-preview-ctrls">
                            <button className="ep-pv-play-btn"
                              onClick={()=>{const v=document.getElementById('ep-preview-video');if(v){v.paused?v.play():v.pause()}}}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                              播放 / 暂停
                            </button>
                            <span className="ep-pv-info">{fmt2(epDur)} · {activeSegs.length} 段</span>
                          </div>
                        )}
                        <div className="ep-preview-note">当前仅为导出前预览参考，真实成品将在 v0.9 生成。</div>
                      </div>

                      {/* 当前成品待处理 */}
                      <div className="ep-section-wrap ep-action-panel-wrap">
                        <div className="ep-section-title-row">
                          <span className="ep-section-title">需要处理的问题</span>
                          {mustItems.length===0&&warnItems.length===0&&(
                            <span className="ep-ts-item ok">无问题</span>
                          )}
                        </div>
                        {mustItems.length===0&&warnItems.length===0?(
                          <div className="ep-all-clear">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            当前成品没有关键缺失，可继续设置导出参数。
                          </div>
                        ):(
                          <div className="ep-action-list">
                            {[...mustItems,...warnItems].slice(0,6).map((item,i)=>{
                              const isErr=i<mustItems.length
                              return (
                                <div key={i} className={`ep-action-item ${isErr?'ep-ai-err':'ep-ai-warn'}`}>
                                  <div className="ep-ai-body">
                                    <div className="ep-ai-text">{item.text}</div>
                                    {item.sub&&<div className="ep-ai-sub">{item.sub}</div>}
                                  </div>
                                  <div className="ep-ai-btns">
                                    {item.type==='syncVideo'&&
                                      <button className="ep-ai-btn ep-ai-btn-err" onClick={()=>syncCompVideos(selComp,rc)}>同步当前素材</button>}
                                    {item.type==='syncVoice'&&
                                      <button className="ep-ai-btn ep-ai-btn-err" onClick={()=>syncCompVoice(selComp.id)}>同步当前配音</button>}
                                    {(item.type==='noVoice'||item.type==='reimport'||item.type==='noMute'||item.type==='noScript')&&
                                      <button className={`ep-ai-btn ${isErr?'ep-ai-btn-err':'ep-ai-btn-warn'}`} onClick={()=>setSubStep('refine')}>返回精修页</button>}
                                    {item.type==='unsaved'&&
                                      <button className="ep-ai-btn ep-ai-btn-warn" onClick={()=>saveRefinedPlan(selComp.id)}>保存草稿</button>}
                                    {item.type==='unexported'&&
                                      <button className="ep-ai-btn ep-ai-btn-warn" onClick={()=>exportRefinePlan(selComp.id,selComp)}>导出草稿</button>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT：导出设置 */}
                    <div className="ep-work-right">
                      <div className="ep-section-wrap ep-settings-panel-wrap">
                        <div className="ep-section-title-row">
                          <span className="ep-section-title">导出设置 / 去重包装</span>
                        </div>
                        <div className="ep-section-note">设置会保存到剪辑草稿里，v0.9 生成时执行。</div>

                        {/* 输出规格 */}
                        <div className="ep-ss-group">
                          <div className="ep-ss-group-title">输出规格</div>
                          <div className="ep-ss-row">
                            <span className="ep-ss-lbl">比例</span>
                            <div className="ep-sg-btns">
                              {[['9:16','竖屏'],['1:1','方形'],['16:9','横屏']].map(([r,desc])=>(
                                <button key={r} className={`ep-sg-btn ${ratio===r?'active':''}`} onClick={()=>setRatio(r)}>{r}<small>{desc}</small></button>
                              ))}
                            </div>
                          </div>
                          <div className="ep-ss-row">
                            <span className="ep-ss-lbl">分辨率</span>
                            <div className="ep-sg-btns">
                              {['720p','1080p'].map(r=><button key={r} className={`ep-sg-btn ${exportRes===r?'active':''}`} onClick={()=>setExportRes(r)}>{r}</button>)}
                            </div>
                            <span className="ep-ss-lbl" style={{marginLeft:6}}>帧率</span>
                            <div className="ep-sg-btns">
                              {['24fps','30fps','60fps'].map(f=><button key={f} className={`ep-sg-btn ${exportFps===f?'active':''}`} onClick={()=>setExportFps(f)}>{f}</button>)}
                            </div>
                          </div>
                          <div className="ep-ss-row">
                            <span className="ep-ss-lbl">混剪强度</span>
                            <div className="ep-sg-btns">
                              {[['light','轻度'],['medium','中度'],['strong','强力']].map(([k,l])=>(
                                <button key={k} className={`ep-sg-btn ${intensity===k?'active':''}`} onClick={()=>setIntensity(k)}>{l}</button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 成品字幕 & 画面取景 状态 */}
                        <div className="ep-ss-group">
                          <div className="ep-ss-group-title">精修设置状态</div>
                          <div className="ep-det-rows" style={{gap:6}}>
                            {(()=>{
                              const hasFS = rc.finalSubtitles&&rc.finalSubtitles.length>0
                              const isSaved = !!rc.finalSubtitlesSavedAt
                              return(
                                <div className={`ep-det-row ${hasFS&&isSaved?'ok':hasFS?'warn':''}`} style={{justifyContent:'space-between'}}>
                                  <span>成品字幕</span>
                                  <span style={{display:'flex',alignItems:'center',gap:6}}>
                                    {hasFS?`${isSaved?'已保存':'未保存'} · ${rc.finalSubtitles.length} 句`:'未生成'}
                                    <button className="ep-ai-btn ep-ai-btn-warn" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>setSubStep('refine')}>精修页修改</button>
                                  </span>
                                </div>
                              )
                            })()}
                            {(()=>{
                              const rfc = getCompReframe(selComp.id)
                              return(
                                <div className={`ep-det-row ${rfc.enabled?'ok':''}`} style={{justifyContent:'space-between'}}>
                                  <span>画面取景</span>
                                  <span style={{display:'flex',alignItems:'center',gap:6}}>
                                    {rfc.enabled?`${rfc.aspect} · ${Math.round(rfc.scale*100)}%`:'未设置'}
                                    <button className="ep-ai-btn ep-ai-btn-warn" style={{fontSize:10,padding:'2px 6px'}} onClick={()=>setSubStep('refine')}>精修页调整</button>
                                  </span>
                                </div>
                              )
                            })()}
                          </div>
                        </div>

                        {/* 画面去重 */}
                        <div className="ep-ss-group">
                          <div className="ep-ss-group-title">画面去重 <small style={{fontWeight:400,color:'var(--text-muted)',textTransform:'none',letterSpacing:0}}>({Object.values(dedup).filter(Boolean).length}/8 启用)</small></div>
                          <div className="ep-sg-dedup">
                            {[['crop','裁剪边缘','◰'],['scale','轻微缩放','⊞'],['mirror','镜像翻转','⇔'],
                              ['speed','变速处理','⏩'],['bgImage','背景底图','▣'],['picInPic','可见画中画','⧉'],
                              ['subDistort','字幕扰动','T'],['endImage','片尾图片','⬜']].map(([k,label,ico])=>(
                              <label key={k} className={`ep-dedup-chip ${dedup[k]?'on':''}`}>
                                <input type="checkbox" checked={dedup[k]} onChange={()=>toggleDedup(k)}/>
                                <span className="ep-dedup-ico">{ico}</span><span>{label}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* 音频与字幕 */}
                        <div className="ep-ss-group">
                          <div className="ep-ss-group-title">音频</div>
                          <div className="ep-ss-toggles-row">
                            {[['keepAudio','保留原声',keepAudio,()=>setKeepAudio(v=>!v)],
                              ['addMusic','背景音乐',addMusic,()=>setAddMusic(v=>!v)],
                            ].map(([k,label,val,toggle])=>(
                              <label key={k} className={`ep-toggle-label ${val?'on':''}`} onClick={toggle}>
                                <span className={`ep-toggle-pill ${val?'on':''}`}/>{label}
                              </label>
                            ))}
                          </div>
                          {addMusic&&(
                            <div className="ep-bgm-section">
                              <div className="ep-bgm-import-row">
                                <input type="file" id="ep-bgm-file-input" accept=".mp3,.wav,.m4a,.aac" style={{display:'none'}}
                                  onChange={async e=>{
                                    const f=e.target.files[0]; if(!f) return
                                    e.target.value=''
                                    const url=URL.createObjectURL(f)
                                    const aud=new Audio(url)
                                    aud.onloadedmetadata=()=>{
                                      const dur=aud.duration||0
                                      URL.revokeObjectURL(url)
                                      const meta={fileName:f.name,originalName:f.name,fileType:f.type,duration:dur,importedAt:new Date().toISOString(),url:null,synced:false}
                                      setBgmFile(meta)
                                      showToast('背景音乐已导入，正在同步…')
                                      const fd=new FormData(); fd.append('file',f); fd.append('originalName',f.name)
                                      fetch('http://127.0.0.1:8765/upload-bgm',{method:'POST',body:fd})
                                        .then(r=>r.json()).then(d=>{
                                          if(d.ok) setBgmFile(prev=>({...prev,storedFileName:d.fileName,synced:true}))
                                          else showToast('背景音乐同步失败：'+d.error)
                                        }).catch(()=>showToast('本地导出服务未启动，背景音乐未同步'))
                                    }
                                    aud.onerror=()=>{ URL.revokeObjectURL(url); showToast('音频读取失败') }
                                  }}
                                />
                                <button className="refine-tb-btn" onClick={()=>document.getElementById('ep-bgm-file-input')?.click()}>
                                  {bgmFile?'重新导入背景音乐':'导入背景音乐'}
                                </button>
                                {bgmFile&&(
                                  <span className={`ep-bc3-tag ${bgmFile.synced?'ok':'warn'}`} style={{fontSize:10}}>
                                    {bgmFile.synced?'已同步':'未同步'}
                                  </span>
                                )}
                              </div>
                              {bgmFile&&(
                                <>
                                  <div className="ep-bgm-name">{bgmFile.originalName||bgmFile.fileName}</div>
                                  <div className="ep-ss-row" style={{marginTop:6}}>
                                    <span className="ep-ss-lbl">背景音量</span>
                                    <input type="range" min="0" max="1" step="0.01" value={bgmVolume}
                                      onChange={e=>setBgmVolume(parseFloat(e.target.value))}
                                      className="ep-range" style={{flex:1}}/>
                                    <span className="ep-ss-val">{Math.round(bgmVolume*100)}%</span>
                                  </div>
                                </>
                              )}
                              {!bgmFile&&<div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>导入 mp3/wav/m4a/aac 文件</div>}
                            </div>
                          )}
                          <div className="ep-ss-group-title" style={{marginTop:14}}>原字幕处理</div>
                          <div className="ep-ss-row" style={{gap:4,flexWrap:'wrap'}}>
                            {[['keep','保留原字幕'],['crop','裁切去原字幕'],['cover','黑条遮挡']].map(([k,l])=>(
                              <button key={k} className={`ep-sg-btn ${origSubMode===k?'active':''}`}
                                onClick={()=>setOrigSubMode(k)}>{l}</button>
                            ))}
                          </div>
                          {origSubMode==='cover'&&(
                            <div className="ep-ss-row" style={{marginTop:6}}>
                              <span className="ep-ss-lbl">遮挡高度</span>
                              <select className="ep-select" value={coverOrigSubHeight} onChange={e=>setCoverOrigSubHeight(e.target.value)}>
                                <option value="8%">8%（小）</option>
                                <option value="12%">12%（默认）</option>
                                <option value="16%">16%（中）</option>
                                <option value="20%">20%（大）</option>
                              </select>
                            </div>
                          )}
                          {origSubMode==='crop'&&!getCompReframe(selComp.id).enabled&&(
                            <div className="ep-ss-warn">⚠ 选了裁切但「画面裁切」未开启，请在精修页配置</div>
                          )}
                          <div className="ep-ss-group-title" style={{marginTop:14}}>成品字幕烧录</div>
                          <div className="ep-ss-row" style={{gap:8,flexWrap:'wrap'}}>
                            <label className={`ep-toggle-label ${burnInSub?'on':''}`} onClick={()=>setBurnInSub(v=>!v)}>
                              <span className={`ep-toggle-pill ${burnInSub?'on':''}`}/>烧录成品字幕
                            </label>
                          </div>
                          {burnInSub&&!ckScriptExists&&!(rc.finalSubtitles&&rc.finalSubtitles.length>0)&&(
                            <div className="ep-ss-warn">⚠ 字幕稿为空且无成品字幕，导出将跳过烧录</div>
                          )}
                          {burnInSub&&(()=>{
                            const ss=getCompSubStyle(selComp.id)
                            const fn=FONT_OPTIONS.find(([f])=>f===ss.fontFamily)?.[1]||ss.fontFamily
                            const cn=COLOR_OPTIONS.find(([c])=>c===ss.color)?.[2]||ss.color
                            const bm={'none':'无背景','text':'文字底板','bar':'整行底条'}[ss.backgroundMode||'none']||'无背景'
                            const pos={'bottom':'底部','lower':'中下','middle':'中间','top':'顶部'}[ss.position]||ss.position
                            return (
                            <div className="ep-ss-row" style={{marginTop:8,gap:6,flexWrap:'wrap',alignItems:'center'}}>
                              <span style={{fontSize:11,color:'var(--text-muted)',flex:1}}>
                                字幕样式：{fn} · {ss.fontSize}px · {cn}字{ss.outline?` ${ss.outlineWidth}px${ss.outlineColor==='black'?'黑':'白'}边`:' 无描边'} · {bm} · {pos}
                              </span>
                              <button className="ep-sg-btn" style={{flexShrink:0}} onClick={()=>setSubStep('refine')}>← 返回精修页修改</button>
                            </div>
                            )
                          })()}
                          <div className="ep-ss-group-title" style={{marginTop:14}}>输出画质</div>
                          <div className="ep-ss-row" style={{gap:4}}>
                            {[['标准','CRF 23'],['高清','CRF 20'],['超清','CRF 18']].map(([q,hint])=>(
                              <button key={q} className={`ep-sg-btn ${exportQuality===q?'active':''}`}
                                onClick={()=>setExportQuality(q)} title={hint}>{q}</button>
                            ))}
                            <span style={{fontSize:10,color:'var(--text-muted)',marginLeft:4}}>
                              {exportQuality==='标准'?'快速，文件小':exportQuality==='高清'?'均衡推荐':'最佳画质'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── 剪辑草稿 ── */}
                  <div className="ep-draft-panel">
                    <div className="ep-draft-head">
                      <span className="ep-draft-title">剪辑草稿</span>
                      <span className="ep-draft-note">草稿不是成品视频，只是保存剪辑进度的记录文件</span>
                      <div style={{marginLeft:'auto',display:'flex',gap:8,flexShrink:0}}>
                        <div className={`ep-draft-status ${ckDraftSaved?'ok':'warn'}`}>
                          {ckDraftSaved?`已保存 ${rc.savedAt?.slice(11,16)}`:'草稿未保存'}
                        </div>
                        <div className={`ep-draft-status ${ckJsonExported?'ok':'warn'}`}>
                          {ckJsonExported?`已导出 ${rc.planExportedAt?.slice(11,16)}`:'文件未导出'}
                        </div>
                      </div>
                    </div>
                    <div className="ep-draft-btns">
                      <button className="ep-act-btn save" onClick={()=>saveRefinedPlan(selComp.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        保存当前草稿
                      </button>
                      <button className="ep-act-btn export" onClick={()=>exportRefinePlan(selComp.id,selComp)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        导出剪辑草稿
                      </button>
                      <button className="ep-act-btn secondary" onClick={()=>document.getElementById('ep-draft-import-input')?.click()}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 5 17 10"/><line x1="12" y1="5" x2="12" y2="15"/></svg>
                        导入剪辑草稿
                      </button>
                      <button className="ep-act-btn refresh" onClick={()=>{ setSubStep('cut'); setTimeout(()=>setSubStep('export-prep'),0) }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                        刷新检查
                      </button>
                    </div>
                    <div className="ep-draft-footnote">草稿文件为 JSON 格式，用于恢复字幕、文案、剪辑、语音记录和导出设置。</div>
                  </div>

                  {/* ── 详细检查（折叠）── */}
                  <details className="ep-details-wrap">
                    <summary className="ep-details-summary">
                      <span>详细检查</span>
                      <span className={`ep-det-badge ep-badge-${overallStatus}`}>
                        {overallStatus==='ok'?'全部通过':overallStatus==='warn'?`${warnItems.length} 项建议`:`${mustItems.length} 项待处理`}
                      </span>
                    </summary>
                    <div className="ep-details-body">
                      <div className="ep-det-section">
                        <div className="ep-det-head">
                          <span>基础素材</span>
                          <span className={`ep-det-badge-sm ${ckHasSegs&&ckDurOk&&ckVideosExist&&ckNoAnomalies?'ok':anomalySegs.length>0?'err':'warn'}`}>
                            {ckHasSegs&&ckDurOk&&ckVideosExist&&ckNoAnomalies?'通过':anomalySegs.length>0?'有异常':'注意'}
                          </span>
                        </div>
                        <div className="ep-det-rows">
                          <div className={`ep-det-row ${ckVideosExist?'ok':'err'}`}><span>源视频</span><span>{uploadedVideos.length} 个</span></div>
                          <div className={`ep-det-row ${ckHasSegs?'ok':'err'}`}><span>参与片段</span><span>{activeSegs.length} 段</span></div>
                          <div className={`ep-det-row ${ckDurOk?'ok':'err'}`}><span>视频总时长</span><span>{fmt2(epDur)}</span></div>
                          <div className={`ep-det-row ${missingVideoSegs.length===0?'ok':'err'}`}><span>缺少源视频</span><span>{missingVideoSegs.length===0?'无':'⚠ '+missingVideoSegs.length+' 个'}</span></div>
                          <div className={`ep-det-row ${anomalySegs.length===0?'ok':'err'}`}><span>异常片段</span><span>{anomalySegs.length===0?'无':'⚠ '+anomalySegs.length+' 个'}</span></div>
                        </div>
                      </div>
                      <div className="ep-det-section">
                        <div className="ep-det-head">
                          <span>剪辑草稿状态</span>
                          <span className={`ep-det-badge-sm ${ckDraftSaved?'ok':'warn'}`}>{ckDraftSaved?'已保存':'未保存'}</span>
                        </div>
                        <div className="ep-det-rows">
                          <div className="ep-det-row"><span>剪辑模式</span><span>{hasEditSegs?'精剪模式':'基础模式'}</span></div>
                          <div className="ep-det-row"><span>删除小段</span><span>{hasEditSegs?deletedEditCount:deletedBaseCount} 段</span></div>
                          <div className="ep-det-row"><span>调速片段</span><span>{speedCount} 段</span></div>
                          <div className={`ep-det-row ${ckDraftSaved?'ok':'warn'}`}><span>草稿已保存</span><span>{ckDraftSaved?rc.savedAt?.slice(11,16):'未保存'}</span></div>
                          <div className={`ep-det-row ${ckJsonExported?'ok':'warn'}`}><span>草稿文件导出</span><span>{ckJsonExported?rc.planExportedAt?.slice(11,16):'未导出'}</span></div>
                        </div>
                      </div>
                      <div className="ep-det-section">
                        <div className="ep-det-head">
                          <span>素材同步（本地导出服务）</span>
                          <span className={`ep-det-badge-sm ${ckSyncOk?'ok':'err'}`}>{ckSyncOk?'已同步':'未同步'}</span>
                        </div>
                        <div className="ep-det-rows">
                          <div className={`ep-det-row ${!ckVideosExist?'err':ckVideosSynced?'ok':'warn'}`}><span>原视频同步</span><span>{!ckVideosExist?'无视频':ckVideosSynced?`已同步 ${usedVidObjs.length} 个`:`${unsyncedVidCount} 个未同步`}</span></div>
                          <div className={`ep-det-row ${ckVoiceHasFile?(ckVoiceSynced?'ok':'warn'):''}`}><span>配音同步</span><span>{ckVoiceHasFile?(ckVoiceSynced?'已同步':'未同步'):'无配音'}</span></div>
                          <div className="ep-det-row"><span>同步方式</span><span>导入即自动同步（无需手动复制）</span></div>
                        </div>
                      </div>
                      <div className="ep-det-section">
                        <div className="ep-det-head">
                          <span>语音与音频</span>
                          <span className={`ep-det-badge-sm ${ckVoiceHasFile&&ckMuteOriginal?'ok':ckVoiceRecorded?'warn':'err'}`}>
                            {ckVoiceHasFile&&ckMuteOriginal?'通过':ckVoiceHasFile?'未静音':ckVoiceRecorded?'需重新导入':'未导入'}
                          </span>
                        </div>
                        <div className="ep-det-rows">
                          <div className={`ep-det-row ${ckVoiceRecorded?'ok':'err'}`}><span>语音文件</span><span>{voice?.originalName||voiceSrc?.fileName||voiceSrc?.name||'未记录'}</span></div>
                          <div className={`ep-det-row ${ckVoiceHasFile?'ok':ckVoiceRecorded?'warn':'err'}`}><span>导入状态</span><span>{ckVoiceHasFile?'已导入':ckVoiceRecorded?'需重新导入':'未导入'}</span></div>
                          <div className={`ep-det-row ${ckVoiceHasFile?(ckVoiceSynced?'ok':'warn'):''}`}><span>同步状态</span><span>{ckVoiceHasFile?(ckVoiceSynced?'已同步到本地服务':'未同步'):'—'}</span></div>
                          <div className="ep-det-row"><span>语音时长</span><span>{ckVoiceRecorded?fmt2(voiceDur):'—'}</span></div>
                          <div className={`ep-det-row ${ckMuteOriginal?'ok':'warn'}`}><span>原视频声音</span><span>{ckMuteOriginal?'已关闭':'未关闭'}</span></div>
                          {durDiff!==null&&<div className={`ep-det-row ${ckDurClose?'ok':'warn'}`}><span>时长差值</span><span>{durDiffAbs<0.5?'基本一致':durDiff>0?`视频短 ${fmt2(durDiffAbs)}`:`视频长 ${fmt2(durDiffAbs)}`}</span></div>}
                        </div>
                      </div>
                      <div className="ep-det-section">
                        <div className="ep-det-head">
                          <span>字幕与文案</span>
                          <span className={`ep-det-badge-sm ${ckScriptExists?'ok':'warn'}`}>{ckScriptExists?'字幕稿已填写':'字幕稿缺失'}</span>
                        </div>
                        <div className="ep-det-rows">
                          <div className={`ep-det-row ${ckScriptExists?'ok':'warn'}`}><span>字幕汇总稿</span><span>{ckScriptExists?`约 ${rc.summaryScript.trim().length} 字`:'未填写'}</span></div>
                          <div className={`ep-det-row ${rc.finalSubtitles&&rc.finalSubtitles.length>0?(rc.finalSubtitlesSavedAt?'ok':'warn'):burnInSub?'warn':''}`}><span>成品字幕</span><span>{!burnInSub?'不烧录':rc.finalSubtitles&&rc.finalSubtitles.length>0?(rc.finalSubtitlesSavedAt?`已保存 ${rc.finalSubtitles.length} 句`:`${rc.finalSubtitles.length} 句未保存`):'将从字幕稿自动生成'}</span></div>
                          {(()=>{const rfc=getCompReframe(selComp.id);return(<div className={`ep-det-row ${rfc.enabled?'ok':''}`}><span>画面裁切</span><span>{rfc.enabled?`${rfc.aspect} · ${Math.round(rfc.scale*100)}% · Y${rfc.offsetY>0?'+':''}${Math.round(rfc.offsetY*100)}%`:'未启用（精修页设置）'}</span></div>)})()}
                          <div className={`ep-det-row ${origSubMode!=='keep'?'ok':''}`}><span>原字幕处理</span><span>{origSubMode==='keep'?'保留原字幕':origSubMode==='crop'?'裁切去原字幕':'黑条遮挡'}</span></div>
                          <div className={`ep-det-row ${ckTitleExists?'ok':''}`}><span>最终标题</span><span>{ckTitleExists?cp.finalTitle:'未填写'}</span></div>
                          <div className={`ep-det-row ${ckWechatExists?'ok':''}`}><span>公众号正文</span><span>{ckWechatExists?`约 ${cp.finalWechatBody.trim().length} 字`:'未填写'}</span></div>
                          <div className={`ep-det-row ${ckXhsExists?'ok':''}`}><span>小红书正文</span><span>{ckXhsExists?`约 ${cp.finalXhs.trim().length} 字`:'未填写'}</span></div>
                        </div>
                      </div>
                      <div className="ep-det-section">
                        <div className="ep-det-head"><span>剪辑动作</span><span className="ep-det-badge-sm ok">信息</span></div>
                        <div className="ep-det-rows">
                          <div className="ep-det-row"><span>模式</span><span>{hasEditSegs?'精剪':'基础删除/调速'}</span></div>
                          {hasEditSegs&&<div className="ep-det-row"><span>切刀小段</span><span>{cutSegCount} 段</span></div>}
                          <div className="ep-det-row"><span>调速</span><span>{speedCount>0?`${speedCount} 段`:'无'}</span></div>
                          <div className="ep-det-row ok"><span>最终片段</span><span>{activeSegs.length} 段 · {fmt2(epDur)}</span></div>
                        </div>
                      </div>
                    </div>
                  </details>

                  {/* ── 底部操作栏 ── */}
                  <div className="ep-footer-bar">
                    <div className="ep-footer-left">
                      <button className="ep-act-btn secondary" onClick={()=>setSubStep('refine')}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                        返回精修页
                      </button>
                      <button className="ep-act-btn save" onClick={()=>saveRefinedPlan(selComp.id)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        保存当前草稿
                      </button>
                      <button className="ep-act-btn export" onClick={()=>exportRefinePlan(selComp.id,selComp)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        导出剪辑草稿
                      </button>
                    </div>
                    <div className="ep-export-main-area">
                      <button
                        className={`ep-act-btn ep-export-main-btn${epExportStatus==='loading'?' loading':''}`}
                        disabled={epExportStatus==='loading'}
                        onClick={()=>exportToLocalService(selComp.id,selComp)}
                      >
                        {epExportStatus==='loading'
                          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ep-spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>生成中...</>
                          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>导出成品视频</>
                        }
                      </button>
                      <div className="ep-export-status-col">
                        {epExportStatus==='idle' && (
                          <span className="ep-export-hint-text">
                            需先双击「启动本地导出服务.bat」 · 原视频放 videos/ · 配音放 audio/
                          </span>
                        )}
                        {epExportStatus==='loading' && (
                          <span className="ep-export-status loading">正在生成成品视频，请稍候...</span>
                        )}
                        {epExportStatus==='success' && (
                          <span className="ep-export-status success">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            {epExportMsg}
                          </span>
                        )}
                        {epExportStatus==='error' && (
                          <span className="ep-export-status error">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                            {epExportMsg}
                          </span>
                        )}
                        {epExportStatus!=='idle' && (
                          <button className="ep-export-reset-btn" onClick={()=>{setEpExportStatus('idle');setEpExportMsg('')}}>重置</button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── 开发备注（折叠）── */}
                  <details className="ep-roadmap-wrap">
                    <summary className="ep-roadmap-summary">开发备注</summary>
                    <div className="ep-roadmap-body">
                      <span className="ep-rm-item done">v0.8.1 第一页素材入口整理：已完成</span>
                      <span className="ep-rm-item done">v0.8.2 第二页导出/去重按钮归位：已完成</span>
                      <span className="ep-rm-item done">v0.9 本地生成成品视频：export_video.py + 启动生成视频.bat 已完成</span>
                      <span className="ep-rm-item done">v0.9.1 网页一键导出：本地服务 + 导出成品视频按钮 已完成</span>
                    </div>
                  </details>

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
                          {ana?.subtitleStatus==='real'
                            ? <span className="s2-vid-subsrc real">
                                真实字幕 {ana.subtitleCount}条
                                {(ana.subtitles?.filter(s=>s.corrected)?.length||0)>0&&
                                  <span className="s2-vid-corrected-pill"> · 已校对</span>}
                              </span>
                            : (ana?.subtitleStatus==='running'||ana?.subtitleStatus==='pending')
                              ? <span className="s2-vid-subsrc sim">{ana.subtitlePhase||'字幕识别中…'}</span>
                              : ana?.subtitleStatus==='failed'
                              ? <span className="s2-vid-subsrc none" title={ana.subtitleError}>字幕识别失败</span>
                              : <span className="s2-vid-subsrc none">暂无字幕</span>
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
                        <div className="s2-vid-overlay"><span>生成分段中…</span></div>
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
                      {editorAnalysis?.subtitleStatus==='real'&&<span className="s2-sub-src-head-badge">真实</span>}
                      <div className="s2-col-switcher">
                        {[1,2,3].map(n=>(
                          <button key={n} className={`s2-col-btn${subColCount===n?' active':''}`} onClick={()=>setSubColCount(n)} title={`${n}列显示`}>{n}</button>
                        ))}
                      </div>
                    </div>
                    <div className="s2-sub-toolbar">
                      <span className={`s2-sub-source-badge${editorAnalysis?.subtitleStatus==='real'?' real':' sim'}`}>
                        {editorAnalysis?.subtitleStatus==='real'
                          ? `真实字幕 ${editorSubtitles.length}条`
                          : editorAnalysis?.subtitleStatus==='failed'
                          ? '字幕识别失败'
                          : (editorAnalysis?.subtitleStatus==='running'||editorAnalysis?.subtitleStatus==='pending')
                          ? (editorAnalysis.subtitlePhase||'识别中…')
                          : '暂无字幕'
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
                      <button className={`s2-sub-tool-btn s2-sub-tool-export${editorAnalysis?.subtitleStatus==='real'?'':' disabled'}`} onClick={handleExportCorrectedSubtitles} title={editorAnalysis?.subtitleStatus==='real'?'导出修正后的字幕文件':'当前视频没有真实字幕可导出'}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        导出修正
                      </button>
                      {editorVid&&editorAnalysis?.subtitleStatus!=='real'&&(
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
                    {editorVid&&!editorSubtitles.length&&(editorAnalysis?.subtitleStatus==='running'||editorAnalysis?.subtitleStatus==='pending')&&(
                      <div className="s2-sub-empty" style={{width:'100%'}}>
                        <span className="s2s-pulse" style={{display:'inline-block',marginRight:6}}/>
                        {editorAnalysis.subtitlePhase||'字幕识别中…'}
                      </div>
                    )}
                    {editorVid&&!editorSubtitles.length&&editorAnalysis?.subtitleStatus==='failed'&&(
                      <div className="s2-sub-empty" style={{width:'100%',flexDirection:'column',gap:8}}>
                        <span>字幕识别失败：{editorAnalysis.subtitleError?.split('\n')[0]||'请检查本地服务'}</span>
                        <button className="s1-retry-btn" style={{alignSelf:'center'}} onClick={()=>{
                          setVideoAnalysis(prev=>({...prev,[currentVideoId]:{...prev[currentVideoId],subtitleStatus:'pending',subtitleError:null}}))
                          enqueueTranscribe(currentVideoId)
                        }}>重试识别</button>
                      </div>
                    )}
                    {editorVid&&!editorSubtitles.length&&(editorAnalysis?.subtitleStatus==='none'||(!editorAnalysis?.subtitleStatus&&editorAnalysis?.status!=='waiting'))&&(
                      <div className="s2-sub-empty" style={{width:'100%'}}>暂无真实字幕</div>
                    )}
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
                              </div>
                              {isEditing ? (
                                <div className="s2-sub-body" onClick={e=>e.stopPropagation()}>
                                  <div className="s2-sub-edit-area" style={{flex:1}}>
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
                                </div>
                              ) : (
                                <div className="s2-sub-body">
                                  <div className="s2-sub-text">{sub.text}</div>
                                  <button
                                    className="s2-sub-edit-btn"
                                    onClick={e=>{ e.stopPropagation(); setEditingSubId(sub.id); setEditingSubText(sub.text) }}
                                  >✎ 编辑</button>
                                </div>
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
                  {editorVid&&editorAnalysis?.subtitleStatus!=='real'&&showImportGuide&&(
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
                  {editorVid&&editorAnalysis?.status==='waiting'&&<div className="s2-seg-strip-empty">生成分段中…</div>}
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
                          const subSt = editorAnalysis?.subtitleStatus
                          const isEditingThisSub = editingSegSub?.segIdx === i
                          const fallbackText = subSt==='real'
                            ? (seg.subtitle||'（该段无字幕）')
                            : subSt==='failed'
                            ? `字幕识别失败：${editorAnalysis.subtitleError?.split('\n')[0]||'请检查本地服务'}`
                            : (subSt==='running'||subSt==='pending')
                            ? '字幕识别中…'
                            : '暂无真实字幕'
                          const displaySubs=segSubs.length>0?segSubs:[{id:'nosub',text:fallbackText}]
                          const needsExpand=displaySubs.length>2||displaySubs.some(s=>s.text.length>20)
                          const shown=(!needsExpand||isExp)?displaySubs:displaySubs.slice(0,2)
                          const canEditSub = subSt==='real' && segSubs.length===0
                          return (
                            <div className="s2-seg-card-subs">
                              {isEditingThisSub ? (
                                <div className="s2-seg-sub-edit-wrap" onClick={e=>e.stopPropagation()}>
                                  <textarea
                                    className="s2-seg-sub-edit-ta"
                                    value={editingSegSubText}
                                    onChange={e=>setEditingSegSubText(e.target.value)}
                                    autoFocus
                                    rows={2}
                                  />
                                  <div className="s2-seg-sub-edit-acts">
                                    <button className="s2-sub-edit-save" onClick={()=>handleSaveSegSubEdit(i, editingSegSubText)}>保存</button>
                                    <button className="s2-sub-edit-cancel" onClick={()=>{setEditingSegSub(null);setEditingSegSubText('')}}>取消</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {shown.map((s,si)=>(
                                    <div key={s.id||si} className="s2-seg-card-sub">{s.text}</div>
                                  ))}
                                  {needsExpand&&(
                                    <button className="s2-seg-card-expand" onClick={e=>{e.stopPropagation();setExpandedSegs(p=>({...p,[seg.id]:!p[seg.id]}))}}>
                                      {isExp?'▲ 收起':`▼ 展开 +${displaySubs.length-2} 条`}
                                    </button>
                                  )}
                                  {canEditSub&&(
                                    <button className="s2-seg-card-sub-edit-btn" onClick={e=>{e.stopPropagation();setEditingSegSub({segIdx:i});setEditingSegSubText(seg.subtitle||'')}} title="编辑片段字幕摘要">✎ 编辑</button>
                                  )}
                                </>
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
              <button className="step-next-btn" onClick={()=>{
                setSubStep('refine')
                if (compositions.length>0 && !refineCompId) setRefineCompId(compositions[0].id)
              }}>
                确认方案，进入精修
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
