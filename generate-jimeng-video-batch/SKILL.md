---
name: generate-jimeng-video-batch
description: Automate Jimeng Seedance direct-video generation through the Codex in-app browser, using one Chinese Markdown prompt and storyboard image per person; clear state between jobs, enforce model/aspect/duration/credit settings, wait, download, validate, archive as 视频.mp4, and resume without regenerating valid outputs. Use for jimeng.jianying.com batches organized as per-person folders containing 提示词.md and 故事板.png, especially 15-second 16:9 classroom-story videos.
---

# Generate Jimeng Video Batch

Use the Codex in-app browser when requested. Keep one Jimeng tab as the control surface.

Read [references/jimeng-browser-workflow.md](references/jimeng-browser-workflow.md) completely before interacting with Jimeng.

## Input Contract

Require a batch root containing one directory per person:

```text
<batch-root>/
  视频生成进度.md
  <姓名>/
    提示词.md
    故事板.png
    视频.mp4          # created by this workflow
```

Extract only the text below `## 15 秒视频提示词` or `## 15-Second Video Prompt`, ending at the next level-two heading or EOF. Do not send storyboard-image prompts or other Markdown sections.

Preserve the source-record order supplied by the user. Do not use filesystem or locale-alphabetical order as the generation order.

## Preflight

1. Run:

   ```bash
   node scripts/audit_batch.mjs <batch-root>
   ```

2. Treat only a video that passes `scripts/verify_video.mjs` as complete.
3. Skip every valid existing `视频.mp4`; never regenerate or overwrite it without explicit instruction.
4. Confirm the user is signed in and no CAPTCHA blocks the in-app browser.
5. Read the visible credit balance. A 15-second Seedance 2.0 mini job currently displays a per-job charge in the composer. Use the visible charge as authoritative.
6. Do not submit when the displayed balance is lower than the displayed charge. Record the exact next person and balance, then stop.

## Per-Person Workflow

For each pending person, complete the entire state machine before starting the next:

```text
pending -> cleared -> loaded -> configured -> submitted
        -> generating -> completed -> downloaded -> verified
```

1. Reopen `https://jimeng.jianying.com/ai-tool/generate?type=video`.
2. Confirm the prompt textbox contains neither old text nor old reference widgets. A visible `clipboard` token means a reference remains.
3. Upload only the current `故事板.png`.
4. Fill only the extracted 15-second prompt.
5. Confirm all visible configuration evidence:
   - `视频生成`
   - `即梦 Seedance 2.0 mini`, unless the user explicitly requested another Seedance 2.0 variant
   - `16:9`
   - `15s`
   - exactly one current reference widget
   - expected visible credit charge
6. Submit once.
7. Poll at intervals of about 45-60 seconds. Do not submit another job while the current job is unresolved.
8. Ignore Jimeng's loading-animation video (`record-loading-animation`, usually 8.966667 seconds and 780x780).
9. Accept a playable result only when its `<video>` has duration greater than 14 seconds, a 16:9 frame, and a non-loading media URL associated with the current prompt.
10. Download immediately to `<person-dir>/视频.mp4`.
11. Run `node scripts/verify_video.mjs <person-dir>/视频.mp4`.
12. Update `视频生成进度.md` and any configured persistent project memory.
13. Rerun the batch audit before proceeding.

## Browser Discipline

- Use the browser skill matching the user-selected surface.
- Reuse one browser binding and one tab binding.
- Read visible DOM state before actions; prefer stable semantic locators or current DOM node IDs over coordinates.
- Treat navigation to the blank direct-video URL as the hard reset between people.
- Verify the reset succeeded before upload. Never trust settings or references carried from the previous job.
- Do not inspect cookies, local storage, passwords, or browser profiles.
- Treat login, CAPTCHA, moderation, insufficient credits, permission prompts, and visible submission failures as explicit states.
- Keep the live Jimeng tab available for handoff when the batch is incomplete.

## Failure Rules

- Retry a transient submission failure once only if no job was accepted and no credits were consumed.
- Never retry merely because generation is slow.
- If a completed result exists but download or verification fails, preserve diagnostic output and do not submit a replacement until the existing result is exhausted as a download source.
- Preserve an invalid canonical file by renaming it with an `.invalid-<timestamp>.mp4` suffix before regeneration.
- Record the person, last state, visible error, credit balance, and timestamp in `视频生成进度.md`.

## Completion

Require all of the following:

- prompt count equals storyboard count equals verified-video count;
- no pending, zero-byte, partial, or invalid media remains;
- every person directory contains exactly one canonical `视频.mp4`;
- final audit reports no invalid inputs or invalid videos.
