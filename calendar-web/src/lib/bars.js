import { useLayoutEffect, useState } from "react";
import { rootRem } from "./layout.js";

// Las barras de varios dias se dibujan sobre la rejilla, no dentro de una celda,
// asi que su posicion se mide de las celdas reales: asi abarcan tambien los
// huecos entre ellas. Se recalcula al cambiar el reparto o el tamano.
export function useBarPositions({ gridRef, cellRefs, rows, columns, headRem, laneRem, layoutKey }) {
  const [positions, setPositions] = useState({});
  useLayoutEffect(() => {
    const measure = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const gridBox = grid.getBoundingClientRect();
      const rem = rootRem();
      const next = {};
      rows.forEach((bars, rowIndex) => bars.forEach((bar) => {
        const first = cellRefs.current[rowIndex * columns + bar.startCol];
        const last = cellRefs.current[rowIndex * columns + bar.endCol];
        if (!first || !last) return;
        const a = first.getBoundingClientRect();
        const b = last.getBoundingClientRect();
        next[bar.id] = {
          left: a.left - gridBox.left,
          width: b.right - a.left,
          top: a.top - gridBox.top + rem * headRem + bar.lane * rem * laneRem,
        };
      }));
      setPositions(next);
    };
    measure();
    const observer = window.ResizeObserver ? new ResizeObserver(measure) : null;
    if (observer && gridRef.current) observer.observe(gridRef.current);
    return () => observer?.disconnect();
  }, [layoutKey]);
  return positions;
}
