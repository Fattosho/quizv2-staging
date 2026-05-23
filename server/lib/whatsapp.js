const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

function getProvider() {
  const configured = String(process.env.WHATSAPP_PROVIDER || "").toLowerCase();

  if (configured === "waha" || configured === "meta") {
    return configured;
  }

  if (process.env.WAHA_BASE_URL) {
    return "waha";
  }

  if (process.env.META_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return "meta";
  }

  return "simulated";
}

export function getWhatsAppMode() {
  return getProvider();
}

export function hasWhatsAppConfig() {
  return getProvider() !== "simulated";
}

function normalizeWahaBaseUrl() {
  return String(process.env.WAHA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function getWahaHeaders() {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(process.env.WAHA_API_KEY ? { "X-Api-Key": process.env.WAHA_API_KEY } : {}),
  };
}

function toWahaChatId(to) {
  const value = String(to || "").trim();

  if (value.endsWith("@c.us") || value.endsWith("@g.us") || value.endsWith("@newsletter")) {
    return value;
  }

  if (value.endsWith("@s.whatsapp.net")) {
    return `${value.replace("@s.whatsapp.net", "")}@c.us`;
  }

  const digits = value.replace(/\D/g, "");
  return digits ? `${digits}@c.us` : value;
}

function fromWahaChatId(chatId) {
  return String(chatId || "")
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "");
}

function getWahaMessageId(result) {
  return result?.id || result?._data?.id?.id || result?.message?.id || null;
}

async function callMeta(endpoint, payload) {
  if (getProvider() !== "meta") {
    return {
      simulated: true,
      id: `sim_${Date.now()}`,
      payload,
    };
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || "Erro ao chamar a API do WhatsApp";
    const error = new Error(message);
    error.meta = data;
    throw error;
  }

  return data;
}

async function callWaha(endpoint, payload) {
  if (getProvider() !== "waha") {
    return {
      simulated: true,
      id: `sim_${Date.now()}`,
      payload,
    };
  }

  const response = await fetch(`${normalizeWahaBaseUrl()}${endpoint}`, {
    method: "POST",
    headers: getWahaHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.message || data?.error || "Erro ao chamar a API do WAHA";
    const error = new Error(message);
    error.meta = data;
    throw error;
  }

  return data;
}

export async function sendTextMessage(to, text) {
  if (getProvider() === "waha") {
    return callWaha("/api/sendText", {
      session: process.env.WAHA_SESSION || "default",
      chatId: toWahaChatId(to),
      text,
      linkPreview: false,
    });
  }

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  };

  return callMeta("messages", payload);
}

export async function sendSeen(to, messageIds = []) {
  if (getProvider() !== "waha") {
    return {
      simulated: true,
      id: `sim_seen_${Date.now()}`,
      payload: { to, messageIds },
    };
  }

  return callWaha("/api/sendSeen", {
    session: process.env.WAHA_SESSION || "default",
    chatId: toWahaChatId(to),
    ...(messageIds.length ? { messageIds } : {}),
  });
}

export async function setChatPresence(to, presence) {
  if (getProvider() !== "waha") {
    return {
      simulated: true,
      id: `sim_presence_${Date.now()}`,
      payload: { to, presence },
    };
  }

  return callWaha(`/api/${process.env.WAHA_SESSION || "default"}/presence`, {
    chatId: toWahaChatId(to),
    presence,
  });
}

export async function sendVoiceMessage(to, voiceUrlOrBase64, options = {}) {
  if (getProvider() !== "waha") {
    return {
      simulated: true,
      id: `sim_voice_${Date.now()}`,
      payload: { to, voiceUrlOrBase64, options },
    };
  }

  const file =
    options.base64 || String(voiceUrlOrBase64 || "").startsWith("data:")
      ? { mimetype: options.mimetype || "audio/ogg; codecs=opus", data: voiceUrlOrBase64 }
      : { url: voiceUrlOrBase64 };

  return callWaha(process.env.WAHA_SEND_VOICE_ENDPOINT || "/api/sendVoice", {
    session: process.env.WAHA_SESSION || "default",
    chatId: toWahaChatId(to),
    file,
    convert: true,
    ...(options.replyTo ? { reply_to: options.replyTo } : {}),
  });
}

function interpolateTemplateText(templateName, variables) {
  const fallback = process.env.WHATSAPP_FIRST_CONTACT_TEXT ||
    "Ola, {{1}}. Seu diagnostico de estudos ficou pronto. Posso te enviar por aqui?";
  const text = templateName === "hello_world" ? "Ola! Tudo bem?" : fallback;

  return variables.reduce(
    (message, value, index) => message.replaceAll(`{{${index + 1}}}`, String(value)),
    text,
  );
}

export async function sendTemplateMessage(to, templateName, languageCode, variables = []) {
  if (getProvider() === "waha") {
    return sendTextMessage(to, interpolateTemplateText(templateName, variables));
  }

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode || "pt_BR",
      },
      components: variables.length
        ? [
            {
              type: "body",
              parameters: variables.map((value) => ({
                type: "text",
                text: String(value),
              })),
            },
          ]
        : [],
    },
  };

  return callMeta("messages", payload);
}

function parseMetaWebhookPayload(body) {
  const changes = body?.entry?.flatMap((entry) => entry.changes || []) || [];
  const events = [];

  for (const change of changes) {
    const value = change.value || {};

    for (const message of value.messages || []) {
      const contact = value.contacts?.find((item) => item.wa_id === message.from);
      const profileName = contact?.profile?.name;
      const type = message.type || "text";
      const bodyText =
        message.text?.body ||
        message.button?.text ||
        message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        `[${type}]`;

      events.push({
        kind: "message",
        waId: message.from,
        name: profileName,
        type,
        body: bodyText,
        waMessageId: message.id,
        timestamp: message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        raw: message,
      });
    }

    for (const status of value.statuses || []) {
      events.push({
        kind: "status",
        waMessageId: status.id,
        status: status.status,
        recipientId: status.recipient_id,
        timestamp: status.timestamp
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        raw: status,
      });
    }
  }

  return events;
}

function parseWahaWebhookPayload(body) {
  const payload = body?.payload || body;
  const event = body?.event || "message";

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (event === "message.ack") {
    return [
      {
        kind: "status",
        waMessageId: payload.id,
        status: String(payload.ack ?? "ack"),
        recipientId: fromWahaChatId(payload.to || payload.chatId),
        timestamp: payload.timestamp
          ? new Date(Number(payload.timestamp) * 1000).toISOString()
          : new Date().toISOString(),
        raw: payload,
      },
    ];
  }

  if (!event.startsWith("message")) {
    return [];
  }

  if (payload.fromMe) {
    return [];
  }

  const chatId = payload.from || payload.chatId || payload.author || payload.participant;
  const mediaMimeType = payload.media?.mimetype || payload.mimetype || "";
  const type =
    payload.type ||
    (mediaMimeType.startsWith("audio/") ? "audio" : payload.hasMedia ? "media" : "text");
  const bodyText =
    payload.body ||
    payload.caption ||
    payload.text ||
    payload.media?.filename ||
    (type === "audio" ? "[Audio recebido]" : "") ||
    `[${type}]`;

  return [
    {
      kind: "message",
      waId: fromWahaChatId(chatId),
      name: payload.notifyName || payload.pushName || payload.sender?.pushName,
      type,
      body: bodyText,
      waMessageId: payload.id,
      media: payload.media || null,
      timestamp: payload.timestamp
        ? new Date(Number(payload.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      raw: payload,
    },
  ];
}

export function parseWebhookPayload(body) {
  if (body?.entry || body?.object === "whatsapp_business_account") {
    return parseMetaWebhookPayload(body);
  }

  return parseWahaWebhookPayload(body);
}

export function getProviderMessageId(result) {
  return result?.messages?.[0]?.id || getWahaMessageId(result) || result?.id || null;
}
