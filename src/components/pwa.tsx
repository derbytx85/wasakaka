"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Download, Share, PlusSquare } from "lucide-react";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function RegistroPWA() {
  const [eventoInstalar, setEventoInstalar] = useState<EventoInstalacion | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    // El service worker SOLO se registra en producción. En desarrollo interfiere
    // con HMR y la hidratación (toma el control de la página con skipWaiting/
    // clients.claim a mitad de sesión y sirve HTML/chunks desfasados), lo que
    // provoca desfases de hidratación (p. ej. useId/aria-controls de Radix).
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEventoInstalar(e as EventoInstalacion);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // detección iOS: no hay beforeinstallprompt, se enseña la guía de "Añadir a inicio"
    const esIOS = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const instalada = window.matchMedia("(display-mode: standalone)").matches;
    if (esIOS && !instalada && !sessionStorage.getItem("ios-aviso-dado")) {
      setTimeout(() => {
        setMostrarIOS(true);
        sessionStorage.setItem("ios-aviso-dado", "1");
      }, 4000);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const instalar = async () => {
    if (!eventoInstalar) return;
    await eventoInstalar.prompt();
    await eventoInstalar.userChoice;
    setEventoInstalar(null);
  };

  return (
    <>
      {eventoInstalar && (
        <Button
          size="sm"
          variant="outline"
          onClick={instalar}
          className="gap-1.5 rounded-full border-primary/30 bg-white/80 text-primary hover:bg-primary hover:text-white"
        >
          <Download className="size-4" />
          Instalar app
        </Button>
      )}

      <Dialog open={mostrarIOS} onOpenChange={setMostrarIOS}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">Instala Wasakaka en tu iPhone</DialogTitle>
            <DialogDescription>
              Sin ir a la App Store: agrégala a tu pantalla de inicio.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm text-foreground/80">
            <li className="flex items-center gap-3">
              <Share className="size-5 shrink-0 text-primary" />
              Toca el botón <strong>Compartir</strong> de Safari (abajo).
            </li>
            <li className="flex items-center gap-3">
              <PlusSquare className="size-5 shrink-0 text-primary" />
              Elige <strong>Añadir a la pantalla de inicio</strong>.
            </li>
            <li className="flex items-center gap-3">
              <Download className="size-5 shrink-0 text-primary" />
              Toca <strong>Añadir</strong> y listo: Wasakaka se abre como app.
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BotonInstalarFijo() {
  const [eventoInstalar, setEventoInstalar] = useState<EventoInstalacion | null>(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      const yaVio = localStorage.getItem("instalar-olvidado");
      if (!yaVio) setEventoInstalar(e as EventoInstalacion);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!eventoInstalar || oculto) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-orange-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-2xl">🍲</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Instala Wasakaka</p>
          <p className="text-xs text-muted-foreground">
            Ábrela como app desde tu pantalla de inicio. Sin tienda de aplicaciones.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              className="h-8 rounded-full bg-primary px-4 text-xs font-bold hover:bg-primary/90"
              onClick={async () => {
                await eventoInstalar.prompt();
                await eventoInstalar.userChoice;
                setEventoInstalar(null);
              }}
            >
              Instalar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs text-muted-foreground"
              onClick={() => {
                localStorage.setItem("instalar-olvidado", "1");
                setOculto(true);
              }}
            >
              Ahora no
            </Button>
          </div>
        </div>
        <button
          aria-label="Cerrar aviso"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => {
            localStorage.setItem("instalar-olvidado", "1");
            setOculto(true);
          }}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
