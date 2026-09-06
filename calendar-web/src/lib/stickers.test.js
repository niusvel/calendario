import assert from "node:assert/strict";
import test from "node:test";
import { stickerFor } from "./stickers.js";

test("reconoce el tipo de evento por el titulo, sin tildes ni mayusculas", () => {
  assert.equal(stickerFor("Cita peluquería Patxi"), "✂️");
  assert.equal(stickerFor("DENTISTA Naiara"), "🦷");
  assert.equal(stickerFor("Oftalmólogo niños"), "👓");
  assert.equal(stickerFor("Cumple Baldio"), "🎂");
  assert.equal(stickerFor("Taller Opel"), "🔧");
  assert.equal(stickerFor("Guateque Inauguración miraki"), "🎉");
});

test("las actividades de los ninos ganan a la palabra clase", () => {
  assert.equal(stickerFor("Clase de baile"), "💃");
  assert.equal(stickerFor("Clases de natación"), "🏊");
  assert.equal(stickerFor("Karate Naiara"), "🥋");
  assert.equal(stickerFor("Tutoría cole"), "🎒");
});

test("un emoji puesto a mano en iCloud manda", () => {
  assert.equal(stickerFor("Dentista 🐊"), null);
});

test("sin pista no inventa nada", () => {
  assert.equal(stickerFor("Llamar a Marta"), null);
  assert.equal(stickerFor(""), null);
});

test("la primera regla gana cuando hay varias pistas", () => {
  // "cumple" antes que "comida": el cumpleanos importa mas que el menu.
  assert.equal(stickerFor("Comida cumpleaños abuela"), "🎂");
});
