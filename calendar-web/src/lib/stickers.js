// Pegatinas: un icono por tipo de evento, deducido del titulo. En la pared un
// dibujo se reconoce a cuatro metros donde la palabra ya no se lee, y es lo que
// mas se echaba de menos del calendario de papel. Para anadir o cambiar uno basta
// con tocar esta lista: la primera regla que coincide gana. Si el titulo ya trae
// un emoji, se respeta y no se anade otro.
export const STICKERS = [
  ["🎂", ["cumple", "cumpleaños", "aniversario", "urtebetetze"]],
  ["✂️", ["peluquer", "pelu ", "corte de pelo", "barber", "ile apain"]],
  ["🦷", ["dentista", "dental", "ortodoncia", "hortz"]],
  ["👓", ["oftalm", "oculista", "optica", "óptica", "gafas"]],
  ["🩺", ["medic", "médic", "doctor", "pediatr", "consulta", "hospital", "ambulatorio", "osakidetza", "analitica", "analítica", "vacuna", "fisio", "revision", "revisión"]],
  ["🐾", ["veterinar", "perro", "gato"]],
  ["🔧", ["taller", "mecanic", "mecánic", "itv", "coche", "furgo"]],
  ["✈️", ["vuelo", "avion", "avión", "aeropuerto", "viaje", "hotel", "bidaia"]],
  ["🚆", ["tren", "renfe", "euskotren", "autobus", "autobús"]],
  ["🏖️", ["vacaciones", "oporrak", "playa"]],
  ["🎒", ["cole", "colegio", "escuela", "ikastola", "instituto", "clase", "tutoria", "tutoría", "extraescolar", "excursion", "excursión"]],
  ["🎉", ["fiesta", "guateque", "inauguracion", "inauguración", "celebracion", "celebración", "jaia", "despedida"]],
  ["🍽️", ["cena", "comida", "restaurante", "almuerzo", "brunch", "txoko", "sociedad"]],
  ["💍", ["boda", "ezkontza", "bautizo", "comunion", "comunión"]],
  ["⚽", ["futbol", "fútbol", "partido", "entreno", "entrenamiento"]],
  ["🏊", ["piscina", "natacion", "natación", "igerileku"]],
  ["🏋️", ["gimnasio", "gym", "crossfit", "pilates", "yoga"]],
  ["🎭", ["teatro", "concierto", "cine", "musical", "antzoki"]],
  ["🛒", ["compra", "mercado", "super", "ikea"]],
  ["📄", ["banco", "notario", "notaría", "gestoria", "gestoría", "hacienda", "ayuntamiento", "udal", "tramite", "trámite", "firma"]],
  ["🎄", ["navidad", "nochebuena", "eguberri", "olentzero"]],
  ["👑", ["reyes"]],
];

const HAS_EMOJI = /\p{Extended_Pictographic}/u;

function plain(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function stickerFor(title) {
  if (!title || HAS_EMOJI.test(title)) return null;
  const text = plain(title);
  for (const [emoji, words] of STICKERS) {
    if (words.some((word) => text.includes(plain(word)))) return emoji;
  }
  return null;
}
