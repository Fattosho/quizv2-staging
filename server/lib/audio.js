function getElevenLabsApiKey() {
  return process.env.ELEVENLABS_API_KEY || "";
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || "";
}

function getProvider() {
  return String(process.env.AUDIO_TRANSCRIPTION_PROVIDER || "elevenlabs").toLowerCase();
}

export function getAudioTranscriptionProvider() {
  return getProvider();
}

function getMediaHeaders() {
  return {
    ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}),
  };
}

function normalizeMediaUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("/")) {
    return `${String(
      process.env.WAHA_BASE_URL ||
        process.env.RAILWAY_SERVICE_WAHA_ALERTAS_DUDA_URL ||
        "http://localhost:3000",
    ).replace(/\/$/, "")}${url}`;
  }

  if (process.env.WAHA_MEDIA_BASE_URL) {
    try {
      const currentUrl = new URL(url);
      const mediaBaseUrl = new URL(process.env.WAHA_MEDIA_BASE_URL);
      currentUrl.protocol = mediaBaseUrl.protocol;
      currentUrl.host = mediaBaseUrl.host;
      return currentUrl.toString();
    } catch {
      return url;
    }
  }

  return url;
}

function isAudioMessage(message) {
  const type = String(message?.type || "").toLowerCase();
  const mimetype = String(message?.raw?.media?.mimetype || "").toLowerCase();

  return (
    type.includes("audio") ||
    type.includes("ptt") ||
    type.includes("voice") ||
    mimetype.startsWith("audio/")
  );
}

async function downloadMedia(media) {
  const url = normalizeMediaUrl(media?.url);
  if (!url) {
    const error = new Error("Audio recebido sem URL de midia do WAHA");
    error.code = "missing_media_url";
    throw error;
  }

  const response = await fetch(url, {
    headers: getMediaHeaders(),
  });

  if (!response.ok) {
    const error = new Error(`Falha ao baixar audio do WAHA: HTTP ${response.status}`);
    error.code = "media_download_failed";
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const maxBytes = Number(process.env.AUDIO_TRANSCRIPTION_MAX_BYTES || 25 * 1024 * 1024);

  if (buffer.length > maxBytes) {
    const error = new Error("Audio maior que o limite configurado para transcricao");
    error.code = "media_too_large";
    throw error;
  }

  return {
    buffer,
    mimetype:
      media?.mimetype ||
      response.headers.get("content-type") ||
      "audio/ogg",
    filename: media?.filename || "whatsapp-audio.ogg",
  };
}

async function transcribeWithElevenLabs({ buffer, mimetype, filename }) {
  if (!getElevenLabsApiKey()) {
    const error = new Error("ELEVENLABS_API_KEY nao configurada");
    error.code = "missing_elevenlabs_key";
    throw error;
  }

  const form = new FormData();
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
  form.append("file", new Blob([buffer], { type: mimetype }), filename);

  if (process.env.ELEVENLABS_STT_LANGUAGE) {
    form.append("language_code", process.env.ELEVENLABS_STT_LANGUAGE);
  }

  if (process.env.ELEVENLABS_STT_TAG_AUDIO_EVENTS) {
    form.append("tag_audio_events", process.env.ELEVENLABS_STT_TAG_AUDIO_EVENTS);
  }

  const enableLogging = process.env.ELEVENLABS_ENABLE_LOGGING || "true";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/speech-to-text?enable_logging=${encodeURIComponent(enableLogging)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getElevenLabsApiKey(),
      },
      body: form,
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.detail?.message || data?.message || "Falha na transcricao ElevenLabs");
    error.code = "elevenlabs_stt_failed";
    error.meta = data;
    throw error;
  }

  return {
    provider: "elevenlabs",
    model: process.env.ELEVENLABS_STT_MODEL || "scribe_v2",
    text: String(data.text || "").trim(),
    language: data.language_code || null,
    raw: data,
  };
}

export function isAudioTranscriptionEnabled() {
  if (getProvider() === "elevenlabs") {
    return Boolean(getElevenLabsApiKey());
  }

  if (getProvider() === "gemini") {
    return Boolean(getGeminiApiKey());
  }

  return false;
}

async function transcribeWithGemini({ buffer, mimetype }) {
  if (!getGeminiApiKey()) {
    const error = new Error("GEMINI_API_KEY nao configurada");
    error.code = "missing_gemini_key";
    throw error;
  }

  const model = process.env.GEMINI_STT_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": getGeminiApiKey(),
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text:
                  "Transcreva este audio de WhatsApp em portugues do Brasil. Responda somente com o texto falado, sem comentarios.",
              },
              {
                inlineData: {
                  mimeType: mimetype || "audio/ogg",
                  data: buffer.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 512,
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data?.error?.message || "Falha na transcricao Gemini");
    error.code = "gemini_stt_failed";
    error.meta = data;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join(" ")
    .replace(/^["']|["']$/g, "")
    .trim();

  return {
    provider: "gemini",
    model,
    text,
    language: "pt-BR",
    raw: data,
  };
}

export async function transcribeAudioMessage(message) {
  if (!isAudioMessage(message)) {
    return null;
  }

  if (!["elevenlabs", "gemini"].includes(getProvider())) {
    return {
      provider: getProvider(),
      text: "",
      error: `Provedor de transcricao nao suportado: ${getProvider()}`,
    };
  }

  try {
    const mediaFile = await downloadMedia(message.raw?.media);
    return getProvider() === "gemini"
      ? await transcribeWithGemini(mediaFile)
      : await transcribeWithElevenLabs(mediaFile);
  } catch (error) {
    return {
      provider: getProvider(),
      text: "",
      error: error.message,
      code: error.code || "audio_transcription_failed",
      meta: error.meta || null,
    };
  }
}

export function isElevenLabsTtsEnabled() {
  return (
    process.env.ELEVENLABS_TTS_ENABLED === "true" &&
    Boolean(getElevenLabsApiKey()) &&
    Boolean(process.env.ELEVENLABS_TTS_VOICE_ID)
  );
}

export async function synthesizeSpeech(text) {
  if (!isElevenLabsTtsEnabled()) {
    return null;
  }

  const outputFormat = process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || "mp3_44100_128";
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_TTS_VOICE_ID}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": getElevenLabsApiKey(),
      },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_TTS_MODEL || "eleven_multilingual_v2",
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
    const error = new Error(data?.detail?.message || data?.message || "Falha no TTS ElevenLabs");
    error.meta = data;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    provider: "elevenlabs",
    mimetype: outputFormat.startsWith("mp3") ? "audio/mpeg" : "audio/ogg",
    base64: buffer.toString("base64"),
    bytes: buffer.length,
  };
}
