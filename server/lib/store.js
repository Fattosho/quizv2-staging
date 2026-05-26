import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const DATA_DIR = path.resolve("server", "data");
const DATA_FILE = path.join(DATA_DIR, "crm-store.json");

const now = () => new Date().toISOString();

const emptyStore = {
  contacts: [],
  conversations: [],
  messages: [],
  diagnostics: [],
  agentSessions: [],
  templates: [
    {
      id: "diagnostico_pronto",
      name: "diagnostico_pronto",
      category: "MARKETING",
      language: "pt_BR",
      body: "Ola, {{1}}. Seu diagnostico de estudos ficou pronto. Posso te enviar por aqui?",
    },
  ],
};

function migrateStore(store) {
  return {
    ...emptyStore,
    ...store,
    contacts: Array.isArray(store.contacts) ? store.contacts : [],
    conversations: Array.isArray(store.conversations) ? store.conversations : [],
    messages: Array.isArray(store.messages) ? store.messages : [],
    diagnostics: Array.isArray(store.diagnostics) ? store.diagnostics : [],
    agentSessions: Array.isArray(store.agentSessions) ? store.agentSessions : [],
    templates: Array.isArray(store.templates) ? store.templates : emptyStore.templates,
  };
}

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(emptyStore, null, 2));
  }
}

export function readStore() {
  ensureDataFile();
  return migrateStore(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")));
}

export function writeStore(nextStore) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(nextStore, null, 2));
  return nextStore;
}

export function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) {
    return "";
  }

  return digits.startsWith("55") ? digits : `55${digits}`;
}

function phoneVariants(phone = "") {
  const normalized = normalizePhone(phone);
  const variants = new Set(normalized ? [normalized] : []);

  if (normalized.startsWith("55") && normalized.length === 13 && normalized[4] === "9") {
    variants.add(`${normalized.slice(0, 4)}${normalized.slice(5)}`);
  }

  if (normalized.startsWith("55") && normalized.length === 12) {
    variants.add(`${normalized.slice(0, 4)}9${normalized.slice(4)}`);
  }

  return [...variants].filter(Boolean);
}

export function createId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

function classifyDiagnostic(answers) {
  const profileRules = [
    {
      profile: "travada_sem_rotina",
      match: answers.studyPhase?.includes("sem rotina"),
      summary:
        "O maior gargalo parece ser constancia. Ela ja tem contato com os estudos, mas falta um plano semanal claro e revisao guiada.",
      recommendedAction:
        "Enviar plano de rotina guiada, reforcar acompanhamento e propor proximo passo com a equipe.",
    },
    {
      profile: "comecando_do_zero",
      match:
        answers.studyPhase?.includes("zero") ||
        answers.studyPhase?.includes("perdido"),
      summary:
        "A aluna precisa de direcao inicial. O diagnostico indica dificuldade para organizar a base e decidir por onde comecar.",
      recommendedAction:
        "Enviar mensagem acolhedora, explicar trilha inicial e convidar para entender a preparacao guiada.",
    },
    {
      profile: "nota_estagnada",
      match: answers.studyPhase?.includes("nota nao sobe"),
      summary:
        "A aluna estuda, mas provavelmente esta repetindo um metodo que nao transforma erro em evolucao mensuravel.",
      recommendedAction:
        "Falar sobre analise de erros, revisao ativa e estrategia por area de maior impacto.",
    },
    {
      profile: "alta_intencao",
      match:
        answers.interest?.includes("quero muito") ||
        answers.interest?.includes("entender melhor"),
      summary:
        "A aluna demonstrou alta intencao de entrar em uma preparacao guiada e deve ser priorizada no atendimento.",
      recommendedAction:
        "Responder rapidamente, apresentar diagnostico curto e conduzir para uma conversa de matricula.",
    },
  ];

  const selected = profileRules.find((rule) => rule.match) ?? {
    profile: "diagnostico_geral",
    summary:
      "As respostas indicam que existe uma oportunidade de organizar melhor estudo, revisao e acompanhamento.",
    recommendedAction:
      "Enviar diagnostico objetivo, validar a principal dor e oferecer uma conversa para explicar o metodo.",
  };

  return {
    profile: selected.profile,
    summary: selected.summary,
    recommendedAction: selected.recommendedAction,
  };
}

export function upsertContact(store, input) {
  const phone = normalizePhone(input.phone ?? input.whatsapp ?? input.waId);
  const variants = phoneVariants(phone);
  const existing =
    store.contacts.find((contact) => input.waId && contact.waId === input.waId) ??
    store.contacts.find((contact) => variants.includes(contact.phone)) ??
    store.contacts.find((contact) => variants.includes(contact.waId));

  if (existing) {
    existing.name = input.name || existing.name || "Sem nome";
    existing.phone = existing.phone || phone;
    existing.waId = input.waId || phone || existing.waId;
    existing.updatedAt = now();
    return existing;
  }

  const contact = {
    id: createId("ct"),
    name: input.name || "Sem nome",
    phone,
    waId: input.waId || phone,
    stage: input.stage || "novo",
    tags: input.tags || [],
    lastInboundAt: input.lastInboundAt || null,
    createdAt: now(),
    updatedAt: now(),
  };

  store.contacts.push(contact);
  return contact;
}

export function ensureConversation(store, contactId) {
  const existing = store.conversations.find(
    (conversation) =>
      conversation.contactId === contactId && conversation.status !== "closed",
  );

  if (existing) {
    return existing;
  }

  const conversation = {
    id: createId("cv"),
    contactId,
    status: "open",
    assignedTo: "",
    channel: "whatsapp",
    unreadCount: 0,
    lastMessageAt: now(),
    createdAt: now(),
    updatedAt: now(),
  };

  store.conversations.push(conversation);
  return conversation;
}

export function addMessage(store, input) {
  const createdAt = input.createdAt || now();
  const message = {
    id: createId("msg"),
    conversationId: input.conversationId,
    contactId: input.contactId,
    direction: input.direction,
    type: input.type || "text",
    body: input.body || "",
    waMessageId: input.waMessageId || null,
    status: input.status || "received",
    raw: input.raw || null,
    createdAt,
  };

  store.messages.push(message);

  const conversation = store.conversations.find(
    (item) => item.id === input.conversationId,
  );
  if (conversation) {
    conversation.lastMessageAt = createdAt;
    conversation.updatedAt = now();
    if (input.direction === "inbound") {
      conversation.unreadCount += 1;
    }
  }

  const contact = store.contacts.find((item) => item.id === input.contactId);
  if (contact && input.direction === "inbound") {
    contact.lastInboundAt = createdAt;
    contact.updatedAt = now();
  }

  return message;
}

export function createDiagnostic(store, answers) {
  const contact = upsertContact(store, {
    name: answers.nome || answers.name,
    phone: answers.whatsapp,
    stage: "diagnostico",
    tags: ["quiz"],
  });
  const conversation = ensureConversation(store, contact.id);
  const classification = classifyDiagnostic({
    studyPhase: answers.faseAtual || answers.studyPhase,
    interest: answers.interessePreparacao || answers.interest,
  });

  const diagnostic = {
    id: createId("dx"),
    contactId: contact.id,
    conversationId: conversation.id,
    name: answers.nome || answers.name || contact.name,
    whatsapp: answers.whatsapp || contact.phone,
    objective: answers.objetivo || answers.objective || "",
    examWhen: answers.quandoVaiFazer || answers.examWhen || "",
    studyPhase: answers.faseAtual || answers.studyPhase || "",
    blockedArea: answers.areaTrava || answers.blockedArea || "",
    frustration: answers.frustracao || answers.frustration || "",
    guidedRoutine: answers.rotinaGuiada || answers.guidedRoutine || "",
    interest: answers.interessePreparacao || answers.interest || "",
    openAnswer: answers.respostaAberta || answers.blocker || "",
    profile: classification.profile,
    summary: classification.summary,
    recommendedAction: classification.recommendedAction,
    createdAt: now(),
  };

  store.diagnostics.push(diagnostic);

  addMessage(store, {
    conversationId: conversation.id,
    contactId: contact.id,
    direction: "inbound",
    type: "quiz",
    body: `Diagnostico preenchido: ${diagnostic.profile}`,
    status: "received",
  });

  return { contact, conversation, diagnostic };
}

export function buildConversationView(store, conversation) {
  const contact = store.contacts.find((item) => item.id === conversation.contactId);
  const latestDiagnostic = store.diagnostics
    .filter((item) => item.contactId === conversation.contactId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const latestMessage = store.messages
    .filter((item) => item.conversationId === conversation.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    ...conversation,
    contact,
    diagnostic: latestDiagnostic || null,
    latestMessage: latestMessage || null,
  };
}

export function generateDiagnosticMessage(contact, diagnostic) {
  if (!diagnostic) {
    return `Oi, ${contact?.name || "tudo bem"}! Vi seu cadastro e queria entender melhor seu momento de estudos para te orientar com mais precisao.`;
  }

  return [
    `Oi, ${contact?.name || diagnostic.name}. Analisei suas respostas do diagnostico.`,
    "",
    diagnostic.summary,
    "",
    `Pelo que voce marcou, seu ponto de atencao agora e: ${diagnostic.blockedArea || "organizacao dos estudos"}.`,
    `Proximo passo: ${diagnostic.recommendedAction}`,
    "",
    "Quer que eu te mostre como ficaria uma rotina guiada para o seu caso?",
  ].join("\n");
}
