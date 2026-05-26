import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function getProvider() {
  return String(process.env.TTS_PROVIDER || "elevenlabs").toLowerCase();
}

function toResult(provider, buffer, mimetype, meta = {}) {
  return {
    provider,
    mimetype,
    base64: Buffer.from(buffer).toString("base64"),
    bytes: buffer.length,
    meta,
  };
}

async function generateWithElevenLabs(text, options = {}) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY nao configurada");
  }

  const voiceId = options.voiceId || process.env.TTS_VOICE_ID || process.env.ELEVENLABS_TTS_VOICE_ID;
  if (!voiceId) {
    throw new Error("TTS_VOICE_ID ou ELEVENLABS_TTS_VOICE_ID nao configurado");
  }

  const outputFormat =
    options.outputFormat || process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_44100_128";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id:
          options.model ||
          process.env.TTS_MODEL ||
          process.env.ELEVENLABS_TTS_MODEL ||
          "eleven_multilingual_v2",
        language_code: process.env.ELEVENLABS_TTS_LANGUAGE || "pt",
        voice_settings: {
          stability: Number(process.env.ELEVENLABS_TTS_STABILITY || 0.48),
          similarity_boost: Number(process.env.ELEVENLABS_TTS_SIMILARITY_BOOST || 0.78),
          style: Number(process.env.ELEVENLABS_TTS_STYLE || 0.15),
          use_speaker_boost: process.env.ELEVENLABS_TTS_SPEAKER_BOOST !== "false",
        },
      }),
    },
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail?.message || data?.message || "Falha no TTS ElevenLabs");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return toResult("elevenlabs", buffer, outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/ogg", {
    outputFormat,
  });
}

async function generateWithAzure(text, options = {}) {
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    throw new Error("AZURE_SPEECH_KEY e AZURE_SPEECH_REGION precisam estar configurados");
  }

  const voice = options.voice || process.env.AZURE_SPEECH_VOICE || "pt-BR-FranciscaNeural";
  const outputFormat = process.env.AZURE_SPEECH_OUTPUT_FORMAT || "audio-24khz-48kbitrate-mono-mp3";
  const ssml = [
    '<speak version="1.0" xml:lang="pt-BR">',
    `<voice xml:lang="pt-BR" name="${voice}">`,
    text.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char]),
    "</voice>",
    "</speak>",
  ].join("");

  const response = await fetch(
    `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": outputFormat,
        "User-Agent": "crm-duda-farage",
      },
      body: ssml,
    },
  );

  if (!response.ok) {
    throw new Error(`Falha no TTS Azure: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return toResult("azure", buffer, "audio/mpeg", { outputFormat, voice });
}

async function generateWithOpenAI(text, options = {}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY nao configurada");
  }

  const responseFormat = options.responseFormat || process.env.OPENAI_TTS_FORMAT || "mp3";
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || process.env.TTS_MODEL || process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: options.voice || process.env.OPENAI_TTS_VOICE || "coral",
      input: text,
      response_format: responseFormat,
      instructions:
        options.instructions ||
        "Voz neutra de assistente educacional, calma, profissional e acolhedora. Nao soar como propaganda.",
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.error?.message || "Falha no TTS OpenAI");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const mimetype =
    responseFormat === "mp3"
      ? "audio/mpeg"
      : responseFormat === "opus"
        ? "audio/ogg"
        : `audio/${responseFormat}`;
  return toResult("openai", buffer, mimetype, { responseFormat });
}

async function generateWithPiper(text, options = {}) {
  const baseUrl = String(process.env.PIPER_SERVER_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("PIPER_SERVER_URL nao configurada");
  }

  const response = await fetch(`${baseUrl}${process.env.PIPER_TTS_PATH || "/tts"}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice: options.voice || process.env.PIPER_VOICE,
      format: options.format || process.env.PIPER_AUDIO_FORMAT || "wav",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha no TTS Piper: HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "audio/wav";
  return toResult("piper", buffer, contentType);
}

function runPowerShell(script, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        env: { ...process.env, ...env },
        windowsHide: true,
      },
    );
    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Windows TTS falhou com codigo ${code}`));
    });
  });
}

async function generateWithWindowsSpeech(text) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "quizv2-tts-"));
  const textPath = path.join(tempDir, "input.txt");
  const outputPath = path.join(tempDir, "output.wav");
  const script = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $env:WINDOWS_TTS_VOICE
if ($voice) {
  try { $synth.SelectVoice($voice) } catch {}
}
$rate = 0
if ([int]::TryParse($env:WINDOWS_TTS_RATE, [ref]$rate)) { $synth.Rate = $rate }
$volume = 90
if ([int]::TryParse($env:WINDOWS_TTS_VOLUME, [ref]$volume)) { $synth.Volume = $volume }
$text = Get-Content -LiteralPath $env:TTS_TEXT_PATH -Raw
$synth.SetOutputToWaveFile($env:TTS_OUTPUT_PATH)
$synth.Speak($text)
$synth.Dispose()
`.trim();

  try {
    await fs.writeFile(textPath, text, "utf8");
    await runPowerShell(script, {
      TTS_TEXT_PATH: textPath,
      TTS_OUTPUT_PATH: outputPath,
    });
    const buffer = await fs.readFile(outputPath);

    return toResult("windows", buffer, "audio/wav", {
      voice: process.env.WINDOWS_TTS_VOICE || "default",
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateSpeech(text, options = {}) {
  const provider = options.provider || getProvider();

  if (provider === "elevenlabs") {
    return generateWithElevenLabs(text, options);
  }

  if (provider === "azure") {
    return generateWithAzure(text, options);
  }

  if (provider === "openai") {
    return generateWithOpenAI(text, options);
  }

  if (provider === "piper") {
    return generateWithPiper(text, options);
  }

  if (provider === "windows") {
    return generateWithWindowsSpeech(text, options);
  }

  throw new Error("TTS_PROVIDER invalido");
}
