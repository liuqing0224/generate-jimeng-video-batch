#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const input = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!input || !fs.existsSync(input) || fs.statSync(input).size === 0) {
  console.error(`Missing or empty video: ${input || "<none>"}`);
  process.exit(2);
}

const probe = spawnSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,codec_name,width,height,r_frame_rate",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    input,
  ],
  { encoding: "utf8" },
);

if (probe.error?.code === "ENOENT") {
  console.error("ffprobe is required to verify canonical videos.");
  process.exit(2);
}
if (probe.status !== 0) {
  console.error((probe.stderr || "ffprobe failed").trim());
  process.exit(2);
}

const metadata = JSON.parse(probe.stdout);
const video = metadata.streams?.find((stream) => stream.codec_type === "video");
const audio = metadata.streams?.find((stream) => stream.codec_type === "audio");
const duration = Number(metadata.format?.duration);
const errors = [];

if (video?.codec_name !== "h264") errors.push("video codec is not H.264");
if (audio?.codec_name !== "aac") errors.push("audio codec is not AAC");
if (!video?.width || !video?.height || video.width * 9 !== video.height * 16) {
  errors.push("frame size is not 16:9");
}
if (!Number.isFinite(duration) || duration < 14 || duration > 16) {
  errors.push(`duration is outside 14-16 seconds: ${metadata.format?.duration}`);
}

if (errors.length) {
  console.error(errors.join("; "));
  process.exit(2);
}

const decode = spawnSync(
  "ffmpeg",
  ["-v", "error", "-i", input, "-f", "null", "-"],
  { encoding: "utf8" },
);
if (decode.error?.code !== "ENOENT" && decode.status !== 0) {
  console.error((decode.stderr || "full FFmpeg decode failed").trim());
  process.exit(2);
}

console.log(
  JSON.stringify(
    {
      file: input,
      bytes: fs.statSync(input).size,
      duration,
      video: {
        codec: video.codec_name,
        width: video.width,
        height: video.height,
        frameRate: video.r_frame_rate,
      },
      audio: { codec: audio.codec_name },
      fullDecode: decode.error?.code === "ENOENT" ? "skipped" : "passed",
    },
    null,
    2,
  ),
);
