#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".");
const verifier = path.join(path.dirname(new URL(import.meta.url).pathname), "verify_video.mjs");

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`Batch root is not a directory: ${root}`);
  process.exit(2);
}

const entries = fs
  .readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const dir = path.join(root, entry.name);
    const promptPath = path.join(dir, "提示词.md");
    const storyboardPath = path.join(dir, "故事板.png");
    const videoPath = path.join(dir, "视频.mp4");
    const prompt =
      fs.existsSync(promptPath) &&
      fs.statSync(promptPath).size > 0 &&
      /^## (?:15 秒视频提示词|15-Second Video Prompt)\s*$/m.test(
        fs.readFileSync(promptPath, "utf8"),
      );
    const storyboard =
      fs.existsSync(storyboardPath) && fs.statSync(storyboardPath).size > 0;
    const videoBytes = fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0;
    let videoValid = false;
    let videoError = null;

    if (videoBytes > 0) {
      const result = spawnSync(process.execPath, [verifier, videoPath], {
        encoding: "utf8",
      });
      videoValid = result.status === 0;
      if (!videoValid) {
        videoError = (result.stderr || result.stdout || "verification failed").trim();
      }
    }

    return {
      name: entry.name,
      prompt,
      storyboard,
      videoBytes,
      videoValid,
      videoError,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

const summary = {
  root,
  people: entries.length,
  prompts: entries.filter((entry) => entry.prompt).length,
  storyboards: entries.filter((entry) => entry.storyboard).length,
  videos: entries.filter((entry) => entry.videoValid).length,
  pending: entries.filter((entry) => !entry.videoValid).map((entry) => entry.name),
  invalidInputs: entries
    .filter((entry) => !entry.prompt || !entry.storyboard)
    .map((entry) => entry.name),
  invalidVideos: entries
    .filter((entry) => entry.videoBytes > 0 && !entry.videoValid)
    .map((entry) => ({ name: entry.name, error: entry.videoError })),
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode =
  summary.invalidInputs.length || summary.invalidVideos.length ? 2 : 0;
