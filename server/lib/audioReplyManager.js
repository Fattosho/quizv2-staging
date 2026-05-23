import { saveGeneratedAudio } from "./audioStorage.js";
import { cleanTextForSpeech } from "./messageHumanizer.js";
import { generateSpeech } from "./ttsProvider.js";
import { shouldSendAudioReply } from "./voicePolicy.js";

export async function buildAudioReplyPlan({
  agentMessage,
  agentReply,
  inboundMessage,
  messageIndex = 0,
}) {
  if (agentMessage?.type === "voice" && agentMessage.url) {
    return {
      mode: "voice_url",
      body: agentMessage.body || "Audio enviado.",
      url: agentMessage.url,
      mimetype: agentMessage.mimetype,
      policy: { allowed: true, reason: "explicit_voice_message" },
    };
  }

  const policy = shouldSendAudioReply({
    agentMessage,
    agentReply,
    inboundMessage,
    messageIndex,
  });

  if (!policy.allowed) {
    return {
      mode: "text",
      body: agentMessage?.body || agentMessage?.content || "",
      policy,
    };
  }

  const spokenText = cleanTextForSpeech(agentMessage?.body || agentMessage?.content || "");
  const speech = await generateSpeech(spokenText);
  const storage = saveGeneratedAudio({
    base64: speech.base64,
    mimetype: speech.mimetype,
    text: spokenText,
    provider: speech.provider,
    policy,
  });

  return {
    mode: "generated_voice",
    body: agentMessage?.body || agentMessage?.content || "",
    spokenText,
    base64: speech.base64,
    mimetype: speech.mimetype,
    speech,
    storage,
    policy,
  };
}

export function getAudioFallbackText() {
  return "Vou te mandar por texto para garantir que voce receba certinho.";
}
