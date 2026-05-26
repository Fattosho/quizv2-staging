import fs from "node:fs";
import path from "node:path";
import { buildAiLeadAgentReply } from "./aiReplyProvider.js";
import { createId } from "./store.js";

const KNOWLEDGE_FILE = path.resolve("server", "data", "agent-knowledge.json");

const DEFAULT_HANDOFF_KEYWORDS = [
  "atendente",
  "humano",
  "matricula",
  "inscricao",
  "inscrever",
  "preco",
  "valores",
  "valor",
  "investimento",
  "quanto custa",
  "depende do valor",
  "parcel",
  "boleto",
  "pix",
  "contrato",
  "programacao",
  "programacao guiada",
  "como funciona",
  "quero entrar",
  "quero participar",
  "proximos passos",
];

const GREETING_KEYWORDS = ["oi", "ola", "bom dia", "boa tarde", "boa noite"];
const DIAGNOSTIC_KEYWORDS = ["diagnostico", "resultado", "quiz", "rotina", "resumo"];
const OBJECTION_KEYWORDS = ["nao consigo", "dificil", "sem tempo", "medo", "travada", "perdida"];
const NEXT_STEP_KEYWORDS = ["claro", "mostre", "sim", "quero", "pode", "vamos", "ok", "manda"];
const NEGATIVE_KEYWORDS = ["agora nao", "depois", "nao quero", "nao precisa", "prefiro nao", "sem interesse"];
const ROUTINE_KEYWORDS = ["rotina", "semana", "7 dias", "sete dias", "crie", "monta", "modelo"];
const AVAILABILITY_KEYWORDS = [
  "dia",
  "dias",
  "semana",
  "hora",
  "horas",
  "manha",
  "tarde",
  "noite",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
  "domingo",
];

const REPERTOIRE = {
  opener: [
    "Li seu diagnostico com calma.",
    "Vi suas respostas por aqui.",
    "Peguei o principal do que voce marcou.",
  ],
  bridge: [
    "Isso nao parece falta de esforco; parece falta de ordem e acompanhamento.",
    "O ponto aqui nao e estudar mais por impulso, e estudar com uma sequencia mais clara.",
    "Da para organizar isso sem tentar abracar todas as materias ao mesmo tempo.",
  ],
  question: [
    "Faz sentido se eu te mostrar qual seria o primeiro passo?",
    "Quer que eu te mostre por onde eu comecaria no seu caso?",
    "Posso te guiar pelo primeiro ajuste da sua rotina?",
  ],
};

const FALLBACK_KNOWLEDGE = {
  conversation: {
    maxBubblesPerTurn: 3,
    defaultQuestion:
      "Faz sentido pra voce se eu te mostrar qual seria o primeiro passo da sua rotina guiada?",
    audioFallback:
      "Recebi seu audio. Para nao te responder algo raso, vou te guiar por aqui com uma pergunta bem objetiva.",
  },
  safety: {
    handoffTopics: DEFAULT_HANDOFF_KEYWORDS,
  },
  studyTopics: {},
};

function now() {
  return new Date().toISOString();
}

function normalizeText(value = "") {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getKeywords(envValue, fallback) {
  return String(envValue || "")
    .split(",")
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .concat(fallback.map((item) => normalizeText(item)));
}

function includesAny(text, keywords) {
  return keywords.some((keyword) => keyword && text.includes(keyword));
}

function loadAgentKnowledge() {
  try {
    return {
      ...FALLBACK_KNOWLEDGE,
      ...JSON.parse(fs.readFileSync(KNOWLEDGE_FILE, "utf8")),
    };
  } catch {
    return FALLBACK_KNOWLEDGE;
  }
}

function getLatestDiagnostic(store, contactId) {
  return store.diagnostics
    .filter((item) => item.contactId === contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function ensureAgentSession(store, conversation, contact) {
  store.agentSessions = Array.isArray(store.agentSessions) ? store.agentSessions : [];

  let session = store.agentSessions.find((item) => item.conversationId === conversation.id);
  if (!session) {
    session = {
      id: createId("as"),
      conversationId: conversation.id,
      contactId: contact.id,
      turnCount: 0,
      lastIntent: "",
      lastArea: "",
      lastProfile: "",
      lastTemperature: "",
      lastQuestion: "",
      flowStage: "new",
      handledMessageIds: [],
      recentInbound: [],
      outboundTimestamps: [],
      handoffRequested: false,
      suppressedReason: "",
      createdAt: now(),
      updatedAt: now(),
    };
    store.agentSessions.push(session);
  }

  return session;
}

function firstName(contact) {
  const name = contact?.name && contact.name !== "Sem nome" ? contact.name : "";
  return name.split(" ").filter(Boolean)[0] || "";
}

function pick(list, seed) {
  if (!list?.length) {
    return "";
  }

  const sum = String(seed || "")
    .split("")
    .reduce((total, char) => total + char.charCodeAt(0), 0);
  return list[sum % list.length];
}

function classifyProfile(diagnostic) {
  const studyPhase = normalizeText(diagnostic?.studyPhase);
  const interest = normalizeText(diagnostic?.interest);

  if (studyPhase.includes("zero") || studyPhase.includes("perdido")) {
    return "comecando_do_zero";
  }

  if (studyPhase.includes("sem rotina")) {
    return "sem_rotina";
  }

  if (studyPhase.includes("nota nao sobe")) {
    return "nota_estagnada";
  }

  if (studyPhase.includes("base boa")) {
    return "base_boa";
  }

  if (interest.includes("quero muito") || interest.includes("entender melhor")) {
    return "alta_intencao";
  }

  return diagnostic?.profile || "diagnostico_geral";
}

function classifyTemperature(diagnostic, text) {
  const interest = normalizeText(diagnostic?.interest);

  if (
    interest.includes("quero muito") ||
    text.includes("matricula") ||
    text.includes("entrar") ||
    text.includes("vaga")
  ) {
    return "quente";
  }

  if (interest.includes("entender melhor") || interest.includes("depende do valor")) {
    return "morna";
  }

  if (interest.includes("nao tenho interesse")) {
    return "fria";
  }

  return "neutra";
}

function detectAreaKey(diagnostic, text, knowledge) {
  const source = `${normalizeText(diagnostic?.blockedArea)} ${text}`;

  if (source.includes("todas") || source.includes("tudo um pouco")) {
    return "";
  }

  const aliases = [
    ["matematica", ["matematica", "mat", "exatas"]],
    ["quimica", ["quimica"]],
    ["biologia", ["biologia", "bio"]],
    ["fisica", ["fisica"]],
    ["naturezas", ["naturezas", "ciencias da natureza"]],
    ["historia", ["historia"]],
    ["geografia_geral", ["geografia geral", "geopolitica mundial", "cartografia mundial"]],
    ["geografia_brasil", ["geografia do brasil", "brasil", "matriz energetica", "urbanizacao"]],
    ["sociologia", ["sociologia"]],
    ["filosofia", ["filosofia"]],
    ["literatura", ["literatura"]],
    ["humanas", ["humanas", "geografia"]],
    ["linguagens", ["linguagens", "portugues", "interpretacao"]],
    ["redacao", ["redacao", "redigir", "texto"]],
  ];

  const match = aliases.find(([, values]) => values.some((value) => source.includes(value)));
  if (match && knowledge.studyTopics?.[match[0]]) {
    return match[0];
  }

  return knowledge.studyTopics?.matematica ? "matematica" : "";
}

function detectPhaseKey(profile) {
  if (["comecando_do_zero", "sem_rotina"].includes(profile)) {
    return "phase1";
  }

  if (["nota_estagnada", "alta_intencao"].includes(profile)) {
    return "phase2";
  }

  if (profile === "base_boa") {
    return "phase3";
  }

  return "phase1";
}

function getPhaseReading(profile) {
  if (profile === "iniciante" || profile === "comecando_do_zero") {
    return {
      label: "O Iniciante",
      message: "a aluna precisa construir base, rotina e ordem de estudo",
    };
  }

  if (profile === "inconstante" || profile === "sem_rotina") {
    return {
      label: "O Inconstante",
      message: "a aluna precisa transformar esforco solto em rotina guiada",
    };
  }

  if (profile === "quase_la" || profile === "base_boa" || profile === "alta_intencao") {
    return {
      label: "O Quase Lá",
      message: "a aluna precisa refinar revisao, estrategia e perda de pontos",
    };
  }

  if (profile === "esforcado_travado" || profile === "nota_estagnada") {
    return {
      label: "O Esforçado Travado",
      message: "a aluna precisa de analise de erro, metodo e refinamento",
    };
  }

  if (profile === "sem_direcao") {
    return {
      label: "O Sem Direção",
      message: "a aluna precisa de prioridade clara e trilha de estudo",
    };
  }

  return {
    label: "diagnostico educacional",
    message: "a lead precisa de uma trilha clara a partir do momento atual",
  };
}

function buildStudyPath(diagnostic, text, knowledge) {
  const profile = classifyProfile(diagnostic);
  const areaKey = detectAreaKey(diagnostic, text, knowledge);
  const phaseKey = detectPhaseKey(profile);
  const area = knowledge.studyTopics?.[areaKey];
  const topics = area?.[phaseKey]?.slice(0, 4) || [];

  if (!area || !topics.length) {
    const blockedArea = normalizeText(diagnostic?.blockedArea);
    return {
      areaKey: "geral",
      areaLabel: blockedArea.includes("todas")
        ? "base geral e organizacao"
        : diagnostic?.blockedArea || "sua principal dificuldade",
      phaseKey,
      topics: ["base", "rotina", "questoes", "revisao dos erros"],
    };
  }

  return {
    areaKey,
    areaLabel: area.label || diagnostic?.blockedArea || areaKey,
    phaseKey,
    topics,
  };
}

function getIntent({ inboundMessage, text, diagnostic, handoffKeywords }) {
  const type = normalizeText(inboundMessage.type);
  const hasTranscription = Boolean(inboundMessage.raw?.transcription?.text);

  if ((type.includes("audio") || text.includes("[audio")) && !hasTranscription) {
    return "audio";
  }

  if (includesAny(text, handoffKeywords)) {
    return "handoff";
  }

  if (diagnostic && includesAny(text, NEXT_STEP_KEYWORDS)) {
    return "next_step";
  }

  if (includesAny(text, OBJECTION_KEYWORDS)) {
    return "objection";
  }

  if (includesAny(text, DIAGNOSTIC_KEYWORDS) && diagnostic) {
    return "diagnostic";
  }

  if (includesAny(text, GREETING_KEYWORDS)) {
    return "greeting";
  }

  return diagnostic ? "follow_up" : "qualification";
}

function compactMessages(messages, maxBubbles) {
  const cleaned = messages
    .flat()
    .filter(Boolean)
    .map((message) =>
      typeof message === "string"
        ? { type: "text", body: message.trim() }
        : { ...message, body: String(message.body || "").trim() },
    )
    .filter((message) => message.body || message.url);

  const maxChars = Number(process.env.LEAD_AGENT_MAX_BUBBLE_CHARS || 115);
  const shortened = cleaned.flatMap((message) => {
    if (message.type !== "text" || message.body.length <= maxChars) {
      return [message];
    }

    const sentences = message.body
      .split(/(?<=[.!?])\s+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (sentences.length <= 1) {
      return [{ ...message, body: `${message.body.slice(0, maxChars - 3).trim()}...` }];
    }

    return sentences.map((body) => ({ ...message, body }));
  });

  const cleanedShort = shortened.slice(0, Math.max(1, maxBubbles));

  if (cleanedShort.length <= maxBubbles) {
    return cleanedShort;
  }

  const head = cleanedShort.slice(0, maxBubbles - 1);
  const tail = cleanedShort
    .slice(maxBubbles - 1)
    .filter((message) => message.type === "text")
    .map((message) => message.body)
    .join("\n\n");

  return [...head, { type: "text", body: tail }];
}

function getMeaningfulOpenAnswer(diagnostic) {
  const answer = String(diagnostic?.openAnswer || "").trim();

  if (answer.length < 12 || ["teste", "test", "nao sei"].includes(normalizeText(answer))) {
    return "";
  }

  return answer.length > 90 ? `${answer.slice(0, 87).trim()}...` : answer;
}

function getDiagnosticSignals(diagnostic) {
  return {
    objective: diagnostic?.objective || "",
    examWhen: diagnostic?.examWhen || "",
    studyPhase: diagnostic?.studyPhase || "",
    blockedArea: diagnostic?.blockedArea || "",
    frustration: diagnostic?.frustration || "",
    guidedRoutine: diagnostic?.guidedRoutine || "",
    interest: diagnostic?.interest || "",
    summary: diagnostic?.summary || "",
    recommendedAction: diagnostic?.recommendedAction || "",
    openAnswer: getMeaningfulOpenAnswer(diagnostic),
  };
}

function getLeadArgument(signals, pathInfo) {
  const frustration = normalizeText(signals.frustration);
  const studyPhase = normalizeText(signals.studyPhase);
  const examWhen = normalizeText(signals.examWhen);

  if (frustration.includes("parar")) {
    return "Aqui o risco nao e comecar. E manter uma rotina que nao dependa de animo.";
  }

  if (frustration.includes("errar") || frustration.includes("sabia")) {
    return "O ponto e transformar erro em revisao, nao so fazer mais questoes.";
  }

  if (studyPhase.includes("zero") || studyPhase.includes("perdido")) {
    return `Antes de acelerar, vale construir base em ${pathInfo.areaLabel}.`;
  }

  if (studyPhase.includes("sem rotina")) {
    return "O gargalo parece mais ordem semanal do que falta de conteudo.";
  }

  if (examWhen.includes("neste ano")) {
    return "Como a prova esta perto, precisa cortar excesso e priorizar o que destrava.";
  }

  return "O caminho e diagnosticar, priorizar e revisar antes de acumular materia.";
}

function getShortTopics(pathInfo) {
  return pathInfo.topics.slice(0, 2).join(" e ");
}

function isBroadArea(pathInfo) {
  return pathInfo.areaKey === "geral" || normalizeText(pathInfo.areaLabel).includes("base geral");
}

function hasAffirmation(text) {
  return includesAny(text, NEXT_STEP_KEYWORDS);
}

function hasNegative(text) {
  return text === "nao" || includesAny(text, NEGATIVE_KEYWORDS);
}

function hasRoutineRequest(text) {
  return includesAny(text, ROUTINE_KEYWORDS);
}

function hasAvailabilitySignal(text) {
  return /\b\d+\b/.test(text) || includesAny(text, AVAILABILITY_KEYWORDS);
}

function inferFlowStage(session) {
  if (session.flowStage && session.flowStage !== "new") {
    return session.flowStage;
  }

  const lastQuestion = normalizeText(session.lastQuestion);

  if (lastQuestion.includes("modelo de rotina") || lastQuestion.includes("rotina de 7 dias")) {
    return "asked_routine_model";
  }

  if (lastQuestion.includes("quantos dias") || lastQuestion.includes("consegue estudar")) {
    return "asked_availability";
  }

  if (lastQuestion.includes("encaminh") || lastQuestion.includes("continuar por aqui")) {
    return "asked_handoff";
  }

  if (lastQuestion.includes("primeiro passo") || lastQuestion.includes("comecaria")) {
    return "asked_first_step";
  }

  return "new";
}

function getNextFlowStage({ session, intent, text }) {
  const current = inferFlowStage(session);

  if (intent === "handoff") {
    return "handoff_requested";
  }

  if (hasNegative(text)) {
    return "paused";
  }

  if (current === "asked_first_step" && hasAffirmation(text)) {
    return "explaining_first_step";
  }

  if (current === "asked_routine_model" && (hasAffirmation(text) || hasRoutineRequest(text))) {
    return "showing_routine_model";
  }

  if (current === "asked_availability" && (hasAvailabilitySignal(text) || text.length > 2)) {
    return "qualifying_availability";
  }

  if (current === "asked_handoff" && hasAffirmation(text)) {
    return "handoff_requested";
  }

  if (hasRoutineRequest(text)) {
    return "showing_routine_model";
  }

  if (intent === "next_step" && current === "new") {
    return "explaining_first_step";
  }

  if (intent === "next_step" && current === "explaining_first_step") {
    return "showing_routine_model";
  }

  return current;
}

function getStageAfterReply(flowStage, intent, diagnostic) {
  if (intent === "handoff" || flowStage === "handoff_requested") {
    return "handoff_requested";
  }

  if (flowStage === "paused") {
    return "paused";
  }

  if (flowStage === "explaining_first_step") {
    return "asked_routine_model";
  }

  if (flowStage === "showing_routine_model") {
    return "asked_availability";
  }

  if (flowStage === "qualifying_availability") {
    return "asked_handoff";
  }

  if (diagnostic && ["follow_up", "diagnostic", "greeting"].includes(intent)) {
    return "asked_first_step";
  }

  return flowStage || "new";
}

function getAvailabilityText(text) {
  const cleaned = String(text || "").trim();

  if (!cleaned) {
    return "esse tempo";
  }

  return cleaned.length > 45 ? `${cleaned.slice(0, 42).trim()}...` : cleaned;
}

function buildFirstStepMessages(pathInfo) {
  const [topicOne = "base", topicTwo = "questoes"] = pathInfo.topics;

  if (isBroadArea(pathInfo)) {
    return [
      "Quando trava em varias materias, o problema costuma ser falta de trilha.",
      "Para nao baguncar tudo, a gente escolhe uma prioridade primeiro.",
      "Hoje pesa mais: Matematica, Naturezas, Humanas, Linguagens ou Redacao?",
    ];
  }

  if (pathInfo.areaKey === "redacao") {
    return [
      "Em Redacao, eu nao montaria uma lista gigante agora.",
      "O primeiro passo e entender se trava em estrutura, repertorio ou argumentacao.",
      "Qual desses pontos mais pega para voce hoje?",
    ];
  }

  return [
    "Fechado. O primeiro passo nao e estudar tudo.",
    `E destravar ${pathInfo.areaLabel} com ${topicOne} e ${topicTwo}.`,
    "Quer que eu te mostre um modelo de rotina de 7 dias?",
  ];
}

function buildRoutineModelMessages(pathInfo) {
  const [topicOne = "base", topicTwo = "questoes"] = pathInfo.topics;

  if (isBroadArea(pathInfo)) {
    return [
      "Modelo simples: escolher uma area principal e nao tentar atacar tudo junto.",
      "Depois vem base, questoes e revisao dos erros nessa prioridade.",
      "Qual area voce quer priorizar primeiro?",
    ];
  }

  if (pathInfo.areaKey === "redacao") {
    return [
      "Modelo simples: estrutura, repertorio, pratica e correcao.",
      "Sem inventar cronograma enorme antes de achar o ponto que trava.",
      "Hoje voce trava mais em estrutura, repertorio ou argumentacao?",
    ];
  }

  return [
    "Modelo simples: 3 dias de base, 2 de questoes e 1 de revisao.",
    `Na primeira semana, eu colocaria ${topicOne} e ${topicTwo}.`,
    "Quantos dias por semana voce consegue estudar de verdade?",
  ];
}

function buildAvailabilityMessages(text) {
  return [
    `Com ${getAvailabilityText(text)}, da para montar uma rotina enxuta.`,
    "A ideia e caber na sua semana, sem virar um cronograma impossivel.",
    "Quer que eu te encaminhe para a equipe continuar por aqui?",
  ];
}

function buildHandoffRequestedMessages(contact, text = "", signals = {}) {
  const name = firstName(contact);
  const value = normalizeText(text);

  if (value.includes("depende do valor")) {
    return [
      "Totalmente justo.",
      `Pelo seu diagnostico, primeiro vale entender se faz sentido para ${signals.blockedArea || "seu momento"}.`,
      "Posso pedir para alguem da equipe te explicar com calma?",
    ];
  }

  if (
    value.includes("preco") ||
    value.includes("valor") ||
    value.includes("valores") ||
    value.includes("quanto custa") ||
    value.includes("investimento")
  ) {
    return [
      `${name ? `${name}, ` : ""}te explico sim.`,
      "Como depende do seu momento, a equipe passa certinho para nao te mandar algo incompleto.",
      "Posso pedir para alguem te chamar e explicar os valores?",
    ];
  }

  return [
    `${name ? `${name}, ` : ""}perfeito.`,
    "Vou pedir para uma pessoa da equipe continuar com voce.",
    "Ela consegue olhar seu diagnostico e explicar a programacao certinho.",
  ];
}

function buildPausedMessages(pathInfo) {
  return [
    "Sem problema.",
    `Se quiser continuar depois, eu retomo por ${pathInfo.areaLabel}.`,
    "Posso te mandar so um resumo bem curto do primeiro passo?",
  ];
}

function addOptionalVoice(messages, intent) {
  if (
    process.env.LEAD_AGENT_USE_AUDIO_REPLIES !== "true" ||
    !process.env.LEAD_AGENT_AUDIO_REPLY_URL ||
    intent === "audio"
  ) {
    return messages;
  }

  return [
    {
      type: "voice",
      body: "Audio de acolhimento enviado.",
      url: process.env.LEAD_AGENT_AUDIO_REPLY_URL,
    },
    ...messages,
  ];
}

function hasHitRateLimit(session) {
  const maxPerHour = Number(process.env.LEAD_AGENT_MAX_AUTO_MESSAGES_PER_HOUR || 8);
  const cutoff = Date.now() - 60 * 60 * 1000;
  session.outboundTimestamps = (session.outboundTimestamps || []).filter(
    (value) => new Date(value).getTime() > cutoff,
  );

  return session.outboundTimestamps.length >= maxPerHour;
}

function buildMessages({
  contact,
  diagnostic,
  intent,
  knowledge,
  pathInfo,
  profile,
  temperature,
  text,
  session,
  flowStage,
}) {
  const name = firstName(contact);
  const greeting = name ? `Oi, ${name}.` : "Oi.";
  const topicText = getShortTopics(pathInfo);
  const areaLabel = pathInfo.areaLabel;
  const signals = getDiagnosticSignals(diagnostic);
  const phaseReading = getPhaseReading(profile);

  if (flowStage === "paused") {
    return buildPausedMessages(pathInfo);
  }

  if (intent === "audio") {
    return [
      `${greeting} recebi seu audio.`,
      diagnostic
        ? `Pelo quiz, eu olharia primeiro para ${areaLabel}.`
        : "Voce sente que esta comecando do zero, sem rotina ou travada mesmo estudando?",
    ];
  }

  if (intent === "handoff") {
    return buildHandoffRequestedMessages(contact, text, signals);
  }

  if (intent === "objection") {
    if (isBroadArea(pathInfo)) {
      return [
        `${greeting} entendo. Quando parece que trava tudo, geralmente falta trilha.`,
        "O melhor e escolher uma prioridade antes de tentar resolver todas.",
        "Hoje pesa mais: Matematica, Naturezas, Humanas, Linguagens ou Redacao?",
      ];
    }

    return [
      `${greeting} faz sentido voce se sentir assim.`,
      "Geralmente nao e falta de vontade. E excesso de coisa sem ordem.",
      diagnostic
        ? `No seu caso, eu comecaria por ${topicText}.`
        : "Me diz so uma coisa: hoje voce trava mais por falta de base, falta de rotina ou por esquecer depois?",
    ];
  }

  if (flowStage === "handoff_requested") {
    return buildHandoffRequestedMessages(contact, text, signals);
  }

  if (flowStage === "qualifying_availability") {
    return buildAvailabilityMessages(text);
  }

  if (flowStage === "showing_routine_model") {
    return buildRoutineModelMessages(pathInfo);
  }

  if (flowStage === "explaining_first_step" || (intent === "next_step" && diagnostic)) {
    return buildFirstStepMessages(pathInfo);
  }

  if (intent === "greeting" && !diagnostic) {
    return [
      `${greeting} consigo te ajudar.`,
      "Voce esta comecando do zero, sem rotina ou com a nota travada?",
    ];
  }

  if (!diagnostic) {
    return [
      `${greeting} antes de indicar um caminho, preciso entender seu momento.`,
      "Qual area mais te trava hoje?",
    ];
  }

  if (isBroadArea(pathInfo)) {
    return [
      `${greeting} entendi seu momento pelo diagnostico.`,
      "Quando trava em tudo um pouco, isso costuma ser falta de trilha clara.",
      "Hoje pesa mais: Matematica, Naturezas, Humanas, Linguagens ou Redacao?",
    ];
  }

  if (pathInfo.areaKey === "naturezas") {
    return [
      `${greeting} entendi seu momento pelo diagnostico.`,
      `Sua leitura parece: ${phaseReading.label}.`,
      "Dentro de Naturezas, pesa mais Biologia, Quimica ou Fisica?",
    ];
  }

  if (pathInfo.areaKey === "redacao") {
    return [
      `${greeting} entendi seu momento pelo diagnostico.`,
      `Sua leitura parece: ${phaseReading.label}.`,
      "Em Redacao, trava mais estrutura, repertorio ou argumentacao?",
    ];
  }

  return [
    `${greeting} entendi seu momento pelo diagnostico.`,
    `Sua leitura parece: ${phaseReading.label}.`,
    `Como trava em ${areaLabel}, eu comecaria por ${topicText}. Quer ver o primeiro passo?`,
  ];
}

export function isLeadAgentEnabled() {
  return process.env.LEAD_AGENT_ENABLED === "true";
}

export async function buildLeadAgentReply(store, { contact, conversation, inboundMessage }) {
  if (!isLeadAgentEnabled() || !contact || !conversation || !inboundMessage) {
    return null;
  }

  if (conversation.assignedTo && process.env.LEAD_AGENT_REPLY_ASSIGNED !== "true") {
    return null;
  }

  const session = ensureAgentSession(store, conversation, contact);
  const handledId = inboundMessage.waMessageId || inboundMessage.id;

  if (handledId && session.handledMessageIds?.includes(handledId)) {
    return null;
  }

  if (hasHitRateLimit(session)) {
    conversation.status = "pending";
    session.suppressedReason = "rate_limit";
    session.updatedAt = now();
    return null;
  }

  const text = normalizeText(inboundMessage.body);
  if (!text && normalizeText(inboundMessage.type) !== "audio") {
    return null;
  }

  const knowledge = loadAgentKnowledge();
  const diagnostic = getLatestDiagnostic(store, contact.id);
  const handoffKeywords = getKeywords(
    process.env.LEAD_AGENT_HANDOFF_KEYWORDS,
    [...DEFAULT_HANDOFF_KEYWORDS, ...(knowledge.safety?.handoffTopics || [])],
  );
  const intent = getIntent({ inboundMessage, text, diagnostic, handoffKeywords });
  const profile = classifyProfile(diagnostic);
  const temperature = classifyTemperature(diagnostic, text);
  const pathInfo = buildStudyPath(diagnostic, text, knowledge);
  const signals = getDiagnosticSignals(diagnostic);
  const maxBubbles = Number(knowledge.conversation?.maxBubblesPerTurn || 3);
  const flowStage = getNextFlowStage({ session, intent, text });
  const fallbackMessages = compactMessages(
    addOptionalVoice(
      buildMessages({
        contact,
        diagnostic,
        intent,
        knowledge,
        pathInfo,
        profile,
        temperature,
        text,
        session,
        flowStage,
      }),
      intent,
    ),
    maxBubbles,
  );
  let messages = fallbackMessages;
  let ai = null;
  const useAiForScriptedFlow = process.env.LEAD_AGENT_AI_FOR_FLOW === "true";
  const scriptedFlowStages = [
    "explaining_first_step",
    "showing_routine_model",
    "qualifying_availability",
    "handoff_requested",
    "paused",
  ];
  const shouldUseAi = useAiForScriptedFlow || !scriptedFlowStages.includes(flowStage);

  if (shouldUseAi) {
    try {
      ai = await buildAiLeadAgentReply({
        contactName: firstName(contact),
        inboundText: inboundMessage.body,
        intent,
        flowStage,
        profile,
        temperature,
        areaLabel: pathInfo.areaLabel,
        areaKey: pathInfo.areaKey,
        phaseKey: pathInfo.phaseKey,
        phaseReading: getPhaseReading(profile),
        topics: pathInfo.topics.slice(0, 3),
        diagnostic: signals,
        openAnswer: signals.openAnswer,
        method: knowledge.method,
        communication: knowledge.communication,
        leadArgument: getLeadArgument(signals, pathInfo),
        turnCount: session.turnCount,
        lastQuestion: session.lastQuestion,
        fallbackMessages,
      });

      if (ai?.messages?.length) {
        messages = compactMessages(ai.messages, maxBubbles);
      }
    } catch (error) {
      console.warn(`IA do agente indisponivel, usando fallback local: ${error.message}`);
    }
  }

  session.turnCount += 1;
  session.lastIntent = intent;
  session.lastArea = pathInfo.areaKey;
  session.lastProfile = profile;
  session.lastTemperature = temperature;
  session.lastQuestion = messages[messages.length - 1]?.body || "";
  session.flowStage = getStageAfterReply(flowStage, intent, diagnostic);
  session.recentInbound = [
    ...(session.recentInbound || []),
    {
      id: handledId || inboundMessage.id,
      body: inboundMessage.body,
      type: inboundMessage.type,
      at: now(),
    },
  ].slice(-8);
  session.handledMessageIds = [...(session.handledMessageIds || []), handledId].filter(Boolean).slice(-40);
  session.outboundTimestamps = [
    ...(session.outboundTimestamps || []),
    ...messages.map(() => now()),
  ].slice(-40);
  session.handoffRequested =
    Boolean(ai?.handoff) ||
    flowStage === "handoff_requested" ||
    intent === "handoff" ||
    session.handoffRequested;
  session.suppressedReason = "";
  session.updatedAt = now();

  return {
    intent,
    handoff: session.handoffRequested,
    status: session.handoffRequested ? "pending" : "open",
    messages,
    memory: {
      sessionId: session.id,
      turnCount: session.turnCount,
      profile,
      temperature,
      area: pathInfo.areaKey,
      phase: pathInfo.phaseKey,
      flowStage: session.flowStage,
      aiProvider: ai ? process.env.LEAD_AGENT_AI_PROVIDER || "off" : "fallback",
    },
  };
}
