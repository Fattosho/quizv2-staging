function normalizeBaseUrl() {
  return String(
    process.env.WAHA_BASE_URL ||
      process.env.RAILWAY_SERVICE_WAHA_ALERTAS_DUDA_URL ||
      "http://localhost:3000",
  ).replace(/\/$/, "");
}

function getHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}),
  };
}

export async function sendVoiceMessage(chatId, audioUrlOrBase64, options = {}) {
  const response = await fetch(
    `${normalizeBaseUrl()}${process.env.WAHA_SEND_VOICE_ENDPOINT || "/api/sendVoice"}`,
    {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        session: process.env.WAHA_SESSION || "default",
        chatId,
        file: options.base64
          ? {
              mimetype: options.mimetype || "audio/mpeg",
              data: audioUrlOrBase64,
            }
          : {
              url: audioUrlOrBase64,
            },
        convert: true,
        ...(options.replyTo ? { reply_to: options.replyTo } : {}),
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Falha ao enviar audio pelo WAHA");
  }

  return data;
}
