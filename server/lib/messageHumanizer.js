const EMOJI_PATTERN =
  /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

function normalizeForMatch(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function cleanTextForSpeech(text = "") {
  return String(text)
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, "")
    .replace(EMOJI_PATTERN, "")
    .replace(/\bDr\./gi, "Doutor")
    .replace(/\bDra\./gi, "Doutora")
    .replace(/\bCRM\b/g, "C R M")
    .replace(/\bRQE\b/g, "R Q E")
    .replace(/https?:\/\/\S+/gi, "o link que te enviei por texto")
    .replace(/[{}[\]"<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasImportantWrittenData(text = "") {
  const value = String(text);
  const normalized = normalizeForMatch(value);

  return [
    /R\$\s?\d/i.test(value),
    /\b\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?\b/.test(value),
    /\b\d{1,2}h(\d{2})?\b/i.test(value),
    /\b\d{1,2}:\d{2}\b/.test(value),
    /https?:\/\//i.test(value),
    /\b(endereco|rua|avenida|av\.|bairro|cep)\b/i.test(normalized),
    /\b(valor|preco|pix|boleto|cartao|parcel)\b/i.test(normalized),
    /\b(matricula|contrato|checkout|link)\b/i.test(normalized),
  ].some(Boolean);
}

export function estimateSpeechDurationSeconds(text = "") {
  const words = cleanTextForSpeech(text).split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 2.45);
}
