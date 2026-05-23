const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "");
const sameOriginApiBaseUrl =
  typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";

const API_BASE_URL =
  configuredApiBaseUrl ||
  (import.meta.env.DEV ? "http://localhost:8080" : sameOriginApiBaseUrl) ||
  "http://localhost:8080";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Erro na API");
  }

  return data;
}

export const api = {
  baseUrl: API_BASE_URL,
  createDiagnostic(payload) {
    return request("/api/diagnostics", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getSummary() {
    return request("/api/crm/summary");
  },
  getConversations(params = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });

    const query = searchParams.toString();
    return request(`/api/crm/conversations${query ? `?${query}` : ""}`);
  },
  getConversation(id) {
    return request(`/api/crm/conversations/${id}`);
  },
  updateConversation(id, payload) {
    return request(`/api/crm/conversations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },
  markConversationRead(id) {
    return request(`/api/crm/conversations/${id}/read`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  sendMessage(id, text) {
    return request(`/api/crm/conversations/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  },
  sendTemplate(id, payload = {}) {
    return request(`/api/crm/conversations/${id}/template`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sendFirstContact(id, payload = {}) {
    return request(`/api/crm/conversations/${id}/first-contact`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  generateDiagnosticReply(id) {
    return request(`/api/crm/conversations/${id}/generate-diagnostic-reply`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
  mockInbound(payload = {}) {
    return request("/api/crm/mock-inbound", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
