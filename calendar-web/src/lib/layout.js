// Las barras de varios dias se posicionan en pixeles absolutos, pero sus alturas
// se declaran en rem. Leer la raiz mantiene ambas cosas sincronizadas si cambia
// la escala tipografica con el ancho del monitor.
export function rootRem() {
  return parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}
