import assert from "node:assert/strict";
import { test } from "node:test";
import { createDoubleQHandler } from "./kiosk.js";
import { pauseKiosk } from "./api.js";

function shortcut() {
  let time = 0;
  let pauses = 0;
  const handler = createDoubleQHandler(() => pauses++, () => time);
  return {
    press(at, overrides = {}) {
      time = at;
      handler({ type: "keydown", key: "q", preventDefault() {}, ...overrides });
    },
    count: () => pauses,
  };
}

test("dos pulsaciones de Q en un segundo solicitan una pausa", () => {
  const keys = shortcut();
  keys.press(0);
  assert.equal(keys.count(), 0);
  keys.press(700, { key: "Q", shiftKey: true });
  assert.equal(keys.count(), 1);
  keys.press(800);
  assert.equal(keys.count(), 1);
});

test("mantener Q no dispara la pausa", () => {
  const keys = shortcut();
  keys.press(0);
  for (let time = 100; time < 900; time += 100) keys.press(time, { repeat: true });
  assert.equal(keys.count(), 0);
});

test("dos Q separadas por más de un segundo no cierran el calendario", () => {
  const keys = shortcut();
  keys.press(0);
  keys.press(1100);
  assert.equal(keys.count(), 0);
  keys.press(1300);
  assert.equal(keys.count(), 1);
});

test("perder foco, otra tecla, modificadores o escribir cancelan la secuencia", () => {
  for (const event of [
    { type: "blur" }, { key: "1" }, { ctrlKey: true }, { altKey: true },
    { metaKey: true }, { isComposing: true }, { defaultPrevented: true },
    { target: { isContentEditable: true } }, { target: { closest: () => ({}) } },
  ]) {
    const keys = shortcut();
    keys.press(0);
    keys.press(100, event);
    keys.press(200);
    assert.equal(keys.count(), 0, JSON.stringify(event));
  }
});

test("la pausa usa POST y la cabecera de control local", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => ({
    ok: true, json: async () => ({ paused: true, minutes: 30 }),
  }));
  await pauseKiosk();
  const [url, request] = fetch.mock.calls[0].arguments;
  assert.equal(url, "http://127.0.0.1:8000/kiosk/pause");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["X-Calendar-Kiosk"], "1");
});

test("un error HTTP o una respuesta inesperada no se anuncian como pausa exitosa", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503 }));
  await assert.rejects(pauseKiosk(), /HTTP 503/);
  fetch.mock.mockImplementation(async () => ({ ok: true, json: async () => ({}) }));
  await assert.rejects(pauseKiosk(), /Respuesta de pausa no válida/);
});
