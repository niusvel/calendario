// Reparte barras de varios dias en carriles: cada barra baja al primer carril
// libre a su izquierda. Lo usan por igual la semana, el mes y las semanas
// consecutivas, que solo se diferencian en el rango que abarcan.
export function packLanes(items) {
  const laneEnds = [];
  return [...items]
    .sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol)
    .map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.startCol);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endCol;
      return { ...item, lane };
    });
}
