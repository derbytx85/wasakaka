"use client";

import { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import { Moon, Sun } from "lucide-react";
import { useWasakaka, type RolActivo } from "@/store/wasakaka";
import { RegistroPWA, BotonInstalarFijo } from "@/components/pwa";
import { VistaCliente } from "@/components/cliente/vista-inicio";
import { VistaCarrito } from "@/components/cliente/vista-carrito";
import { VistaPedidos } from "@/components/cliente/vista-pedidos";
import { VistaCocinera } from "@/components/cocinera/vista-cocinera";
import { VistaAdmin } from "@/components/admin/vista-admin";
import { CambiarRol } from "@/components/cambiar-rol";
import { NavCliente } from "@/components/cliente/nav-cliente";
import { Bell, BellRing } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TITULOS: Record<RolActivo, string> = {
  cliente: "Comida casera de tu barrio",
  cocinera: "Mi cocina",
  admin: "Panel de la familia",
};

// Anchos según el rol (RF-U): cliente móvil primero; cocinera gana aire desde
// pantallas medianas; el panel de administración es de computador.
function anchoPorRol(rol: RolActivo): string {
  if (rol === "admin") return "max-w-3xl md:max-w-7xl";
  if (rol === "cocinera") return "max-w-3xl md:max-w-5xl";
  return "max-w-3xl";
}

/** Interruptor de modo oscuro: alterna la clase `dark` y la recuerda. */
// La clase del <html> es estado externo a React: se lee con useSyncExternalStore
// (sin setState dentro de efectos y sin desajustes de hidratación).
const oyentesTema = new Set<() => void>();
const suscribirTema = (cb: () => void) => {
  oyentesTema.add(cb);
  return () => {
    oyentesTema.delete(cb);
  };
};

function InterruptorTema() {
  const oscuro = useSyncExternalStore(
    suscribirTema,
    () => document.documentElement.classList.contains("dark"),
    () => false
  );

  const alternar = () => {
    const nuevo = !oscuro;
    document.documentElement.classList.toggle("dark", nuevo);
    try {
      localStorage.setItem("wasakaka-tema", nuevo ? "dark" : "light");
    } catch {
      /* almacenamiento no disponible */
    }
    oyentesTema.forEach((l) => l());
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label={oscuro ? "Activar modo claro" : "Activar modo oscuro"}
      aria-pressed={oscuro}
      className="size-10 rounded-full text-primary hover:bg-accent"
      onClick={alternar}
    >
      {oscuro ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}

export function AppShell() {
  const {
    rolActivo,
    notificaciones,
    setIdentidades,
    setDemoMode,
    avisar,
  } = useWasakaka();
  const demoMode = useWasakaka((s) => s.demoMode);

  // cargar identidades demo + restaurar la sesión guardada (rol activo).
  // Sin DEMO_MODE=1 el endpoint responde 404 y la app corre sin cambiador.
  useEffect(() => {
    useWasakaka.persist.rehydrate();
    // tema guardado
    try {
      if (localStorage.getItem("wasakaka-tema") === "dark") {
        document.documentElement.classList.add("dark");
      }
    } catch {
      /* almacenamiento no disponible */
    }
    fetch("/api/demo/identidades")
      .then((r) => {
        if (!r.ok) {
          setDemoMode(false);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d) {
          setDemoMode(true);
          setIdentidades(d);
        }
      })
      .catch(() => {
        setDemoMode(false);
      });
  }, []);

  const ancho = anchoPorRol(rolActivo);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-orange-100 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className={`mx-auto flex w-full ${ancho} items-center gap-2 px-4 py-3`}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Image
              src="/logo.svg"
              alt="Logotipo de Wasakaka"
              width={36}
              height={36}
              className="size-9 shrink-0"
              priority
            />
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-primary">
                Wasakaka
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {TITULOS[rolActivo]}
              </p>
            </div>
          </div>
          <RegistroPWA />
          <InterruptorTema />
          <HojaNotificaciones notificaciones={notificaciones} />
        </div>
        {demoMode && (
          <div className={`mx-auto w-full ${ancho} px-4 pb-2`}>
            <CambiarRol />
          </div>
        )}
      </header>

      <main className={`mx-auto w-full ${ancho} flex-1 px-4 pb-28 pt-4`}>
        {rolActivo === "cliente" && <ContenidoCliente />}
        {rolActivo === "cocinera" && <VistaCocinera />}
        {rolActivo === "admin" && <VistaAdmin />}
      </main>

      {rolActivo === "cliente" && <NavCliente />}

      <footer
        className={`mt-auto border-t border-orange-100 bg-card pb-[env(safe-area-inset-bottom)] ${
          rolActivo === "cliente" ? "mb-[63px]" : ""
        }`}
      >
        <div className={`mx-auto w-full ${ancho} px-4 py-3 text-center text-xs text-muted-foreground`}>
          Hecho en cocinas caseras bajo la ley SB 541 de Texas · Fort Worth, TX ·
          Español primero
        </div>
      </footer>

      <BotonInstalarFijo />
    </div>
  );
}

function ContenidoCliente() {
  const vista = useWasakaka((s) => s.vistaCliente);
  if (vista === "carrito") return <VistaCarrito />;
  if (vista === "pedidos") return <VistaPedidos />;
  return <VistaCliente />;
}

function HojaNotificaciones({
  notificaciones,
}: {
  notificaciones: { id: string; texto: string; canal: string; hora: string }[];
}) {
  const sinLeer = notificaciones.length;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          aria-label="Notificaciones"
          className="flex size-10 items-center justify-center rounded-full text-primary hover:bg-accent"
        >
          {sinLeer > 0 ? <BellRing className="size-5" /> : <Bell className="size-5" />}
          {sinLeer > 0 && (
            <span className="absolute translate-x-4 -translate-y-4 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 rounded-l-2xl p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-primary">Avisos</SheetTitle>
        </SheetHeader>
        <div className="scroll-lindo max-h-[70vh] overflow-y-auto p-4">
          {notificaciones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay avisos. Aquí llegarán los cambios de tus pedidos, «En la
              app» (el canal de WhatsApp se integra más adelante).
            </p>
          ) : (
            <ul className="space-y-3">
              {notificaciones.map((n) => (
                <li key={n.id} className="rounded-xl bg-secondary p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={n.canal === "whatsapp" ? "bg-green-600/15 text-green-700" : ""}
                    >
                      {n.canal === "whatsapp" ? "WhatsApp (demo)" : "En la app"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(n.hora).toLocaleTimeString("es-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm">{n.texto}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
