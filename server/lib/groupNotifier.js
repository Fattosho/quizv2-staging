import {
  buildPersonalizedDiagnostic,
  normalizeText,
} from "./diagnosticProfiles.js";
import { getWhatsAppMode, sendTextMessage } from "./whatsapp.js";

function isEnabled() {
  return process.env.LEAD_GROUP_FORWARD_ENABLED === "true";
}

function formatValue(value, fallback = "-") {
  return String(value || "").trim() || fallback;
}

function formatShortValue(value, fallback = "-", maxLength = 90) {
  const text = formatValue(value, fallback)
    .replace(/\uFFFD+/g, "")
    .replace(/\s+/g, " ");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function getQuizUrl() {
  return String(
    process.env.QUIZ_URL ||
      process.env.PUBLIC_QUIZ_URL ||
      "https://dudafaragequiz.vercel.app/",
  ).replace(/\/?$/, "/");
}

function getLeadDiagnostic(diagnostic) {
  return buildPersonalizedDiagnostic({
    studyPhase: diagnostic?.studyPhase || "",
    blockedArea: diagnostic?.blockedArea || "",
  });
}

function getLeadScore(diagnostic, leadDiagnostic) {
  if (!diagnostic) {
    return 40;
  }

  let score = 55;
  const interest = normalizeText(diagnostic.interest);
  const phase = normalizeText(diagnostic.studyPhase);
  const objective = normalizeText(diagnostic.objective);

  if (interest.includes("quero muito")) score += 25;
  if (interest.includes("entender melhor")) score += 16;
  if (interest.includes("depende do valor")) score += 8;
  if (phase.includes("sem rotina") || phase.includes("rotina constante")) score += 8;
  if (phase.includes("nota nao sobe")) score += 8;
  if (leadDiagnostic.archetypeKey === "quase_la") score += 7;
  if (leadDiagnostic.archetypeKey === "esforcado_travado") score += 6;
  if (objective.includes("medicina")) score += 7;

  return Math.min(score, 98);
}

export function buildLeadGroupMessage({ contact, diagnostic }) {
  const leadDiagnostic = getLeadDiagnostic(diagnostic);
  const score = getLeadScore(diagnostic, leadDiagnostic);

  return [
    "🚨 Novo lead Duda Farage",
    "",
    `👤 ${formatValue(contact?.name || diagnostic?.name)}`,
    `📲 ${formatValue(contact?.phone || diagnostic?.whatsapp)}`,
    `🔥 Score: ${score}/100`,
    `🔗 Quiz: ${getQuizUrl()}`,
    "",
    `🧠 ${leadDiagnostic.diagnosticTitle}`,
    `📚 Trava: ${leadDiagnostic.areaName}`,
    "",
    `🎯 Objetivo: ${formatShortValue(diagnostic?.objective)}`,
    `🗓️ Prova: ${formatShortValue(diagnostic?.examWhen)}`,
    `💬 Interesse: ${formatShortValue(diagnostic?.interest)}`,
    "",
    `⚠️ Dor: ${formatShortValue(diagnostic?.studyPhase)}`,
    `😣 Frustração: ${formatShortValue(diagnostic?.frustration)}`,
  ].join("\n");
}

export async function forwardLeadToGroup({ contact, diagnostic }) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "disabled",
    };
  }

  if (getWhatsAppMode() !== "waha") {
    return {
      skipped: true,
      reason: "requires_waha",
      whatsappMode: getWhatsAppMode(),
    };
  }

  const groupChatId = process.env.LEAD_GROUP_CHAT_ID;
  if (!groupChatId) {
    return {
      skipped: true,
      reason: "missing_group_chat_id",
    };
  }

  const text = buildLeadGroupMessage({ contact, diagnostic });
  const result = await sendTextMessage(groupChatId, text);

  return {
    skipped: false,
    groupChatId,
    text,
    result,
  };
}
