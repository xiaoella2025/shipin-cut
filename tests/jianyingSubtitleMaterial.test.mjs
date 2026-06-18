import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const exporterSource = readFileSync(
  new URL('../tools/jianying_draft/export_with_pyjianying.py', import.meta.url),
  'utf8',
)

test('Jianying SRT subtitles are upgraded from plain text materials to subtitle materials', () => {
  assert.match(exporterSource, /def upgrade_text_materials_to_subtitles/)
  assert.match(exporterSource, /"type": "subtitle"/)
  assert.match(exporterSource, /"caption_template_info"/)
  assert.match(exporterSource, /"subtitle_keywords": None/)
  assert.match(exporterSource, /"sub_type": 0/)
  assert.match(exporterSource, /"recognize_type": 0/)
})

test('plain text fallback remains available when subtitle material upgrade is disabled', () => {
  assert.match(exporterSource, /--subtitle-mode/)
  assert.match(exporterSource, /choices=\["subtitle", "text"\]/)
  assert.match(exporterSource, /if args\.subtitle_mode == "subtitle"/)
})
