// Dos pulsaciones deliberadas: no activar por mantener Q, escribir o usar atajos.
export function createDoubleQHandler(onDoubleQ, now = () => performance.now()) {
  let lastPress = null;
  return (event) => {
    if (event.type === "blur") {
      lastPress = null;
      return;
    }
    if (event.repeat) return;
    if (
      event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      event.target?.isContentEditable || event.target?.closest?.("input, textarea, select") ||
      event.key?.toLowerCase() !== "q"
    ) {
      lastPress = null;
      return;
    }
    const timestamp = now();
    event.preventDefault();
    if (lastPress !== null && timestamp - lastPress <= 1000) {
      lastPress = null;
      onDoubleQ();
    } else {
      lastPress = timestamp;
    }
  };
}
