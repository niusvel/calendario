import assert from "node:assert/strict";
import test from "node:test";
import { packLanes } from "./lanes.js";

const lanes = (items) => packLanes(items).map((item) => item.lane);

test("dos barras que no se solapan comparten carril", () => {
  assert.deepEqual(lanes([{ startCol: 0, endCol: 1 }, { startCol: 3, endCol: 4 }]), [0, 0]);
});

test("las barras solapadas bajan de carril", () => {
  assert.deepEqual(lanes([{ startCol: 0, endCol: 4 }, { startCol: 2, endCol: 6 }]), [0, 1]);
});

test("una barra contigua no reutiliza el carril de la anterior", () => {
  assert.deepEqual(lanes([{ startCol: 0, endCol: 2 }, { startCol: 2, endCol: 4 }]), [0, 1]);
});

test("el reparto no depende del orden de entrada y reutiliza carriles libres", () => {
  // Ordenadas por inicio: [0-1] carril 0, [0-4] carril 1 y [3-5] vuelve al 0,
  // que ya quedo libre en la columna 3.
  const shuffled = [{ startCol: 3, endCol: 5 }, { startCol: 0, endCol: 1 }, { startCol: 0, endCol: 4 }];
  const ordered = [{ startCol: 0, endCol: 1 }, { startCol: 0, endCol: 4 }, { startCol: 3, endCol: 5 }];
  assert.deepEqual(lanes(shuffled), [0, 1, 0]);
  assert.deepEqual(lanes(shuffled), lanes(ordered));
});
