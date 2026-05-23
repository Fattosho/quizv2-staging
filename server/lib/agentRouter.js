export function normalizeAgentOutput(output) {
  if (!output) {
    return {
      messages: [],
      handoff: false,
      leadStage: "novo",
      urgency: "baixa",
      intent: "duvida_geral",
      audioAllowed: false,
      collectedData: {},
    };
  }

  const messages = Array.isArray(output.messages)
    ? output.messages.map((message) => ({
        type: message.type || "text",
        body: message.body || message.content || "",
      }))
    : [];

  return {
    messages,
    handoff: Boolean(output.handoff),
    leadStage: output.leadStage || "qualificacao",
    urgency: output.urgency || "baixa",
    intent: output.intent || "duvida_geral",
    audioAllowed: Boolean(output.audioAllowed),
    collectedData: output.collectedData || {},
  };
}
