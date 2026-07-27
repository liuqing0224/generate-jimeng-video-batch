# Jimeng In-App Browser Workflow

## Contents

1. Browser setup
2. Prompt and storyboard loading
3. Configuration and submission
4. Completion detection
5. Download
6. Progress and recovery

## Browser Setup

Use the `browser:control-in-app-browser` skill. Bind the user-selected in-app browser once and reuse its Jimeng tab. Read that browser's complete documentation before the first interaction.

Use the blank direct-video URL as the reset boundary:

```text
https://jimeng.jianying.com/ai-tool/generate?type=video
```

After navigation and load, inspect visible DOM. Require:

- an empty `contenteditable="true"` textbox;
- no `clipboard` reference token;
- visible direct-video controls.

Do not continue if old text or reference content remains.

## Prompt And Storyboard Loading

Read local files with the persistent Node runtime:

```js
const fs = await import("node:fs/promises");
const markdown = await fs.readFile(promptPath, "utf8");
const match = markdown.match(
  /^## (?:15 秒视频提示词|15-Second Video Prompt)\s*\n([\s\S]*?)(?=^## |\s*$)/m,
);
if (!match) throw new Error("Missing 15-second video prompt");
const prompt = match[1].trim();
const png = await fs.readFile(storyboardPath);
```

Write the PNG to the tab clipboard using the browser client's exact clipboard schema:

```js
await tab.clipboard.write([
  {
    entries: [
      {
        mimeType: "image/png",
        base64: png.toString("base64"),
      },
    ],
  },
]);
```

Then:

1. locate the current `contenteditable="true"` textbox;
2. click it;
3. press `META+V`;
4. wait for the reference widget;
5. type a newline followed by the extracted prompt.

One pasted image can render two visible `clipboard` text fragments inside a single reference widget. Judge reference count from the widget/control state, not raw token count alone.

## Configuration And Submission

Before each submission, inspect visible state and require:

```text
视频生成
即梦 Seedance 2.0 mini
16:9
15s
current storyboard reference
current prompt
visible charge
```

Do not assume retained settings. If a required value differs, open its control and select the requested value, then inspect again.

Compare visible balance with visible charge immediately before clicking submit. Do not click when balance is lower.

After submission, confirm at least one authoritative signal:

- balance decreased by the expected charge;
- `生成中...`;
- `排队加速中`;
- a new current generation card for the current prompt.

If the page reports `任务提交失败，请稍后再试` and no credits were consumed, retry once. Do not retry an accepted job.

## Completion Detection

Poll about every 45-60 seconds. Query visible video elements:

```js
const videos = await tab.playwright.evaluate(() =>
  Array.from(document.querySelectorAll("video")).map((video, index) => ({
    index,
    src: video.currentSrc || video.src,
    duration: video.duration,
    width: video.videoWidth,
    height: video.videoHeight,
    readyState: video.readyState,
  })),
);
```

Loading animation signature:

```text
src contains record-loading-animation
duration about 8.966667
dimensions 780x780
```

Completed-result signature:

```text
duration > 14
width / height = 16 / 9
readyState >= 2
src is not the loading animation
src belongs to the current generation card
```

The UI may stop showing `生成中...` without displaying literal `视频生成完成`. A valid current playable video is authoritative. Never infer completion from elapsed time alone.

## Download

Do not call a media helper that navigates the control tab away from Jimeng. Prefer:

1. read the completed video's signed `currentSrc`;
2. fetch the signed URL in the persistent Node runtime;
3. write bytes directly to the current person's canonical path.

```js
const response = await fetch(videoUrl);
if (!response.ok) throw new Error(`Download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
await fs.writeFile(outputPath, bytes);
```

Require non-zero bytes, then run:

```bash
node scripts/verify_video.mjs "<person-dir>/视频.mp4"
```

The verification script requires H.264 video, AAC audio, 16:9 dimensions, about 15 seconds, and a full FFmpeg decode when FFmpeg is installed.

## Progress And Recovery

After every verified download:

1. append or update the person's row in `视频生成进度.md`;
2. update completed and pending counts;
3. record the next source-order person;
4. record the current credit balance;
5. rerun `audit_batch.mjs`.

On insufficient credits, do not submit the next person. Record:

```text
暂停原因：剩余 <balance> 积分，低于单条所需 <charge> 积分。
下一位：<person>
```

On resume, run the audit and independently verify canonical videos. Skip every valid file even if the progress Markdown is stale.
