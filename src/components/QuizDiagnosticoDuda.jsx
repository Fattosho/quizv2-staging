import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../services/api.js";

const QUIZ_THEME = {
  background: "#020A0E",
  dotColor: "#4AB89A",
  cardBorder: "#4AB89A",
  buttonBg: "#071A1D",
  buttonText: "#EFFFFA",
  text: "#EFFFFA",
  mutedText: "#A7E4D4",
  inputBg: "#071A1D",
  accent: "#4AB89A",
  cardBg: "#061214",
  danger: "#FFB4A8",
  characterIntroImage: "/images/primeira-foto-quiz.jpg",
  characterQuestionImage: "/images/segunda-foto-quiz.jpg",
};

const LEGACY_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbw2_eBFwo3XqSZB19XkCmYVrR-1GFFVLV1SLDnpUP3PMv5BQKEgGbafuJrwaKahoi4yyg/exec";

const INITIAL_ANSWERS = {
  objective: "",
  name: "",
  whatsapp: "",
  examWhen: "",
  studyPhase: "",
  blockedArea: "",
  frustration: "",
  guidedRoutine: "",
  interest: "",
  blocker: "",
};

const STEP_TWO_OBJECTIVE = {
  id: "objective",
  question: "Qual seu objetivo principal hoje?",
  options: [
    "Passar em Medicina",
    "Passar em uma universidade pública",
    "Conseguir PROUNI ou FIES",
    {
      value: "Passar em um curso concorrido",
      label: "Passar em um curso concorrido",
      description: "Ex: Engenharia, Direito, Psicologia, Odonto...",
    },
  ],
};

const STEP_THREE_GROUPS = [
  {
    id: "examWhen",
    question: "Você vai fazer o ENEM/vestibular quando?",
    options: [
      "Neste ano",
      "Ano que vem",
      "Estou começando a me preparar com antecedência",
    ],
  },
  {
    id: "studyPhase",
    question: "Hoje você se sente em qual fase?",
    options: [
      "Estou começando do zero",
      "Já estudo, mas não tenho uma rotina constante",
      "Estudo bastante, mas minha nota não sobe",
      "Tenho uma base boa, mas ainda perco pontos que não deveria",
      "Me sinto sem direção e não sei o que priorizar",
    ],
  },
  {
    id: "blockedArea",
    question: "Em qual área você mais trava?",
    options: [
      "Matemática",
      "Naturezas",
      "Linguagens",
      "Humanas",
      "Redação",
      "Todas um pouco",
    ],
  },
];

const STEP_FOUR_GROUPS = [
  {
    id: "frustration",
    question: "O que mais te frustra na sua preparação?",
    options: [
      "Estudar e esquecer depois",
      "Não saber se estou evoluindo",
      "Errar questões que eu achava que sabia",
      "Começar animado e depois parar",
      "Não ter alguém me dizendo o que fazer",
    ],
  },
  {
    id: "guidedRoutine",
    question:
      "Se você tivesse um plano mais claro, você estaria disposto a seguir uma rotina guiada?",
    options: [
      "Sim, eu só preciso de direção",
      "Sim, mas tenho dificuldade com disciplina",
      "Talvez, depende de como funcionar",
      "Não sei se conseguiria seguir",
    ],
  },
  {
    id: "interest",
    question: "Você teria interesse em entrar em uma preparação guiada pela Duda?",
    options: [
      "Sim, quero muito",
      "Sim, quero entender melhor",
      "Talvez, depende do valor",
      "Ainda não sei",
      "Não tenho interesse agora",
    ],
  },
];

const VALID_BRAZIL_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const WHATSAPP_ERROR_MESSAGE =
  "Digite um WhatsApp valido com DDD. Ex: (11) 99999-9999";

function onlyDigits(value = "") {
  return String(value).replace(/\D/g, "");
}

function getBrazilWhatsappDigits(value = "") {
  const digits = onlyDigits(value);

  if (digits.startsWith("55") && digits.length === 13) {
    return digits.slice(2);
  }

  return digits.slice(0, 11);
}

function isSequentialDigits(value) {
  return (
    "01234567890123456789".includes(value) ||
    "98765432109876543210".includes(value)
  );
}

function validateWhatsapp(value = "") {
  const digits = getBrazilWhatsappDigits(value);
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const isValid =
    digits.length === 11 &&
    VALID_BRAZIL_DDDS.has(ddd) &&
    number.startsWith("9") &&
    !/^(\d)\1+$/.test(digits) &&
    !isSequentialDigits(digits);

  return {
    digits,
    isValid,
    message: isValid ? "" : WHATSAPP_ERROR_MESSAGE,
  };
}

function isValidWhatsapp(value = "") {
  return validateWhatsapp(value).isValid;
}

const STEP_VALIDATORS = [
  () => true,
  (answers) =>
    Boolean(
      answers.objective &&
        answers.name.trim() &&
        isValidWhatsapp(answers.whatsapp),
    ),
  (answers) =>
    Boolean(answers.examWhen && answers.studyPhase && answers.blockedArea),
  (answers) =>
    Boolean(answers.frustration && answers.guidedRoutine && answers.interest),
  (answers) => answers.blocker.trim().length > 2,
  () => true,
];

const ANALYZING_PHRASES = [
  "Analisando suas respostas…",
  "Identificando seu momento atual…",
  "Preparando seu próximo passo…",
];

const ANALYZING_STEPS = [
  "Respostas coletadas",
  "Perfil de estudo identificado",
  "Próximo passo definido",
];

const ANALYZING_STEP = -1;
const TOTAL_PROGRESS_STEPS = 4;
const EXIT_DURATION = 280;
const ANALYZING_MIN_DURATION = 3200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function maskWhatsapp(value) {
  const digits = getBrazilWhatsappDigits(value);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);

  if (number.length <= 4) {
    return `(${areaCode}) ${number}`;
  }

  if (number.length <= 8) {
    return `(${areaCode}) ${number.slice(0, 4)}-${number.slice(4)}`;
  }

  return `(${areaCode}) ${number.slice(0, 5)}-${number.slice(5, 9)}`;
}

function getWebhookFormData(answers) {
  return {
    nome: answers.name.trim(),
    whatsapp: answers.whatsapp,
    objetivo: answers.objective,
    quandoVaiFazer: answers.examWhen,
    faseAtual: answers.studyPhase,
    areaTrava: answers.blockedArea,
    frustracao: answers.frustration,
    rotinaGuiada: answers.guidedRoutine,
    interessePreparacao: answers.interest,
    respostaAberta: answers.blocker.trim(),
  };
}

function isSubmitPayloadValid(formData) {
  return Boolean(
    formData.nome &&
      formData.whatsapp &&
      isValidWhatsapp(formData.whatsapp) &&
      formData.respostaAberta,
  );
}

function sendLegacyWebhook(payload) {
  return fetch(LEGACY_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function RadioGroup({ group, value, onChange, compact = false }) {
  return (
    <fieldset className={`quiz-fieldset ${compact ? "quiz-fieldset--compact" : ""}`}>
      <legend>{group.question}</legend>
      <div className="quiz-options">
        {group.options.map((option, index) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          const optionDescription =
            typeof option === "string" ? "" : option.description;

          return (
            <label className="quiz-option" key={optionValue} style={{ "--i": index }}>
              <input
                checked={value === optionValue}
                name={group.id}
                onChange={() => onChange(group.id, optionValue)}
                type="radio"
                value={optionValue}
              />
              <span className="quiz-option__content">
                <span className="quiz-option__label">{optionLabel}</span>
                {optionDescription && (
                  <small className="quiz-option__description">
                    {optionDescription}
                  </small>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function QuizButton({ children, disabled = false, onClick, type = "button" }) {
  return (
    <button
      className="quiz-button"
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function ProgressBar({ step, total }) {
  const percent = Math.round((step / total) * 100);

  return (
    <div className="quiz-progress">
      <span className="quiz-progress__label">
        <span>Etapa</span>
        <b>{step}</b>
        <span className="quiz-progress__sep">de</span>
        <span>{total}</span>
      </span>
      <div
        className="quiz-progress__track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Etapa ${step} de ${total}`}
      >
        <div className="quiz-progress__fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function AnalyzingScreen({ isExiting }) {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setPhraseIndex((index) => (index + 1) % ANALYZING_PHRASES.length);
        setIsFading(false);
      }, 340);
    }, 1300);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div
      className={`quiz-screen quiz-screen--analyzing${isExiting ? " quiz-screen--exit" : ""}`}
    >
      <div className="analyzing-visual" aria-hidden="true">
        <div className="analyzing-ring-outer" />
        <div className="analyzing-ring" />
        <div className="analyzing-dot" />
      </div>

      <div className="analyzing-text" aria-live="polite">
        <span className="analyzing-text__label">Processando diagnóstico</span>
        <p
          className={`analyzing-text__phrase${isFading ? " analyzing-text__phrase--fading" : ""}`}
        >
          {ANALYZING_PHRASES[phraseIndex]}
        </p>
      </div>

      <div className="analyzing-steps" aria-hidden="true">
        {ANALYZING_STEPS.map((label, index) => (
          <div className="analyzing-step" key={label} style={{ "--step-i": index }}>
            <span className="analyzing-step__check">✓</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuizDiagnosticoDuda() {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayStep, setDisplayStep] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [answers, setAnswers] = useState(INITIAL_ANSWERS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [wasWhatsappTouched, setWasWhatsappTouched] = useState(false);

  const submitLockRef = useRef(false);

  const themeVars = useMemo(
    () => ({
      "--quiz-bg": QUIZ_THEME.background,
      "--quiz-dot": QUIZ_THEME.dotColor,
      "--quiz-card-border": QUIZ_THEME.cardBorder,
      "--quiz-button-bg": QUIZ_THEME.buttonBg,
      "--quiz-button-text": QUIZ_THEME.buttonText,
      "--quiz-text": QUIZ_THEME.text,
      "--quiz-muted-text": QUIZ_THEME.mutedText,
      "--quiz-input-bg": QUIZ_THEME.inputBg,
      "--quiz-accent": QUIZ_THEME.accent,
      "--quiz-card-bg": QUIZ_THEME.cardBg,
      "--quiz-danger": QUIZ_THEME.danger,
    }),
    [],
  );

  const isCurrentStepValid =
    currentStep >= 0 && currentStep < STEP_VALIDATORS.length
      ? STEP_VALIDATORS[currentStep](answers)
      : true;
  const whatsappValidation = validateWhatsapp(answers.whatsapp);
  const showWhatsappError = Boolean(
    displayStep === 1 &&
      answers.whatsapp &&
      !whatsappValidation.isValid &&
      (wasWhatsappTouched || whatsappValidation.digits.length >= 11),
  );

  function updateAnswer(field, value) {
    setSubmitError("");
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [field]: value,
    }));
  }

  async function navigateTo(nextStep) {
    if (isExiting) {
      return;
    }

    setIsExiting(true);
    await sleep(EXIT_DURATION);

    setDisplayStep(nextStep);
    setCurrentStep(nextStep);
    setIsExiting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function goToNextStep() {
    if (isExiting || !isCurrentStepValid) {
      return;
    }

    await navigateTo(currentStep + 1);
  }

  async function handleSubmitQuiz() {
    if (submitLockRef.current || isExiting) {
      return;
    }

    const formData = getWebhookFormData(answers);

    if (!isCurrentStepValid || !isSubmitPayloadValid(formData)) {
      setSubmitError(
        !isValidWhatsapp(formData.whatsapp)
          ? WHATSAPP_ERROR_MESSAGE
          : "Não conseguimos enviar agora. Tente novamente em alguns segundos.",
      );
      return;
    }

    const payload = {
      nome: formData.nome,
      whatsapp: formData.whatsapp,
      objetivo: formData.objetivo,
      quandoVaiFazer: formData.quandoVaiFazer,
      faseAtual: formData.faseAtual,
      areaTrava: formData.areaTrava,
      frustracao: formData.frustracao,
      rotinaGuiada: formData.rotinaGuiada,
      interessePreparacao: formData.interessePreparacao,
      respostaAberta: formData.respostaAberta,
      createdAt: new Date().toISOString(),
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
    };

    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError("");

    // Sai da tela 4 com animação antes de mostrar a análise.
    setIsExiting(true);
    await sleep(EXIT_DURATION);

    setDisplayStep(ANALYZING_STEP);
    setCurrentStep(ANALYZING_STEP);
    setIsExiting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Envio real + tempo mínimo de exibição da tela de análise em paralelo.
    const submitRequest = api
      .createDiagnostic(payload)
      .then((result) => {
        const sheetsForwardConfirmed =
          result?.sheetsForward && !result?.sheetsForwardError;

        if (!sheetsForwardConfirmed) {
          console.warn(
            "Google Sheets nao confirmou o recebimento pelo backend; acionando envio pelo navegador.",
            result?.sheetsForwardError || null,
          );
          return sendLegacyWebhook(payload)
            .catch((legacyError) => {
              console.error("Erro ao enviar diagnostico para a planilha", legacyError);
            })
            .then(() => result);
        }

        return result;
      })
      .catch((error) => {
        console.error("Erro ao enviar diagnostico para o CRM", error);
        return sendLegacyWebhook(payload).catch((legacyError) => {
          console.error("Erro ao enviar diagnostico", legacyError);
        });
      });

    await Promise.allSettled([submitRequest, sleep(ANALYZING_MIN_DURATION)]);

    console.log("Quiz Diagnóstico Duda", payload);

    // Sai da tela de análise com animação e entra na tela de sucesso.
    setIsExiting(true);
    await sleep(EXIT_DURATION);

    setDisplayStep(5);
    setCurrentStep(5);
    setIsExiting(false);
    setIsSubmitting(false);
    submitLockRef.current = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isDense = displayStep === 2 || displayStep === 3;
  const showProgress = displayStep >= 1 && displayStep <= 4;
  const exitClass = isExiting ? " quiz-screen--exit" : "";

  return (
    <main className="quiz-page" style={themeVars}>
      <div className="quiz-bg-orb quiz-bg-orb--1" aria-hidden="true" />
      <div className="quiz-bg-orb quiz-bg-orb--2" aria-hidden="true" />
      <div className="quiz-bg-orb quiz-bg-orb--3" aria-hidden="true" />

      <section
        className={`quiz-card ${isDense ? "quiz-card--dense" : ""}`}
        aria-live="polite"
      >
        {showProgress && (
          <ProgressBar step={displayStep} total={TOTAL_PROGRESS_STEPS} />
        )}

        {displayStep === 0 && (
          <div key={0} className={`quiz-screen quiz-screen--intro${exitClass}`}>
            <div className="intro-visual" aria-hidden="true">
              <img
                alt=""
                className="intro-character"
                src={QUIZ_THEME.characterIntroImage}
              />
            </div>

            <div className="intro-copy">
              <p className="quiz-kicker">Diagnóstico personalizado</p>
              <h1>
                <span>Não sabe por onde começar?</span>
                <span>Já estuda, mas continua travando?</span>
                <strong>Ou está a poucos pontos da aprovação?</strong>
              </h1>
              <p>
                Descubra o seu momento atual e receba uma análise completa,
                pensada por mim, para o seu próximo passo.
              </p>
            </div>

            <QuizButton onClick={goToNextStep}>Ver meu diagnóstico</QuizButton>
          </div>
        )}

        {displayStep === 1 && (
          <div key={1} className={`quiz-screen quiz-screen--form${exitClass}`}>
            <RadioGroup
              group={STEP_TWO_OBJECTIVE}
              onChange={updateAnswer}
              value={answers.objective}
            />

            <label className="quiz-input-group">
              <span>Qual seu nome?</span>
              <input
                autoComplete="name"
                onChange={(event) => updateAnswer("name", event.target.value)}
                placeholder="Seu nome completo"
                type="text"
                value={answers.name}
              />
            </label>

            <label className="quiz-input-group">
              <span>Qual seu WhatsApp?</span>
              <input
                aria-describedby={showWhatsappError ? "whatsapp-error" : undefined}
                aria-invalid={showWhatsappError}
                autoComplete="tel"
                inputMode="tel"
                onChange={(event) =>
                  updateAnswer("whatsapp", maskWhatsapp(event.target.value))
                }
                onBlur={() => setWasWhatsappTouched(true)}
                placeholder="(00) 00000-0000"
                type="tel"
                value={answers.whatsapp}
              />
            </label>

            {showWhatsappError && (
              <p className="quiz-field-error" id="whatsapp-error" role="alert">
                {whatsappValidation.message}
              </p>
            )}

            <p className="quiz-hint">
              É por aqui que nossa equipe vai te enviar o diagnóstico
            </p>

            <QuizButton disabled={!isCurrentStepValid} onClick={goToNextStep}>
              Continuar
            </QuizButton>
          </div>
        )}

        {displayStep === 2 && (
          <div
            key={2}
            className={`quiz-screen quiz-screen--questions${exitClass}`}
          >
            {STEP_THREE_GROUPS.map((group) => (
              <RadioGroup
                compact
                group={group}
                key={group.id}
                onChange={updateAnswer}
                value={answers[group.id]}
              />
            ))}

            <QuizButton disabled={!isCurrentStepValid} onClick={goToNextStep}>
              Continuar
            </QuizButton>
          </div>
        )}

        {displayStep === 3 && (
          <div
            key={3}
            className={`quiz-screen quiz-screen--questions${exitClass}`}
          >
            {STEP_FOUR_GROUPS.map((group) => (
              <RadioGroup
                compact
                group={group}
                key={group.id}
                onChange={updateAnswer}
                value={answers[group.id]}
              />
            ))}

            <QuizButton disabled={!isCurrentStepValid} onClick={goToNextStep}>
              Continuar
            </QuizButton>
          </div>
        )}

        {displayStep === 4 && (
          <div key={4} className={`quiz-screen quiz-screen--open${exitClass}`}>
            <img
              alt=""
              className="professional-character"
              src={QUIZ_THEME.characterQuestionImage}
            />

            <label className="open-question">
              <span className="open-question__lead">
                Antes de eu te mostrar o próximo passo,
              </span>
              <strong>me conta onde você sente que está hoje.</strong>
              <textarea
                onChange={(event) => updateAnswer("blocker", event.target.value)}
                placeholder="Ex: começando do zero, travando nos estudos, sem direção, ou por pouco da aprovação"
                rows={4}
                value={answers.blocker}
              />
            </label>

            {submitError && (
              <p className="quiz-submit-error" role="alert">
                {submitError}
              </p>
            )}

            <QuizButton
              disabled={!isCurrentStepValid || isSubmitting}
              onClick={handleSubmitQuiz}
            >
              {isSubmitting ? "Enviando…" : "Receber meu diagnóstico"}
            </QuizButton>
          </div>
        )}

        {displayStep === ANALYZING_STEP && (
          <AnalyzingScreen key="analyzing" isExiting={isExiting} />
        )}

        {displayStep === 5 && (
          <div
            key={5}
            className={`quiz-screen quiz-screen--success${exitClass}`}
          >
            <div className="success-check" aria-hidden="true">
              <span />
            </div>

            <h1>
              <span>Diagnóstico recebido</span>
              <strong>com sucesso.</strong>
            </h1>

            <div className="success-copy">
              <p>
                Nossa equipe vai analisar suas respostas e te chamar no
                <strong> WhatsApp</strong> com uma orientação sobre o seu próximo
                passo para acessar o método da Duda.
              </p>
              <div className="success-notice">
                <strong>Fique de olho:</strong> as condições de acesso antecipado
                serão liberadas primeiro para quem respondeu o diagnóstico.
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
