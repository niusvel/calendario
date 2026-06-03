// Acceso al backend (FastAPI). Base configurable via VITE_API_BASE.
// Por defecto apunta al backend local en el mismo Mac.

export const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Descarga eventos en [from, to] (objetos Date). Lanza si la respuesta no es OK.
export async function fetchEvents(from, to) {
  const url = `${API_BASE}/events?from=${ymd(from)}&to=${ymd(to)}`;
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}
