# Jianying Draft Research

## Sample

- Source: `C:\Users\Admin\AppData\Local\JianyingPro\User Data\Projects\com.lveditor.draft\5月12日`
- Local copy: `F:\shipin-cut\sample_drafts\jianying\5月12日`
- Jianying app version seen in timeline data: `10.5.0`

## Directory Shape

The copied sample keeps the expected Jianying draft folders:

- `Resources/`: cover and algorithm resource folders.
- `Timelines/project.json`: readable timeline registry.
- `Timelines/<timeline-id>/`: the main timeline folder.
- `Timelines/<timeline-id>/template.json`: readable timeline content.
- `Timelines/<timeline-id>/template.tmp`: readable empty/minimal timeline template.
- `Timelines/<timeline-id>/draft_content.json`: encrypted or encoded, not directly JSON.
- `subdraft/`, `common_attachment/`, `adjust_mask/`, `matting/`, `smart_crop/`: copied template folders.

## Root JSON Files

`draft_content.json` and `draft_meta_info.json` exist at the draft root, but in this sample they are not directly parseable JSON. Their first bytes are base64-like/encrypted text, and `json.loads()` fails.

Conclusion for step0: do not attempt to construct these files from scratch. Copy them from the real template unchanged and edit the readable timeline template files first.

## Readable Timeline Files

`Timelines/project.json` is readable and contains:

- `id`
- `main_timeline_id`
- `timelines[]`
- `create_time`
- `update_time`
- `version`

`timeline_layout.json` is readable and points to the active timeline id.

`Timelines/<timeline-id>/template.json` is the main readable timeline structure. Top-level fields include:

- `id`
- `name`
- `duration`
- `fps`
- `canvas_config`
- `tracks`
- `materials`
- `cover`
- `create_time`
- `update_time`
- `platform`
- `last_modified_platform`
- `config`
- `relationships`

`template.tmp` has the same broad shape but is empty: `duration: 0`, empty `tracks`, and empty material arrays. This is the safest base for a minimal generated timeline.

## Materials

`materials` is an object whose keys are material categories. In the sample:

- `videos`: 9
- `audios`: 9
- `texts`: 11
- `stickers`: 6
- `effects`: 5
- `speeds`: 18
- `sound_channel_mappings`: 18
- `canvases`: 9
- many other categories are present but empty

Video material references:

- `materials.videos[].id` is referenced by a video segment `material_id`.
- `path` is relative to the timeline folder, for example `materials/video/shot_01.mp4`.
- `material_name`, `duration`, `width`, `height`, `type`, `local_material_id` are relevant.

Audio material references:

- `materials.audios[].id` is referenced by an audio segment `material_id`.
- `path` is relative to the timeline folder, for example `materials/audio/vo_002_part1.mp3`.
- `name`, `duration`, `resource_id`, `music_id`, `local_material_id` are relevant.

Text/subtitle material references:

- `materials.texts[].id` is referenced by a text segment `material_id`.
- `content` is a JSON string containing the visible text and style ranges.
- `recognize_text` stores the plain subtitle text.
- `words.start_time`, `words.end_time`, and `words.text` store per-word or per-character timing in milliseconds.

## Tracks

`tracks` is an array. The sample has:

- `video`: 9 segments
- `sticker`: 6 segments
- `text`: 11 segments
- `effect`: 1 segment
- `effect`: 1 segment
- `audio`: 9 segments

Each segment uses:

- `id`: unique segment id.
- `material_id`: points to a material item id.
- `target_timerange.start`: placement start on the timeline.
- `target_timerange.duration`: placement duration.
- `source_timerange.start`: source media trim start.
- `source_timerange.duration`: source media trim duration.
- `render_timerange`: usually `{ "start": 0, "duration": 0 }`.
- `extra_material_refs`: optional references to speed/canvas/channel/effect helper materials.

## Time Units

Timeline and segment durations are microseconds. The sample duration is `23833333`, which is about 23.83 seconds.

Subtitle word timings inside `materials.texts[].words` are milliseconds.

## Draft Name and Cover

The readable timeline has a `name` field, but this sample's value is empty. `Timelines/project.json.timelines[].name` stores `时间线01`. The draft list title may also depend on encrypted root metadata or the folder name, so step0 should use the output folder name as the user-visible title and update the readable timeline/project names.

Cover files appear in:

- root `draft_cover.jpg`
- root `draft_local_cover.jpg`
- `Resources/cover/*.jpg`
- `Timelines/<timeline-id>/draft_cover.jpg`
- `template.json.cover` and `static_cover_image_path`

Step0 does not generate a new cover. It copies the template cover files.

## IDs

Regenerate these when creating a draft:

- timeline/template `id`
- `Timelines/project.json.id`
- track ids
- segment ids
- material ids
- `local_material_id`, `resource_id`, `music_id` where present

Can copy from template:

- most empty material category arrays
- canvas config
- fps
- platform/version/config fields
- basic style fields from one existing subtitle material
- basic segment shape for video/audio/text
- folder structure and attachment JSON files

## Step0 Generation Strategy

The safest minimal path is:

1. Copy the full real sample draft folder.
2. Keep encrypted root `draft_content.json` and `draft_meta_info.json` unchanged.
3. Copy video to `Timelines/<timeline-id>/materials/video/<file>`.
4. Copy audio to `Timelines/<timeline-id>/materials/audio/<file>`.
5. Build a minimal readable timeline from `template.tmp`.
6. Fill `materials.videos`, `materials.audios`, `materials.texts`.
7. Fill three tracks: `video`, `audio`, `text`.
8. Write the generated timeline to `template.tmp` and `template.json`.
9. Update readable `Timelines/project.json` names and timestamps.

Risk: because root `draft_content.json` and `draft_meta_info.json` are encrypted or encoded in this Jianying version, Jianying may still rely on them when opening a local draft. If the generated draft does not open, the next fix should focus on how Jianying regenerates or accepts those encrypted root files, not on adding stickers, filters, packaging, or frontend integration.

## Step1 Composition Export

The GUI validation for step0 confirmed the low-risk approach works: copy a real template draft, keep encrypted root JSON files unchanged, and write the readable timeline template under `Timelines/<timeline-id>/template.json`.

Step1 uses `tools/jianying_draft/create_comp_draft.py` with an intermediate JSON file. The intended command is:

```powershell
python tools/jianying_draft/create_comp_draft.py --input export_workspace/drafts/current_comp_for_jianying.json --overwrite
```

Input shape:

```json
{
  "title": "成品001",
  "templateDraftDir": "F:/shipin-cut/sample_drafts/jianying/5月12日",
  "outputDraftDir": "C:/Users/Admin/AppData/Local/JianyingPro/User Data/Projects/com.lveditor.draft/成品001",
  "canvas": {
    "ratio": "9:16",
    "width": 1080,
    "height": 1920,
    "fps": 30
  },
  "segments": [
    {
      "sourceVideo": "F:/shipin-cut/export_workspace/videos/source1.mp4",
      "sourceStartUs": 0,
      "sourceDurationUs": 3000000,
      "timelineStartUs": 0,
      "timelineDurationUs": 3000000,
      "speed": 1.0
    }
  ],
  "voice": {
    "path": "F:/shipin-cut/export_workspace/audio/voice.mp3",
    "timelineStartUs": 0,
    "durationUs": 24000000
  },
  "subtitles": [
    {
      "text": "第一句字幕",
      "startUs": 0,
      "durationUs": 1800000
    }
  ]
}
```

Mapping rules:

- All timeline times are microseconds.
- `segments[]` becomes one video track with one segment per source video.
- Each video material is copied to `Timelines/<timeline-id>/materials/video/`.
- Each video segment writes `target_timerange` from `timelineStartUs/timelineDurationUs`.
- Each video segment writes `source_timerange` from `sourceStartUs/sourceDurationUs`.
- `voice` becomes one audio material and one audio track segment.
- `subtitles[]` becomes editable subtitle materials and one text track with multiple segments.
- Manual line breaks are preserved in `recognize_text` and `content`.
- Timeline `duration` is the max of video end, audio end, and subtitle end.
- The draft display name uses the output draft folder name.

Speed note: `speed` is currently written to `segment.speed`, but the script does not yet generate the richer `materials.speeds` helper entries used by Jianying for complex variable speed behavior. For the first formal export pass, 1x video/audio/subtitle timing is the supported path.
