// Color de los eventos. La pantalla se lee a dos o tres metros: los rellenos
// translucidos se apagaban contra el fondo, asi que las etiquetas van en color
// solido y la tinta se elige por contraste, como un rotulador sobre papel.

const HEX = /^#[0-9a-fA-F]{6}$/;

const INK_DARK = "#1b1710";
const INK_LIGHT = "#fffaf2";

// Luminancia relativa (WCAG). Decide si el titulo va en tinta oscura o clara.
export function luminance(hex) {
  if (!HEX.test(hex)) return 0.5;
  const channel = (offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function ink(hex) {
  return luminance(hex) > 0.45 ? INK_DARK : INK_LIGHT;
}

// Etiqueta solida de evento: el color del calendario es el fondo.
export function chip(hex) {
  if (!HEX.test(hex)) return { background: hex, color: INK_LIGHT };
  return { background: hex, color: ink(hex) };
}
