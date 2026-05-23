import fs from "node:fs";
import path from "node:path";
import { createId } from "./store.js";

const KNOWLEDGE_FILE = path.resolve("server", "data", "agent-knowledge.json");

const DEFAULT_HANDOFF_KEYWORDS = [
  "atendente",
  "humano",
  "matricula",
  "preco",
  "valor",
  "quanto custa",
  "parcel",
  "boleto",
  "pix",
  "contrato",
];

const GREETING_KEYWORDS = ["oi", "ola", "bom dia", "boa tarde", "boa noite"];
const DIAGNOSTIC_KEYWORDS = ["diagnostico", "resultado", "quiz", "rotina", "resumo"];
const OBJECTION_KEYWORDS = ["nao consigo", "dificil", "sem tempo", "medo", "travada", "perdida"];

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
    ["humanas", ["humanas", "historia", "geografia", "sociologia", "filosofia"]],
    ["linguagens", ["linguagens", "literatura", "portugues", "interpretacao"]],
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

  if (cleaned.length <= maxBubbles) {
    return cleaned;
  }

  const head = cleaned.slice(0, maxBubbles - 1);
  const tail = cleaned
    .slice(maxBubbles - 1)
    .filter((message) => message.type === "text")
    .map((message) => message.body)
    .join("\n\n");

  return [...head, { type: "text", body: tail }];
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

function buildMessages({ contact, diagnostic, intent, knowledge, pathInfo, profile, temperature, text, session }) {
  const name = firstName(contact);
  const greeting = name ? `Oi, ${name}.` : "Oi.";
  const seed = `${contact.id}:${session.turnCount}:${intent}`;
  const opener = pick(REPERTOIRE.opener, seed);
  const bridge = pick(REPERTOIRE.bridge, seed);
  const question = pick(REPERTOIRE.question, seed) || knowledge.conversation.defaultQuestion;
  const topicText = pathInfo.topics.slice(0, 3).join(", ");
  const areaLabel = pathInfo.areaLabel;
  const openAnswer = diagnostic?.openAnswer ? `E o que voce escreveu confirma isso: "${diagnostic.openAnswer}".` : "";

  if (intent === "audio") {
    return [
      `${greeting} ${knowledge.conversation.audioFallback}`,
      diagnostic
        ? `Pelo seu quiz, eu olharia primeiro para ${areaLabel}: ${topicText}.`
        : "Voce sente que esta comecando do zero, sem rotina ou travada mesmo estudando?",
    ];
  }

  if (intent === "handoff") {
    return [
      `${greeting} Entendi.`,
      "Essa parte de valor, matricula ou condicao eu prefiro deixar com a equipe para te passar certinho, sem te falar algo incompleto.",
      "Enquanto isso, me confirma: seu foco hoje e montar rotina, subir nota ou entender se a preparacao encaixa na sua fase?",
    ];
  }

  if (intent === "objection") {
    return [
      `${greeting} faz sentido voce se sentir assim.`,
      "Quando a preparacao fica pesada, normalmente o problema nao e falta de vontade. E excesso de coisa sem uma ordem clara.",
      diagnostic
        ? `No seu caso, eu comecaria por ${areaLabel}, puxando ${topicText}, sem tentar resolver tudo no mesmo dia.`
        : "Me diz so uma coisa: hoje voce trava mais por falta de base, falta de rotina ou por esquecer depois?",
    ];
  }

  if (intent === "greeting" && !diagnostic) {
    return [
      `${greeting} consigo te ajudar a entender seu melhor caminho de estudos.`,
      "Para eu nao te responder no automatico: voce esta comecando do zero, sem rotina ou sente que sua nota travou?",
    ];
  }

  if (!diagnostic) {
    return [
      `${greeting} antes de te indicar um caminho, preciso entender seu momento real.`,
      "Qual area mais te trava hoje: Matematica, Naturezas, Humanas, Linguagens ou Redacao?",
    ];
  }

  const profileLine =
    profile === "alta_intencao"
      ? "Voce demonstrou bastante interesse em uma preparacao guiada, entao vale conduzir isso com prioridade."
      : bridge;

  const temperatureLine =
    temperature === "quente"
      ? "Como voce ja parece mais decidida, o melhor e nao perder tempo com uma lista enorme de conteudos."
      : "O primeiro passo e deixar claro o que vem antes, o que fica para depois e como revisar.";

  return [
    `${greeting} ${opener}`,
    [
      `Pelo seu quiz, o gargalo principal parece estar em ${areaLabel}.`,
      openAnswer,
      profileLine,
    ]
      .filter(Boolean)
      .join(" "),
    `${temperatureLine} Eu comecaria por ${topicText}. ${question}`,
  ];
}

export function isLeadAgentEnabled() {
  return process.env.LEAD_AGENT_ENABLED === "true";
}

export function buildLeadAgentReply(store, { contact, conversation, inboundMessage }) {
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
  const maxBubbles = Number(knowledge.conversation?.maxBubblesPerTurn || 3);
  const messages = compactMessages(
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
      }),
      intent,
    ),
    maxBubbles,
  );

  session.turnCount += 1;
  session.lastIntent = intent;
  session.lastArea = pathInfo.areaKey;
  session.lastProfile = profile;
  session.lastTemperature = temperature;
  session.lastQuestion = messages[messages.length - 1]?.body || "";
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
  session.handoffRequested = intent === "handoff" || session.handoffRequested;
  session.suppressedReason = "";
  session.updatedAt = now();

  return {
    intent,
    status: intent === "handoff" ? "pending" : "open",
    messages,
    memory: {
      sessionId: session.id,
      turnCount: session.turnCount,
      profile,
      temperature,
      area: pathInfo.areaKey,
      phase: pathInfo.phaseKey,
    },
  };
}
