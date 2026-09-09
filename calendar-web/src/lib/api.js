// Acceso al backend (FastAPI). Base configurable via VITE_API_BASE.
// Por defecto apunta al backend local en el mismo Mac.

export const API_BASE = import.meta.env?.VITE_API_BASE || "http://127.0.0.1:8000";

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

// Pronostico resumido del backend. Sin lugar configurado responde 404: se
// devuelve null y la pantalla simplemente no muestra el tiempo.
export async function fetchWeather() {
  const resp = await fetch(`${API_BASE}/weather`, { cache: "no-store" });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

export async function pauseKiosk() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${API_BASE}/kiosk/pause`, {
      method: "POST",
      headers: { "X-Calendar-Kiosk": "1" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.paused !== true || data.minutes !== 30) throw new Error("Respuesta de pausa no válida");
  } finally {
    clearTimeout(timeout);
  }
}
