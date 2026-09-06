import assert from "node:assert/strict";
import test from "node:test";
import { chip, ink, luminance } from "./colors.js";

test("la tinta contrasta con el color del calendario", () => {
  assert.equal(ink("#c9d14a"), "#1b1710");   // amarillo claro -> tinta oscura
  assert.equal(ink("#2b6cb0"), "#fffaf2");   // azul oscuro -> tinta clara
});

test("la luminancia crece del negro al blanco", () => {
  assert.ok(luminance("#000000") < luminance("#808080"));
  assert.ok(luminance("#808080") < luminance("#ffffff"));
});

test("la etiqueta usa el color como fondo solido", () => {
  assert.deepEqual(chip("#d4693a"), { background: "#d4693a", color: "#fffaf2" });
});

test("un color no valido no rompe la etiqueta", () => {
  const style = chip("rebeccapurple");
  assert.equal(style.background, "rebeccapurple");
  assert.equal(typeof style.color, "string");
  assert.equal(luminance("no-es-un-color"), 0.5);
});
