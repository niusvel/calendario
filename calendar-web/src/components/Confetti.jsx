import { useEffect, useRef, useState } from "react";

// Overlay de confeti para los cumpleanos del dia. Se monta siempre, pero solo
// "llueve" cuando recibe colores (= hay al menos un cumpleanos hoy). Lanza una
// rafada inmediata y luego una cada BURST_MS, sea cual sea la vista activa, por
// estar fijado a pantalla completa con pointer-events: none (no bloquea nada).

const PIECE_COUNT = 70;        // piezas por rafada (moderado para el Mac mini 2014)
const BURST_MS = 10_000;       // cada cuanto cae una rafada
const FALL_MAX_MS = 5_000;     // vida maxima de una pieza -> limpia el DOM entre rafadas

// Paleta festiva base; se mezcla con los colores reales de los cumpleanos del dia.
const FESTIVE = ["#FEF781", "#F09343", "#E8A7BF", "#86B953", "#9068F6", "#78D3F8", "#FF5D6C", "#FFFFFF"];

// Genera las piezas de una rafada con parametros aleatorios por pieza.
function buildPieces(colors, burstId) {
  const palette = colors && colors.length ? [...new Set([...colors, ...FESTIVE])] : FESTIVE;
  return Array.from({ length: PIECE_COUNT }, (_, i) => {
    const color = palette[Math.floor(Math.random() * palette.length)];
    const left = Math.random() * 100;                            // %
    const drift = (Math.random() * 2 - 1) * 18;                  // vw, deriva lateral
    const turns = 2 + Math.floor(Math.random() * 4);            // vueltas
    const spin = 360 * turns * (Math.random() < 0.5 ? -1 : 1);   // deg (sentido aleatorio)
    const duration = 2800 + Math.random() * 1700;               // ms
    const delay = Math.random() * 700;                          // ms (rafada escalonada)
    const size = 7 + Math.random() * 7;                         // px
    const round = Math.random() < 0.3;                          // ~30% redondas
    return { key: `${burstId}-${i}`, color, left, drift, spin, duration, delay, size, round };
  });
}

export default function Confetti({ colors }) {
  const active = !!(colors && colors.length);
  const [pieces, setPieces] = useState([]);
  const burst = useRef(0);

  useEffect(() => {
    if (!active) {
      setPieces([]);
      return;
    }
    let clearTimer;
    const fire = () => {
      burst.current += 1;
      setPieces(buildPieces(colors, burst.current));
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => setPieces([]), FALL_MAX_MS); // retira las piezas ya caidas
    };
    fire();                                  // primera rafada inmediata
    const id = setInterval(fire, BURST_MS);  // y una cada 10s mientras haya cumpleanos
    return () => {
      clearInterval(id);
      clearTimeout(clearTimer);
    };
  }, [active, colors]);

  if (!pieces.length) return null;
  return (
    <div className="confetti-layer" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.key}
          className={`confetti-piece${p.round ? " is-round" : ""}`}
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size * 1.6}px`,
            background: p.color,
            "--drift": `${p.drift}vw`,
            "--spin": `${p.spin}deg`,
            animationDuration: `${p.duration}ms`,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  );
}
