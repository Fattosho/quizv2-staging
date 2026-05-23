import fs from "node:fs";
import path from "node:path";
import { createId } from "./store.js";

const AUDIO_DIR = path.resolve("server", "data", "audio-replies");

function ensureAudioDir() {
  if (!fs.existsSync(AUDIO_DIR)) {
    fs.mkdirSync(AUDIO_DIR, { recursive: true });
  }
}

function getExtension(mimetype = "") {
  if (mimetype.includes("mpeg") || mimetype.includes("mp3")) return "mp3";
  if (mimetype.includes("ogg") || mimetype.includes("opus")) return "ogg";
  if (mimetype.includes("wav")) return "wav";
  return "bin";
}

export function saveGeneratedAudio({ base64, mimetype, text, provider, policy }) {
  if (process.env.AUDIO_STORAGE_ENABLED !== "true") {
    return {
      stored: false,
      text,
      provider,
      mimetype,
      policy,
    };
  }

  ensureAudioDir();
  const id = createId("aud");
  const extension = getExtension(mimetype);
  const audioPath = path.join(AUDIO_DIR, `${id}.${extension}`);
  const metaPath = path.join(AUDIO_DIR, `${id}.json`);

  fs.writeFileSync(audioPath, Buffer.from(base64, "base64"));
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        id,
        provider,
        mimetype,
        text,
        policy,
        createdAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  return {
    stored: true,
    id,
    path: audioPath,
    metaPath,
    text,
    provider,
    mimetype,
    policy,
  };
}
