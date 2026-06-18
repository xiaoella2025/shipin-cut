import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
const serverSource = readFileSync(new URL('../tools/local_export_server.py', import.meta.url), 'utf8')

test('local export server uses a threaded HTTP server for browser uploads and health checks', () => {
  assert.match(
    serverSource,
    /from http\.server import ThreadingHTTPServer, BaseHTTPRequestHandler/
  )
  assert.match(serverSource, /server = ThreadingHTTPServer\(\(HOST, PORT\), ExportHandler\)/)
})

test('step 2 analysis initialization reacts to videos imported after entering the step', () => {
  assert.match(
    appSource,
    /useEffect\(\(\)=>\{[\s\S]*\/\/ step 2 init[\s\S]*\}, \[step, uploadedVideos\]\)/
  )
})

test('composition generation is blocked until real subtitles exist', () => {
  assert.match(appSource, /const videosWithoutRealSubtitles = uploadedVideos\.filter/)
  assert.match(appSource, /字幕识别未完成或失败，请先完成真实字幕识别。/)
  assert.match(appSource, /videosWithoutRealSubtitles\.length/)
})

test('formal import and transcription flow does not keep placeholder subtitles', () => {
  for (const text of [
    '精彩内容即将开始',
    '请跟着我一起来',
    '欢迎来到我的频道',
    'Hello World',
    'MIXCUT Export Test',
    'demo subtitle',
    'test subtitle',
    'placeholder subtitle',
    'fallback subtitle',
  ]) {
    assert.equal(appSource.includes(text), false, `placeholder subtitle remains: ${text}`)
  }
})
