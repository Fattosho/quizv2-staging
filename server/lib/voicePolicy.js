import {
  cleanTextForSpeech,
  estimateSpeechDurationSeconds,
  hasImportantWrittenData,
} from "./messageHumanizer.js";

const BLOCKED_INTENTS = new Set([
  "handoff",
  "price",
  "payment",
  "contract",
  "complaint",
  "sensitive",
]);

function boolEnv(name, fallback = false) {
  const value = process.env[name];
  if (value == null || value === "") {
    return fallback;
  }

  return value === "true";
}

function getAudioMode() {
  if (process.env.ENABLE_AUDIO_REPLIES === "false") {
    return "off";
  }

  if (process.env.ENABLE_AUDIO_REPLIES === "true") {
    return process.env.AUDIO_REPLY_MODE || "smart";
  }

  if (process.env.ELEVENLABS_TTS_ENABLED === "true") {
    return process.env.ELEVENLABS_TTS_REPLY_MODE || "smart";
  }

  return "off";
}

function normalizePolicyText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function userAskedForAudio(text = "") {
  return /\b(audio|voz|manda.*audio|me explica falando)\b/i.test(normalizePolicyText(text));
}

function userSoundsIrritated(text = "") {
  return /\b(absurdo|irritad|chatead|cansad|nao quero|parem|spam)\b/i.test(
    normalizePolicyText(text),
  );
}

function isInboundAudio(inboundMessage) {
  const type = String(inboundMessage?.type || "").toLowerCase();
  return type.includes("audio") || type.includes("voice") || type.includes("ptt");
}

export function shouldSendAudioReply({
  agentMessage,
  agentReply,
  inboundMessage,
  messageIndex = 0,
}) {
  const mode = getAudioMode();
  const content = agentMessage?.body || agentMessage?.content || "";
  const cleanContent = cleanTextForSpeech(content);
  const inboundText = inboundMessage?.body || "";
  const intent = agentReply?.intent || "";
  const urgency = agentReply?.urgency || "baixa";
  const duration = estimateSpeechDurationSeconds(cleanContent);
  const maxDuration = Number(process.env.MAX_AUDIO_DURATION_SECONDS || 35);
  const userSentAudio = isInboundAudio(inboundMessage);
  const askedForAudio = userAskedForAudio(inboundText);
  const sendTranscript = boolEnv("SEND_AUDIO_TRANSCRIPT", true);

  if (mode === "off") {
    return { allowed: false, reason: "audio_off", sendTranscript };
  }

  if (!cleanContent) {
    return { allowed: false, reason: "empty_content", sendTranscript };
  }

  if (urgency === "alta" || intent === "urgencia") {
    return { allowed: false, reason: "urgency", sendTranscript };
  }

  if (agentReply?.handoff) {
    return { allowed: false, reason: "handoff", sendTranscript };
  }

  if (BLOCKED_INTENTS.has(intent)) {
    return { allowed: false, reason: "blocked_intent", sendTranscript };
  }

  if (hasImportantWrittenData(content)) {
    return { allowed: false, reason: "important_written_data", sendTranscript };
  }

  if (cleanContent.length > 400 || duration > maxDuration) {
    return { allowed: false, reason: "too_long", sendTranscript };
  }

  if (userSoundsIrritated(inboundText)) {
    return { allowed: false, reason: "irritated_user", sendTranscript };
  }

  if (boolEnv("AUDIO_ONLY_WHEN_USER_SENDS_AUDIO", false) && !userSentAudio && !askedForAudio) {
    return { allowed: false, reason: "only_when_user_sends_audio", sendTranscript };
  }

  if (mode === "always") {
    return { allowed: true, reason: "always", sendTranscript };
  }

  if (mode === "user_preference") {
    return {
      allowed: userSentAudio || askedForAudio,
      reason: userSentAudio || askedForAudio ? "user_preference_audio" : "ask_preference_first",
      sendTranscript,
    };
  }

  const smartAllowed =
    userSentAudio ||
    askedForAudio ||
    (messageIndex === 0 &&
      ["audio", "greeting", "follow_up", "qualification"].includes(intent) &&
      cleanContent.length <= 260);

  return {
    allowed: smartAllowed,
    reason: smartAllowed ? "smart_match" : "smart_text_better",
    sendTranscript,
  };
}
