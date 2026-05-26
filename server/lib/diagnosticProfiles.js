const ARCHETYPES = [
  {
    key: "iniciante",
    name: "O Iniciante",
    matches: ["estou comecando do zero", "comecando do zero"],
    summary:
      "Ponto de partida: precisa construir base, rotina e ordem antes de acelerar.",
    action:
      "Começar pela base da área travada, com uma rotina guiada simples e acompanhamento de evolução.",
  },
  {
    key: "inconstante",
    name: "O Inconstante",
    matches: [
      "ja estudo mas nao tenho uma rotina constante",
      "ja estudo mas sem rotina",
      "sem rotina",
    ],
    summary:
      "Já existe contato com os estudos, mas falta constância e uma rotina que não dependa de ânimo.",
    action:
      "Organizar uma rotina semanal realista, com revisão e prioridade clara na área de maior trava.",
  },
  {
    key: "esforcado_travado",
    name: "O Esforçado Travado",
    matches: ["estudo bastante mas minha nota nao sobe", "nota nao sobe"],
    summary:
      "Existe esforço, mas a nota não sobe porque os erros ainda não estão virando revisão e ajuste de método.",
    action:
      "Fazer análise de erros, revisar os pontos de maior impacto e trocar volume solto por treino direcionado.",
  },
  {
    key: "quase_la",
    name: "O Quase Lá",
    matches: [
      "tenho uma base boa mas ainda perco pontos que nao deveria",
      "tenho uma base boa mas quero evoluir mais",
      "base boa",
    ],
    summary:
      "Já existe base, mas ainda há perda de pontos evitáveis por falta de refinamento, revisão e estratégia.",
    action:
      "Refinar a revisão, mapear perdas recorrentes e treinar questões mais direcionadas da área travada.",
  },
  {
    key: "sem_direcao",
    name: "O Sem Direção",
    matches: [
      "me sinto sem direcao e nao sei o que priorizar",
      "sem direcao",
      "me sinto perdido e nao sei o que priorizar",
      "me sinto perdidao e nao sei o que priorizar",
      "me sinto perdida e nao sei o que priorizar",
      "estou perdido e nao sei por onde comecar",
      "perdido",
      "priorizar",
    ],
    summary:
      "Falta direção: o principal gargalo é saber o que estudar primeiro e o que deixar para depois.",
    action:
      "Definir uma primeira prioridade, montar uma trilha curta e evitar tentar resolver todas as matérias ao mesmo tempo.",
  },
];

const AREAS = [
  {
    key: "matematica",
    name: "Matemática",
    matches: ["matematica", "exatas"],
    focus: "Matematica",
  },
  {
    key: "naturezas",
    name: "Naturezas",
    matches: ["naturezas", "ciencias da natureza", "biologia", "quimica", "fisica"],
    focus: "Naturezas",
  },
  {
    key: "linguagens",
    name: "Linguagens",
    matches: ["linguagens", "portugues", "interpretacao", "literatura"],
    focus: "Linguagens",
  },
  {
    key: "humanas",
    name: "Humanas",
    matches: ["humanas", "historia", "geografia", "sociologia", "filosofia"],
    focus: "Humanas",
  },
  {
    key: "redacao",
    name: "Redação",
    matches: ["redacao", "texto", "dissertativo"],
    focus: "Redacao",
  },
  {
    key: "varias_areas",
    name: "Várias áreas",
    matches: ["todas um pouco", "varias areas", "varias materias", "tudo um pouco"],
    focus: "várias áreas",
  },
];

function fixCommonMojibake(value) {
  return String(value || "")
    .replaceAll("Ã£", "ã")
    .replaceAll("Ã¡", "á")
    .replaceAll("Ã¢", "â")
    .replaceAll("Ã©", "é")
    .replaceAll("Ãª", "ê")
    .replaceAll("Ã­", "í")
    .replaceAll("Ã³", "ó")
    .replaceAll("Ã´", "ô")
    .replaceAll("Ãµ", "õ")
    .replaceAll("Ãº", "ú")
    .replaceAll("Ã§", "ç");
}

export function normalizeText(value = "") {
  return fixCommonMojibake(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findMatch(items, source, fallback) {
  return (
    items.find((item) => item.matches.some((matcher) => source.includes(matcher))) ||
    fallback
  );
}

function buildAreaAction(area) {
  if (area.key === "varias_areas") {
    return "primeiro descobrir qual área pesa mais hoje, para não tentar atacar tudo junto";
  }

  return `começar por ${area.focus} com base, questões e revisão dos erros`;
}

export function buildPersonalizedDiagnostic(input = {}) {
  const studyPhase = input.studyPhase || input.faseAtual || "";
  const blockedArea = input.blockedArea || input.areaTrava || "";
  const normalizedPhase = normalizeText(studyPhase);
  const normalizedArea = normalizeText(blockedArea);
  const archetype = findMatch(ARCHETYPES, normalizedPhase, ARCHETYPES[0]);
  const area = findMatch(AREAS, normalizedArea, AREAS[5]);
  const diagnosticTitle = `${archetype.name} + ${area.name}`;

  return {
    archetypeKey: archetype.key,
    archetypeName: archetype.name,
    areaKey: area.key,
    areaName: area.name,
    diagnosticTitle,
    summary: `${diagnosticTitle}: ${archetype.summary}`,
    recommendedAction: `${archetype.action} No WhatsApp, o próximo passo é ${buildAreaAction(
      area,
    )}.`,
  };
}

export function getDiagnosticTitle(diagnostic) {
  if (!diagnostic) {
    return "";
  }

  if (diagnostic.diagnosticTitle) {
    return diagnostic.diagnosticTitle;
  }

  return buildPersonalizedDiagnostic({
    studyPhase: diagnostic.studyPhase,
    blockedArea: diagnostic.blockedArea,
  }).diagnosticTitle;
}
