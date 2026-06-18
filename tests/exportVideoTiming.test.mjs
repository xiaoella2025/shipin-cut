import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const exportVideoSource = readFileSync(new URL('../tools/export_video.py', import.meta.url), 'utf8')

test('cut segments normalize frame rate, PTS, pixel format, and audio timing', () => {
  assert.match(exportVideoSource, /fps=30/)
  assert.match(exportVideoSource, /settb=AVTB/)
  assert.match(exportVideoSource, /setpts=PTS-STARTPTS/)
  assert.match(exportVideoSource, /aresample=async=1:first_pts=0/)
  assert.match(exportVideoSource, /asetpts=PTS-STARTPTS/)
  assert.match(exportVideoSource, /"-fps_mode",\s*"cfr"/)
  assert.match(exportVideoSource, /"-video_track_timescale",\s*"90000"/)
})

test('concat filter normalizes each input and emits stable CFR 30 output', () => {
  assert.match(exportVideoSource, /fps=30,settb=AVTB,setpts=PTS-STARTPTS,/)
  assert.match(exportVideoSource, /scale=\{target_w\}:\{target_h\}:force_original_aspect_ratio=increase/)
  assert.match(exportVideoSource, /crop=\{target_w\}:\{target_h\},setsar=1,format=yuv420p/)
  assert.match(exportVideoSource, /aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS\[a\{i\}\]/)
  assert.match(exportVideoSource, /concat=n=\{n\}:v=1:a=1\[outv\]\[outa\]/)
  assert.match(exportVideoSource, /"-r",\s*"30"/)
  assert.match(exportVideoSource, /"-fps_mode",\s*"cfr"/)
  assert.match(exportVideoSource, /"-video_track_timescale",\s*"90000"/)
  assert.doesNotMatch(exportVideoSource, /"-c:v",\s*"copy"/)
})

test('debug report records pre-concat and stream metadata needed for duration drift analysis', () => {
  for (const token of [
    'outputFormatDuration',
    'outputAvgFrameRate',
    'outputRFrameRate',
    'outputTimeBase',
    'preConcatExpectedSum',
    'preConcatFormatSum',
    'preConcatVideoSum',
    'preConcatAudioSum',
    'concatCommand',
    'audioStreamDuration',
    'failedStage',
  ]) {
    assert.match(exportVideoSource, new RegExp(token))
  }
})
