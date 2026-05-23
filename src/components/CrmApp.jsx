import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api.js";
import "./CrmApp.css";

const STATUSES = [
  { value: "all", label: "Todas" },
  { value: "open", label: "Abertas" },
  { value: "pending", label: "Pendentes" },
  { value: "closed", label: "Fechadas" },
];

const QUICK_REPLIES = [
  "Oi, analisei seu diagnostico e ja consigo te orientar com mais clareza.",
  "Seu principal gargalo hoje parece ser rotina e revisao. Quer que eu te mostre um caminho?",
  "Posso te enviar uma sugestao objetiva de proximos passos para essa fase?",
];

const DEMO_DIAGNOSTICS = [
  {
    nome: "Livia Martins",
    whatsapp: "(11) 98444-2140",
    objetivo: "Passar em Medicina",
    quandoVaiFazer: "Neste ano",
    faseAtual: "Ja estudo, mas sem rotina",
    areaTrava: "Naturezas",
    frustracao: "Nao saber se estou evoluindo",
    interessePreparacao: "Sim, quero muito",
    respostaAberta: "Eu estudo, mas sinto que nao tenho uma direcao clara.",
  },
  {
    nome: "Camila Rocha",
    whatsapp: "(21) 97731-8092",
    objetivo: "Passar em uma universidade publica",
    quandoVaiFazer: "Ano que vem",
    faseAtual: "Estou comecando do zero",
    areaTrava: "Matematica",
    frustracao: "Nao ter alguem me dizendo o que fazer",
    interessePreparacao: "Sim, quero entender melhor",
    respostaAberta: "Preciso organizar minha base desde o inicio.",
  },
  {
    nome: "Beatriz Lima",
    whatsapp: "(31) 99112-4068",
    objetivo: "Conseguir bolsa pelo ENEM",
    quandoVaiFazer: "Neste ano",
    faseAtual: "Estudo bastante, mas minha nota nao sobe",
    areaTrava: "Redacao",
    frustracao: "Errar questoes que eu achava que sabia",
    interessePreparacao: "Talvez, depende do valor",
    respostaAberta: "Tenho medo de estar estudando errado.",
  },
];

const formatTime = (value) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "";

const getInitials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "DF";

const getLeadScore = (diagnostic) => {
  if (!diagnostic) {
    return 42;
  }

  let score = 58;
  if (diagnostic.interest?.toLowerCase().includes("quero muito")) score += 24;
  if (diagnostic.interest?.toLowerCase().includes("entender melhor")) score += 16;
  if (diagnostic.studyPhase?.toLowerCase().includes("sem rotina")) score += 8;
  if (diagnostic.studyPhase?.toLowerCase().includes("nota nao sobe")) score += 7;
  if (diagnostic.objective?.toLowerCase().includes("medicina")) score += 6;
  return Math.min(score, 98);
};

const getWhatsAppModeLabel = (mode) => {
  if (mode === "waha") return "WAHA";
  if (mode === "meta") return "Cloud API";
  return "Modo simulado";
};

function BrandMark() {
  return (
    <div className="crm-brand-mark" aria-hidden="true">
      <span>DF</span>
    </div>
  );
}

function Metric({ label, value, detail, trend }) {
  return (
    <article className="crm-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {trend && <b>{trend}</b>}
    </article>
  );
}

function Dashboard({ summary, conversations, onSeedDemo, isBusy }) {
  const open = summary?.open ?? 0;
  const diagnostics = summary?.diagnostics ?? 0;
  const pending = summary?.pending ?? 0;
  const unread = summary?.unread ?? 0;
  const total = summary?.contacts ?? 0;
  const conversion = total ? Math.round((diagnostics / total) * 100) : 0;
  const stages = [
    { label: "Novos leads", value: total, width: Math.max(12, total * 18) },
    { label: "Diagnosticos", value: diagnostics, width: Math.max(12, diagnostics * 22) },
    { label: "Atendimento", value: open, width: Math.max(12, open * 22) },
    { label: "Follow-up", value: pending, width: Math.max(12, pending * 22) },
  ];
  const hotLeads = conversations
    .filter((item) => item.diagnostic)
    .slice(0, 3);

  return (
    <section className="crm-dashboard">
      <div className="crm-hero-panel">
        <div className="crm-hero-copy">
          <p>Central de relacionamento</p>
          <h2>Diagnosticos, WhatsApp e atendimento em uma unica operacao.</h2>
          <span>
            Acompanhe leads do quiz, leia conversas, gere respostas guiadas e
            mantenha o follow-up no padrao Duda Farage.
          </span>
        </div>
        <div className="crm-hero-actions">
          <button disabled={isBusy} onClick={onSeedDemo} type="button">
            Popular demo
          </button>
          <a href="/" target="_blank" rel="noreferrer">
            Abrir quiz
          </a>
        </div>
      </div>

      <div className="crm-metrics-grid">
        <Metric
          detail="base ativa"
          label="Contatos"
          trend={total ? "em captura" : "modo demo"}
          value={total}
        />
        <Metric detail="com ficha completa" label="Diagnosticos" value={diagnostics} />
        <Metric detail="conversas abertas" label="Atendimento" value={open} />
        <Metric detail="sem leitura" label="Nao lidas" value={unread} />
      </div>

      <div className="crm-insights">
        <article className="crm-insight-card crm-insight-card--pipeline">
          <div className="crm-section-title">
            <p>Funil</p>
            <strong>{conversion}% diagnosticados</strong>
          </div>
          <div className="crm-pipeline">
            {stages.map((stage) => (
              <div className="crm-pipeline-row" key={stage.label}>
                <span>{stage.label}</span>
                <div>
                  <i style={{ width: `${Math.min(stage.width, 100)}%` }} />
                </div>
                <b>{stage.value}</b>
              </div>
            ))}
          </div>
        </article>

        <article className="crm-insight-card">
          <div className="crm-section-title">
            <p>Radar comercial</p>
            <strong>Prioridades</strong>
          </div>
          <div className="crm-radar-list">
            {hotLeads.length ? (
              hotLeads.map((lead) => (
                <div className="crm-radar-item" key={lead.id}>
                  <span>{getLeadScore(lead.diagnostic)}</span>
                  <div>
                    <strong>{lead.contact?.name}</strong>
                    <small>{lead.diagnostic?.profile}</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="crm-radar-empty">
                <strong>Sem leads reais ainda</strong>
                <small>Use o modo demo ou responda o quiz para visualizar o fluxo.</small>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function ConversationItem({ conversation, isActive, onClick }) {
  const contact = conversation.contact || {};
  const message = conversation.latestMessage;
  const diagnostic = conversation.diagnostic;

  return (
    <button
      className={`crm-conversation${isActive ? " crm-conversation--active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <span className="crm-avatar">{getInitials(contact.name)}</span>
      <span className="crm-conversation__main">
        <span className="crm-conversation__top">
          <strong>{contact.name || "Lead sem nome"}</strong>
          <small>{formatTime(conversation.lastMessageAt)}</small>
        </span>
        <span className="crm-conversation__bottom">
          <span>{message?.body || "Sem mensagens"}</span>
          {conversation.unreadCount > 0 && (
            <b className="crm-unread">{conversation.unreadCount}</b>
          )}
        </span>
        <span className="crm-conversation__meta">
          <small>{diagnostic?.profile || "lead sem diagnostico"}</small>
          <i>{conversation.status}</i>
        </span>
      </span>
    </button>
  );
}

function MessageBubble({ message }) {
  return (
    <div className={`crm-message crm-message--${message.direction}`}>
      <div className="crm-message__bubble">
        <p>{message.body}</p>
        <span>
          {formatTime(message.createdAt)} · {message.status}
        </span>
      </div>
    </div>
  );
}

function DiagnosticPanel({ conversation, onGenerateReply, onSendTemplate, isBusy }) {
  const contact = conversation?.contact || {};
  const diagnostic = conversation?.diagnostic;
  const score = getLeadScore(diagnostic);
  const lastInboundAt = contact.lastInboundAt ? new Date(contact.lastInboundAt) : null;
  const canFreeReply =
    lastInboundAt && Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;

  return (
    <aside className="crm-details">
      <div className="crm-details__header">
        <span className="crm-avatar crm-avatar--large">{getInitials(contact.name)}</span>
        <div>
          <h2>{contact.name || "Lead sem nome"}</h2>
          <p>{contact.phone || "Sem telefone"}</p>
        </div>
      </div>

      <div className="crm-score-card">
        <div>
          <span>Potencial</span>
          <strong>{score}</strong>
        </div>
        <div className="crm-score-ring" style={{ "--score": `${score}%` }}>
          <span>{score}%</span>
        </div>
      </div>

      <div className="crm-window">
        <span>Janela WhatsApp</span>
        <strong>{canFreeReply ? "Resposta livre" : "Template primeiro"}</strong>
      </div>

      <section className="crm-detail-card">
        <h3>Diagnostico do aluno</h3>
        {diagnostic ? (
          <div className="crm-diagnostic">
            <span>{diagnostic.profile}</span>
            <p>{diagnostic.summary}</p>
            <dl>
              <div>
                <dt>Objetivo</dt>
                <dd>{diagnostic.objective || "-"}</dd>
              </div>
              <div>
                <dt>Fase atual</dt>
                <dd>{diagnostic.studyPhase || "-"}</dd>
              </div>
              <div>
                <dt>Area que trava</dt>
                <dd>{diagnostic.blockedArea || "-"}</dd>
              </div>
              <div>
                <dt>Interesse</dt>
                <dd>{diagnostic.interest || "-"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="crm-empty-copy">
            Quando o lead responder o quiz, a ficha de diagnostico aparece aqui.
          </p>
        )}
      </section>

      <section className="crm-detail-card">
        <h3>Proxima melhor acao</h3>
        <p className="crm-next-action">
          {diagnostic?.recommendedAction ||
            "Validar o contexto do lead, confirmar interesse e conduzir para o diagnostico."}
        </p>
      </section>

      <section className="crm-detail-card">
        <h3>Acoes rapidas</h3>
        <div className="crm-actions">
          <button disabled={!diagnostic || isBusy} onClick={onGenerateReply} type="button">
            Gerar resposta do diagnostico
          </button>
          <button disabled={isBusy} onClick={onSendTemplate} type="button">
            Enviar primeiro contato
          </button>
        </div>
      </section>
    </aside>
  );
}

export default function CrmApp() {
  const [summary, setSummary] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId),
    [conversations, selectedId],
  );

  async function loadConversations(nextSelectedId = selectedId) {
    const [nextSummary, nextConversations] = await Promise.all([
      api.getSummary(),
      api.getConversations({ status, search }),
    ]);

    setSummary(nextSummary);
    setConversations(nextConversations);

    const targetId =
      nextSelectedId ||
      selectedId ||
      nextConversations.find(Boolean)?.id ||
      "";

    if (targetId) {
      setSelectedId(targetId);
      const detail = await api.getConversation(targetId);
      setSelected(detail);
      await api.markConversationRead(targetId);
    } else {
      setSelected(null);
    }
  }

  useEffect(() => {
    loadConversations().catch((error) => setNotice(error.message));
  }, [status]);

  async function handleSearch(event) {
    event.preventDefault();
    try {
      await loadConversations("");
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function selectConversation(id) {
    setSelectedId(id);
    setNotice("");
    try {
      const detail = await api.getConversation(id);
      setSelected(detail);
      await api.markConversationRead(id);
      await loadConversations(id);
    } catch (error) {
      setNotice(error.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedId || !text) {
      return;
    }

    setIsBusy(true);
    setNotice("");
    try {
      await api.sendMessage(selectedId, text);
      setDraft("");
      await selectConversation(selectedId);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function generateReply() {
    if (!selectedId) {
      return;
    }

    setIsBusy(true);
    setNotice("");
    try {
      const result = await api.generateDiagnosticReply(selectedId);
      setDraft(result.text);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function sendTemplate() {
    if (!selectedId) {
      return;
    }

    setIsBusy(true);
    setNotice("");
    try {
      await api.sendFirstContact(selectedId);
      await selectConversation(selectedId);
      setNotice("Primeiro contato enviado pelo template configurado.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function createMockInbound() {
    setIsBusy(true);
    setNotice("");
    try {
      const result = await api.mockInbound({
        name: "Lead Teste",
        phone: "11999999999",
        text: "Oi, quero receber meu diagnostico.",
      });
      await loadConversations(result.conversation.id);
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  async function seedDemoData() {
    setIsBusy(true);
    setNotice("");
    try {
      const created = [];
      for (const diagnostic of DEMO_DIAGNOSTICS) {
        created.push(await api.createDiagnostic(diagnostic));
      }
      await api.mockInbound({
        name: "Julia Andrade",
        phone: "11988776655",
        text: "Oi, terminei o quiz e queria entender meu diagnostico.",
      });
      await loadConversations(created[0]?.conversation?.id || "");
      setNotice("Modo demo carregado com leads, diagnosticos e conversa.");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="crm-shell">
      <div className="crm-bg-grid" aria-hidden="true" />

      <header className="crm-topbar">
        <div className="crm-brand">
          <BrandMark />
          <div>
            <p>CRM DUDA FARAGE</p>
            <h1>Atendimento premium para diagnosticos</h1>
          </div>
        </div>
        <div className="crm-topbar__actions">
          <span className="crm-mode">
            {getWhatsAppModeLabel(summary?.whatsappMode)}
            {summary?.leadAgentEnabled ? " + agente" : ""}
          </span>
          <button disabled={isBusy} onClick={seedDemoData} type="button">
            Modo demo
          </button>
        </div>
      </header>

      <Dashboard
        conversations={conversations}
        isBusy={isBusy}
        onSeedDemo={seedDemoData}
        summary={summary}
      />

      {notice && <p className="crm-notice">{notice}</p>}

      <section className="crm-workspace">
        <aside className="crm-sidebar">
          <div className="crm-sidebar__title">
            <div>
              <p>Inbox</p>
              <h2>Conversas</h2>
            </div>
            <button disabled={isBusy} onClick={createMockInbound} type="button">
              Teste
            </button>
          </div>

          <form className="crm-search" onSubmit={handleSearch}>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nome, telefone ou perfil"
              value={search}
            />
            <button type="submit">Buscar</button>
          </form>

          <div className="crm-tabs">
            {STATUSES.map((item) => (
              <button
                className={status === item.value ? "crm-tab--active" : ""}
                key={item.value}
                onClick={() => setStatus(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="crm-list">
            {conversations.map((conversation) => (
              <ConversationItem
                conversation={conversation}
                isActive={conversation.id === selectedId}
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
              />
            ))}

            {!conversations.length && (
              <div className="crm-empty">
                <strong>Nenhuma conversa real ainda</strong>
                <p>Popule o modo demo ou envie um formulario pelo quiz.</p>
                <button disabled={isBusy} onClick={seedDemoData} type="button">
                  Popular demo
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="crm-chat">
          {selected ? (
            <>
              <div className="crm-chat__header">
                <div className="crm-chat__identity">
                  <span className="crm-avatar">{getInitials(selected.contact?.name)}</span>
                  <div>
                    <h2>{selected.contact?.name}</h2>
                    <p>{selected.contact?.phone}</p>
                  </div>
                </div>
                <select
                  onChange={async (event) => {
                    await api.updateConversation(selected.id, {
                      status: event.target.value,
                    });
                    await loadConversations(selected.id);
                  }}
                  value={selectedConversation?.status || selected.status}
                >
                  <option value="open">Aberta</option>
                  <option value="pending">Pendente</option>
                  <option value="closed">Fechada</option>
                </select>
              </div>

              <div className="crm-messages">
                {selected.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>

              <div className="crm-quick-replies">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => setDraft(reply)}
                    type="button"
                  >
                    {reply}
                  </button>
                ))}
              </div>

              <form className="crm-composer" onSubmit={sendMessage}>
                <textarea
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Escreva uma resposta elegante e objetiva para o WhatsApp"
                  rows={4}
                  value={draft}
                />
                <button disabled={isBusy || !draft.trim()} type="submit">
                  Enviar
                </button>
              </form>
            </>
          ) : (
            <div className="crm-chat-empty">
              <BrandMark />
              <h2>Selecione uma conversa</h2>
              <p>Leads do quiz e mensagens recebidas pelo webhook aparecem aqui.</p>
              <button disabled={isBusy} onClick={seedDemoData} type="button">
                Ativar modo demo
              </button>
            </div>
          )}
        </section>

        <DiagnosticPanel
          conversation={selected}
          isBusy={isBusy}
          onGenerateReply={generateReply}
          onSendTemplate={sendTemplate}
        />
      </section>
    </main>
  );
}
