import { buildPersonalizedDiagnostic } from "./diagnosticProfiles.js";

const DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbw2_eBFwo3XqSZB19XkCmYVrR-1GFFVLV1SLDnpUP3PMv5BQKEgGbafuJrwaKahoi4yyg/exec";

function getWebhookUrl() {
  return (
    process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
    process.env.LEGACY_WEBHOOK_URL ||
    DEFAULT_GOOGLE_SHEETS_WEBHOOK_URL
  );
}

function isEnabled() {
  return process.env.GOOGLE_SHEETS_FORWARD_ENABLED !== "false";
}

function buildSheetsPayload({ contact, diagnostic }) {
  const personalized = buildPersonalizedDiagnostic({
    studyPhase: diagnostic?.studyPhase || "",
    blockedArea: diagnostic?.blockedArea || "",
  });

  return {
    id: diagnostic?.id || "",
    contactId: contact?.id || diagnostic?.contactId || "",
    conversationId: diagnostic?.conversationId || "",
    createdAt: diagnostic?.createdAt || new Date().toISOString(),

    nome: diagnostic?.name || contact?.name || "",
    whatsapp: diagnostic?.whatsapp || contact?.phone || "",
    objetivo: diagnostic?.objective || "",
    quandoVaiFazer: diagnostic?.examWhen || "",
    faseAtual: diagnostic?.studyPhase || "",
    areaTrava: diagnostic?.blockedArea || "",
    frustracao: diagnostic?.frustration || "",
    rotinaGuiada: diagnostic?.guidedRoutine || "",
    interessePreparacao: diagnostic?.interest || "",
    respostaAberta: diagnostic?.openAnswer || "",

    perfil: diagnostic?.profile || "",
    resumo: diagnostic?.summary || "",
    acaoRecomendada: diagnostic?.recommendedAction || "",
    arquetipo: personalized.archetypeName,
    areaEspecifica: personalized.areaName,
    diagnosticoPersonalizado: personalized.diagnosticTitle,
  };
}

async function postWithTimeout(url, payload) {
  const timeoutMs = Number(process.env.GOOGLE_SHEETS_TIMEOUT_MS || 8000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function forwardLeadToSheets({ contact, diagnostic }) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "disabled",
    };
  }

  const webhookUrl = getWebhookUrl();

  if (!webhookUrl) {
    return {
      skipped: true,
      reason: "missing_webhook_url",
    };
  }

  const payload = buildSheetsPayload({ contact, diagnostic });
  let response = null;
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      response = await postWithTimeout(webhookUrl, payload);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    const error = new Error(
      `Falha ao enviar para Google Sheets: ${lastError?.message || "sem resposta"}`,
    );
    error.meta = {
      name: lastError?.name,
    };
    throw error;
  }

  const body = await response.text().catch(() => "");

  if (!response.ok) {
    const error = new Error(`Google Sheets retornou HTTP ${response.status}`);
    error.meta = {
      status: response.status,
      body: body.slice(0, 500),
    };
    throw error;
  }

  return {
    skipped: false,
    status: response.status,
    body: body.slice(0, 500),
  };
}
