import { useEffect, useState } from "react";
import { pauseKiosk } from "../lib/api.js";
import { createDoubleQHandler } from "../lib/kiosk.js";

export default function KioskShortcut() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let busy = false;
    let mounted = true;
    const onKey = createDoubleQHandler(async () => {
      if (busy) return;
      busy = true;
      setNotice({ text: "Solicitando pausa…", error: false });
      try {
        await pauseKiosk();
        if (mounted) setNotice({ text: "Pausa de 30 minutos. El calendario se cerrará en unos segundos.", error: false });
      } catch {
        busy = false;
        if (mounted) setNotice({ text: "No se pudo pausar el calendario. Pulsa Q dos veces para reintentar.", error: true });
      }
    });
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onKey);
    return () => {
      mounted = false;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onKey);
    };
  }, []);

  return notice && <div className="kiosk-notice" role={notice.error ? "alert" : "status"}>{notice.text}</div>;
}
