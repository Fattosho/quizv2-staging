import "dotenv/config";
import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import {
  addMessage,
  buildConversationView,
  createDiagnostic,
  ensureConversation,
  generateDiagnosticMessage,
  normalizePhone,
  readStore,
  upsertContact,
  writeStore,
} from "./lib/store.js";
import {
  getAudioTranscriptionProvider,
  isAudioTranscriptionEnabled,
  transcribeAudioMessage,
} from "./lib/audio.js";
import { buildAudioReplyPlan, getAudioFallbackText } from "./lib/audioReplyManager.js";
import { forwardLeadToGroup } from "./lib/groupNotifier.js";
import { buildLeadAgentReply, isLeadAgentEnabled } from "./lib/leadAgent.js";
import {
  getProviderMessageId,
  getWhatsAppMode,
  parseWebhookPayload,
  resolveWahaPhoneId,
  sendSeen,
  sendTemplateMessage,
  sendTextMessage,
  sendVoiceMessage,
  setChatPresence,
} from "./lib/whatsapp.js";

const app = express();
const PORT = process.env.PORT || 8080;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "crm_uno_dev_token";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

function syncCanonicalWaId(contact, metaResult) {
  const canonicalWaId = metaResult?.contacts?.[0]?.wa_id;

  if (!contact || !canonicalWaId) {
    return null;
  }

  if (contact.waId !== canonicalWaId) {
    contact.waId = canonicalWaId;
    contact.updatedAt = new Date().toISOString();
    return canonicalWaId;
  }

  return null;
}

function save(mutator) {
  const store = readStore();
  const result = mutator(store);
  writeStore(store);
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNumberEnv(name, fallback, { min = 0, max = 60000 } = {}) {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getAgentDelayMs(message, index) {
  const base = getNumberEnv("LEAD_AGENT_RESPONSE_DELAY_MS", 1400, { max: 30000 });
  const between = getNumberEnv("LEAD_AGENT_BETWEEN_MESSAGES_DELAY_MS", 850, { max: 30000 });
  const perChar = getNumberEnv("LEAD_AGENT_DELAY_PER_CHAR_MS", 12, { max: 200 });
  const jitter = getNumberEnv("LEAD_AGENT_RESPONSE_JITTER_MS", 900, { max: 10000 });
  const max = getNumberEnv("LEAD_AGENT_MAX_RESPONSE_DELAY_MS", 6500, { max: 60000 });
  const textDelay = Math.min(2800, String(message?.body || "").length * perChar);
  const randomDelay = jitter ? Math.floor(Math.random() * jitter) : 0;
  const baseDelay = index === 0 ? base : between;

  return Math.min(max, baseDelay + textDelay + randomDelay);
}

async function safelySetPresence(to, presence) {
  if (process.env.LEAD_AGENT_SHOW_PRESENCE === "false") {
    return null;
  }

  try {
    return await setChatPresence(to, presence);
  } catch (error) {
    console.warn(`Nao foi possivel atualizar presenca WAHA: ${error.message}`);
    return null;
  }
}

async function safelySendSeen(to, messageIds) {
  if (process.env.LEAD_AGENT_SEND_SEEN === "false") {
    return null;
  }

  try {
    return await sendSeen(to, messageIds);
  } catch (error) {
    console.warn(`Nao foi possivel marcar mensagem como vista: ${error.message}`);
    return null;
  }
}

async function deliverAgentReplies(pendingAgentReplies) {
  for (const pending of pendingAgentReplies) {
    const store = readStore();
    const contact = store.contacts.find((item) => item.id === pending.contactId);
    const conversation = store.conversations.find(
      (item) => item.id === pending.conversationId,
    );

    if (!contact || !conversation) {
      continue;
    }

    const to = contact.waId || contact.phone;

    try {
      await safelySendSeen(to, pending.inboundWaMessageId ? [pending.inboundWaMessageId] : []);

      for (const [index, agentMessage] of pending.agentReply.messages.entries()) {
        const audioPlan = await buildAudioReplyPlan({
          agentMessage,
          agentReply: pending.agentReply,
          inboundMessage: pending.inboundMessage,
          messageIndex: index,
        });
        const isVoice = audioPlan.mode === "voice_url" || audioPlan.mode === "generated_voice";
        const presence = isVoice ? "recording" : "typing";

        await safelySetPresence(to, presence);
        await sleep(getAgentDelayMs(agentMessage, index));
        await safelySetPresence(to, "paused");

        let whatsappResult = null;

        if (audioPlan.mode === "voice_url") {
          whatsappResult = await sendVoiceMessage(to, audioPlan.url, {
              mimetype: audioPlan.mimetype,
              replyTo: pending.inboundWaMessageId,
          });
        } else if (audioPlan.mode === "generated_voice") {
          if (audioPlan.policy.sendTranscript) {
            await sendTextMessage(to, "Te mandei um audio rapidinho com o proximo passo.");
          }

          whatsappResult = await sendVoiceMessage(to, audioPlan.base64, {
            base64: true,
            mimetype: audioPlan.mimetype,
            replyTo: pending.inboundWaMessageId,
          });
        } else {
          whatsappResult = await sendTextMessage(to, audioPlan.body);
        }

        syncCanonicalWaId(contact, whatsappResult);
        conversation.status = pending.agentReply.status || conversation.status;
        conversation.updatedAt = new Date().toISOString();

        addMessage(store, {
          conversationId: conversation.id,
          contactId: contact.id,
          direction: "outbound",
          type: isVoice ? "agent_voice" : "agent",
          body: agentMessage.body,
          waMessageId: getProviderMessageId(whatsappResult),
          status: whatsappResult?.simulated ? "simulated" : "sent",
          raw: {
            intent: pending.agentReply.intent,
            memory: pending.agentReply.memory,
            provider: getWhatsAppMode(),
            audio: audioPlan,
            messageIndex: index,
            result: whatsappResult,
          },
        });

        writeStore(store);
      }
    } catch (error) {
      try {
        await sendTextMessage(to, getAudioFallbackText());
        for (const fallbackMessage of pending.agentReply.messages || []) {
          const fallbackText = fallbackMessage.body || fallbackMessage.content;
          if (fallbackText) {
            await sendTextMessage(to, fallbackText);
          }
        }
      } catch {
        // The original error is more useful for the CRM log.
      }

      addMessage(store, {
        conversationId: conversation.id,
        contactId: contact.id,
        direction: "outbound",
        type: "agent_error",
        body: `Falha ao enviar resposta automatica: ${error.message}`,
        status: "failed",
        raw: error.meta || null,
      });
      writeStore(store);
    } finally {
      await safelySetPresence(to, "paused");
    }
  }
}

async function prepareInboundAudioForAgent(inboundMessage) {
  const transcription = await transcribeAudioMessage(inboundMessage);

  if (!transcription) {
    return inboundMessage;
  }

  inboundMessage.raw = {
    ...(inboundMessage.raw || {}),
    transcription,
  };

  if (transcription.text) {
    inboundMessage.body = transcription.text;
    inboundMessage.type = "audio_transcription";
  }

  return inboundMessage;
}

async function processAgentJobs(agentJobs) {
  const pendingAgentReplies = [];

  for (const job of agentJobs) {
    const store = readStore();
    const contact = store.contacts.find((item) => item.id === job.contactId);
    const conversation = store.conversations.find(
      (item) => item.id === job.conversationId,
    );
    const inboundMessage = store.messages.find((item) => item.id === job.inboundMessageId);

    if (!contact || !conversation || !inboundMessage) {
      continue;
    }

    await prepareInboundAudioForAgent(inboundMessage);

    const agentReply = await buildLeadAgentReply(store, {
      contact,
      conversation,
      inboundMessage,
    });

    writeStore(store);

    if (agentReply) {
      pendingAgentReplies.push({
        contactId: contact.id,
        conversationId: conversation.id,
        inboundWaMessageId: inboundMessage.waMessageId,
        inboundMessage,
        agentReply,
      });
    }
  }

  if (pendingAgentReplies.length) {
    await deliverAgentReplies(pendingAgentReplies);
  }
}

app.get("/health", (_request, response) => {
  response.json({
    ok: true,
    whatsappMode: getWhatsAppMode(),
    firstContactTemplate: {
      name: process.env.WHATSAPP_FIRST_CONTACT_TEMPLATE || "hello_world",
      language: process.env.WHATSAPP_FIRST_CONTACT_LANGUAGE || "en_US",
      autoSend: process.env.AUTO_SEND_FIRST_CONTACT === "true",
    },
    leadAgent: {
      enabled: isLeadAgentEnabled(),
      aiProvider: process.env.LEAD_AGENT_AI_PROVIDER || "off",
      maxBubbleChars: Number(process.env.LEAD_AGENT_MAX_BUBBLE_CHARS || 115),
      audioTranscription: isAudioTranscriptionEnabled() ? getAudioTranscriptionProvider() : "disabled",
      audioReplies: process.env.ENABLE_AUDIO_REPLIES === "true" ? process.env.AUDIO_REPLY_MODE || "smart" : "disabled",
      tts: process.env.ENABLE_AUDIO_REPLIES === "true" ? process.env.TTS_PROVIDER || "elevenlabs" : "disabled",
    },
    leadGroupForward: {
      enabled: process.env.LEAD_GROUP_FORWARD_ENABLED === "true",
      configured: Boolean(process.env.LEAD_GROUP_CHAT_ID),
    },
  });
});

async function sendFirstContact(store, conversation, contact, variables = []) {
  const templateName = process.env.WHATSAPP_FIRST_CONTACT_TEMPLATE || "hello_world";
  const language = process.env.WHATSAPP_FIRST_CONTACT_LANGUAGE || "en_US";
  const templateVariables = templateName === "hello_world" ? [] : variables;
  const whatsappResult = await sendTemplateMessage(
    contact.waId || contact.phone,
    templateName,
    language,
    templateVariables,
  );
  syncCanonicalWaId(contact, whatsappResult);
  const waMessageId = getProviderMessageId(whatsappResult);

  return addMessage(store, {
    conversationId: conversation.id,
    contactId: contact.id,
    direction: "outbound",
    type: "template",
    body: `Primeiro contato enviado: ${templateName}`,
    waMessageId,
    status: whatsappResult?.simulated ? "simulated" : "sent",
    raw: whatsappResult,
  });
}

app.post("/api/diagnostics", async (request, response) => {
  const store = readStore();
  const result = createDiagnostic(store, request.body || {});
  let firstContact = null;
  let firstContactError = null;
  let groupForward = null;
  let groupForwardError = null;

  if (process.env.AUTO_SEND_FIRST_CONTACT === "true") {
    try {
      firstContact = await sendFirstContact(
        store,
        result.conversation,
        result.contact,
        [result.contact.name || result.diagnostic.name || "aluna"],
      );
    } catch (error) {
      firstContactError = {
        message: error.message,
        meta: error.meta || null,
      };
    }
  }

  try {
    groupForward = await forwardLeadToGroup({
      contact: result.contact,
      diagnostic: result.diagnostic,
    });
  } catch (error) {
    groupForwardError = {
      message: error.message,
      meta: error.meta || null,
    };
  }

  writeStore(store);
  response.status(201).json({
    ...result,
    firstContact,
    firstContactError,
    groupForward,
    groupForwardError,
  });
});

app.get("/api/crm/summary", (_request, response) => {
  const store = readStore();
  const conversations = store.conversations.map((conversation) =>
    buildConversationView(store, conversation),
  );

  response.json({
    contacts: store.contacts.length,
    open: conversations.filter((item) => item.status === "open").length,
    pending: conversations.filter((item) => item.status === "pending").length,
    diagnostics: store.diagnostics.length,
    unread: conversations.reduce((sum, item) => sum + item.unreadCount, 0),
    whatsappMode: getWhatsAppMode(),
    leadAgentEnabled: isLeadAgentEnabled(),
  });
});

app.get("/api/crm/conversations", (request, response) => {
  const store = readStore();
  const status = request.query.status || "all";
  const search = String(request.query.search || "").toLowerCase();

  let conversations = store.conversations.map((conversation) =>
    buildConversationView(store, conversation),
  );

  if (status !== "all") {
    conversations = conversations.filter((conversation) => conversation.status === status);
  }

  if (search) {
    conversations = conversations.filter((conversation) => {
      const contact = conversation.contact || {};
      return (
        contact.name?.toLowerCase().includes(search) ||
        contact.phone?.includes(search) ||
        conversation.diagnostic?.profile?.toLowerCase().includes(search)
      );
    });
  }

  conversations.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  response.json(conversations);
});

app.get("/api/crm/conversations/:id", (request, response) => {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === request.params.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  const messages = store.messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const view = buildConversationView(store, conversation);
  response.json({ ...view, messages });
});

app.patch("/api/crm/conversations/:id", (request, response) => {
  const result = save((store) => {
    const conversation = store.conversations.find((item) => item.id === request.params.id);
    if (!conversation) {
      return null;
    }

    if (request.body.status) {
      conversation.status = request.body.status;
    }

    if ("assignedTo" in request.body) {
      conversation.assignedTo = request.body.assignedTo || "";
    }

    conversation.updatedAt = new Date().toISOString();
    return buildConversationView(store, conversation);
  });

  if (!result) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  response.json(result);
});

app.post("/api/crm/conversations/:id/read", (request, response) => {
  const result = save((store) => {
    const conversation = store.conversations.find((item) => item.id === request.params.id);
    if (!conversation) {
      return null;
    }

    conversation.unreadCount = 0;
    conversation.updatedAt = new Date().toISOString();
    return buildConversationView(store, conversation);
  });

  if (!result) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  response.json(result);
});

app.post("/api/crm/conversations/:id/messages", async (request, response) => {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === request.params.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  const contact = store.contacts.find((item) => item.id === conversation.contactId);
  const text = String(request.body.text || "").trim();

  if (!text) {
    response.status(400).json({ error: "Mensagem vazia" });
    return;
  }

  try {
    const whatsappResult = await sendTextMessage(contact.waId || contact.phone, text);
    syncCanonicalWaId(contact, whatsappResult);
    const waMessageId = getProviderMessageId(whatsappResult);
    const message = addMessage(store, {
      conversationId: conversation.id,
      contactId: contact.id,
      direction: "outbound",
      type: "text",
      body: text,
      waMessageId,
      status: whatsappResult?.simulated ? "simulated" : "sent",
      raw: whatsappResult,
    });
    writeStore(store);
    response.status(201).json(message);
  } catch (error) {
    response.status(502).json({
      error: error.message,
      meta: error.meta || null,
    });
  }
});

app.post("/api/crm/conversations/:id/template", async (request, response) => {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === request.params.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  const contact = store.contacts.find((item) => item.id === conversation.contactId);
  const templateName =
    request.body.templateName || process.env.WHATSAPP_FIRST_CONTACT_TEMPLATE || "hello_world";
  const language =
    request.body.language || process.env.WHATSAPP_FIRST_CONTACT_LANGUAGE || "en_US";
  const variables =
    request.body.variables ||
    (templateName === "hello_world" ? [] : [contact.name || "aluna"]);

  try {
    const whatsappResult = await sendTemplateMessage(
      contact.waId || contact.phone,
      templateName,
      language,
      variables,
    );
    syncCanonicalWaId(contact, whatsappResult);
    const waMessageId = getProviderMessageId(whatsappResult);
    const message = addMessage(store, {
      conversationId: conversation.id,
      contactId: contact.id,
      direction: "outbound",
      type: "template",
      body: `Template ${templateName} enviado`,
      waMessageId,
      status: whatsappResult?.simulated ? "simulated" : "sent",
      raw: whatsappResult,
    });
    writeStore(store);
    response.status(201).json(message);
  } catch (error) {
    response.status(502).json({
      error: error.message,
      meta: error.meta || null,
    });
  }
});

app.post("/api/crm/conversations/:id/first-contact", async (request, response) => {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === request.params.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  const contact = store.contacts.find((item) => item.id === conversation.contactId);

  try {
    const message = await sendFirstContact(
      store,
      conversation,
      contact,
      request.body.variables || [contact.name || "aluna"],
    );
    writeStore(store);
    response.status(201).json(message);
  } catch (error) {
    response.status(502).json({
      error: error.message,
      meta: error.meta || null,
    });
  }
});

app.post("/api/crm/conversations/:id/generate-diagnostic-reply", (request, response) => {
  const store = readStore();
  const conversation = store.conversations.find((item) => item.id === request.params.id);

  if (!conversation) {
    response.status(404).json({ error: "Conversa nao encontrada" });
    return;
  }

  const contact = store.contacts.find((item) => item.id === conversation.contactId);
  const diagnostic = store.diagnostics
    .filter((item) => item.contactId === contact.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  response.json({
    text: generateDiagnosticMessage(contact, diagnostic),
  });
});

app.post("/api/crm/mock-inbound", (request, response) => {
  const result = save((store) => {
    const phone = normalizePhone(request.body.phone || "5511999999999");
    const contact = upsertContact(store, {
      name: request.body.name || "Lead de Teste",
      phone,
      waId: phone,
    });
    const conversation = ensureConversation(store, contact.id);
    const message = addMessage(store, {
      conversationId: conversation.id,
      contactId: contact.id,
      direction: "inbound",
      type: "text",
      body: request.body.text || "Quero receber meu diagnostico",
      waMessageId: `mock_${Date.now()}`,
      status: "received",
    });

    return { contact, conversation, message };
  });

  response.status(201).json(result);
});

app.get("/webhooks/whatsapp", (request, response) => {
  const mode = request.query["hub.mode"];
  const token = request.query["hub.verify_token"];
  const challenge = request.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    response.status(200).send(challenge);
    return;
  }

  response.sendStatus(403);
});

app.post("/webhooks/whatsapp", async (request, response) => {
  const events = parseWebhookPayload(request.body);
  const store = readStore();
  const agentJobs = [];

  for (const event of events) {
    if (event.kind === "message") {
      const resolvedPhone = await resolveWahaPhoneId(event.waId);
      const contact = upsertContact(store, {
        name: event.name,
        phone: resolvedPhone || event.phone || event.waId,
        waId: event.waId,
      });
      const conversation = ensureConversation(store, contact.id);

      const inboundMessage = addMessage(store, {
        conversationId: conversation.id,
        contactId: contact.id,
        direction: "inbound",
        type: event.type,
        body: event.body,
        waMessageId: event.waMessageId,
        status: "received",
        raw: event.raw,
        createdAt: event.timestamp,
      });

      if (isLeadAgentEnabled()) {
        agentJobs.push({
          contactId: contact.id,
          conversationId: conversation.id,
          inboundMessageId: inboundMessage.id,
          inboundWaMessageId: event.waMessageId,
        });
      }
    }

    if (event.kind === "status") {
      const message = store.messages.find(
        (item) => item.waMessageId === event.waMessageId,
      );
      if (message) {
        message.status = event.status;
        message.raw = event.raw;
      }
    }
  }

  writeStore(store);
  response.sendStatus(200);

  if (agentJobs.length) {
    processAgentJobs(agentJobs).catch((error) => {
      console.error("Erro ao entregar respostas do agente", error);
    });
  }
});

const distDir = path.resolve("dist");
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/.*/, (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`CRM API listening on http://localhost:${PORT}`);
});
