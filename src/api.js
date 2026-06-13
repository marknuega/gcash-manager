/* ------------------------------------------------------------
   API client — talks to the GCash Manager server.
   Attaches the bearer token (kept in localStorage) to every call.
   Only used when config.MOCK is false; in MOCK mode the app uses
   localStorage directly (see App.jsx).
   ------------------------------------------------------------ */
const TOKEN_KEY = "gm-token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event("gm-unauthorized"));
    throw new ApiError("Session expired — please log in again", 401);
  }

  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  return data;
}

function safeJson(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b),
  patch: (p, b) => request("PATCH", p, b),
  put: (p, b) => request("PUT", p, b),
  del: (p) => request("DELETE", p),
};
