import { getWhatsAppMode, sendTextMessage } from "./whatsapp.js";

function isEnabled() {
  return process.env.LEAD_GROUP_FORWARD_ENABLED === "true";
}

function formatValue(value, fallback = "-") {
  return String(value || "").trim() || fallback;
}

function getLeadScore(diagnostic) {
  if (!diagnostic) {
    return 40;
  }

  let score = 55;
  const interest = String(diagnostic.interest || "").toLowerCase();
  const phase = String(diagnostic.studyPhase || "").toLowerCase();
  const objective = String(diagnostic.objective || "").toLowerCase();

  if (interest.includes("quero muito")) score += 25;
  if (interest.includes("entender melhor")) score += 16;
  if (interest.includes("depende do valor")) score += 8;
  if (phase.includes("sem rotina")) score += 8;
  if (phase.includes("nota nao sobe") || phase.includes("nota não sobe")) score += 8;
  if (objective.includes("medicina")) score += 7;

  return Math.min(score, 98);
}

export function buildLeadGroupMessage({ contact, diagnostic }) {
  const score = getLeadScore(diagnostic);

  return [
    "Novo lead do quiz Duda Farage",
    "",
    `Nome: ${formatValue(contact?.name || diagnostic?.name)}`,
    `WhatsApp: ${formatValue(contact?.phone || diagnostic?.whatsapp)}`,
    `Objetivo: ${formatValue(diagnostic?.objective)}`,
    `Quando vai fazer: ${formatValue(diagnostic?.examWhen)}`,
    `Fase atual: ${formatValue(diagnostic?.studyPhase)}`,
    `Area que mais trava: ${formatValue(diagnostic?.blockedArea)}`,
    `Frustracao: ${formatValue(diagnostic?.frustration)}`,
    `Rotina guiada: ${formatValue(diagnostic?.guidedRoutine)}`,
    `Interesse: ${formatValue(diagnostic?.interest)}`,
    `Perfil: ${formatValue(diagnostic?.profile)}`,
    `Score: ${score}/100`,
    "",
    `Resposta aberta: ${formatValue(diagnostic?.openAnswer)}`,
    "",
    "Proxima acao sugerida:",
    formatValue(diagnostic?.recommendedAction),
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
