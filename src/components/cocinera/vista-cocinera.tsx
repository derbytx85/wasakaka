"use client";

import { useCallback, useEffect, useState } from "react";
import { useWasakaka } from "@/store/wasakaka";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PanelHoy } from "@/components/cocinera/panel-hoy";
import { PanelMenu } from "@/components/cocinera/panel-menu";
import { PanelAgenda } from "@/components/cocinera/panel-agenda";
import { PanelNumeros } from "@/components/cocinera/panel-numeros";
import { WizardHabilitacion } from "@/components/cocinera/wizard-habilitacion";
import { toast } from "@/hooks/use-toast";
import { CalendarDays, LayoutDashboard, ListOrdered, PiggyBank, RefreshCw } from "lucide-react";

export interface CocineraPanel {
  cocinera: {
    id: string;
    nombre: string;
    estado: string;
    motivoEstado: string | null;
    plan: string;
    vendeTcs: boolean;
    numeroDshs: string | null;
    zona: string | null;
    comisionPct: number;
    aceptaEfectivo: boolean;
    // promoción fundadora (RF-P04): 0% de comisión por 6 meses o hasta US$400/mes
    promocionFundadora: boolean;
    promoHasta: string | null;
    avisoSalidaPromo: boolean;
    diasParaFinPromo: number | null;
  };
  tarjeta: { nivel: string; diasRestantes: number | null; vence: string | null };
  topeLegal: {
    ventasPlataforma: number;
    ventasFuera: number;
    ventasAnioActual: number;
    tope: number;
    porcentaje: number;
    nivel: string;
  };
  suscripcion: { activa: boolean; cuotaMensual: number; estado: string | null; proximoCobro: string | null };
  platos: {
    id: string;
    nombre: string;
    descripcion: string;
    precio: number;
    categoria: string;
    esTcs: boolean;
    ingredientes: string;
    alergenos: string[];
    fotoUrl: string | null;
    activo: boolean;
    loteRequerido: boolean;
  }[];
  agendas: { id: string; fecha: string; horaCorte: string; capacidadPedidos: number; activa: boolean }[];
  pedidos: {
    id: string;
    estado: string;
    tipoEntrega: string;
    metodoPago: string;
    direccionEntrega: string;
    subtotal: number;
    comision: number;
    netoCocinera: number;
    total: number;
    codigoCierre: string;
    fechaEntrega: string | null;
    fecha: string;
    cliente: { nombre: string; telefono: string | null };
    items: { id: string; nombrePlato: string; cantidad: number; precioUnitario: number }[];
    entrega: { horaSalida: string | null } | null;
    calificacion: { estrellas: number; comentario: string | null; respuestaCocinera?: string | null } | null;
  }[];
  numeros: {
    ventasHoy: number;
    ventasSemana: number;
    ventasMes: number;
    pedidosHoy: number;
    comisionesPagadasSemana: number;
    pedidosActivos: number;
  };
}

export function VistaCocinera() {
  const { cocineraId, vistaCocinera, setVistaCocinera, avisar } = useWasakaka();
  const [panel, setPanel] = useState<CocineraPanel | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    if (!cocineraId) return;
    setCargando(true);
    try {
      const r = await fetch(`/api/cocineras/${cocineraId}/panel`);
      if (r.ok) setPanel(await r.json());
      else setPanel(null);
    } catch {
      setPanel(null);
    } finally {
      setCargando(false);
    }
  }, [cocineraId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!cocineraId) {
    return <SinCuenta />;
  }

  if (cargando && !panel) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Preparando tu cocina…</p>;
  }

  if (!panel) {
    return (
      <div className="rounded-3xl border border-dashed p-8 text-center">
        <p className="font-bold">No pudimos cargar tu panel</p>
        <Button variant="outline" className="mt-3 rounded-full" onClick={cargar}>
          <RefreshCw className="size-4" /> Reintentar
        </Button>
      </div>
    );
  }

  const c = panel.cocinera;

  // Cuenta pendiente de aprobación (RF-C01): estado claro y sin acceso a venta
  if (c.estado === "pendiente") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-4xl">⏳</p>
          <h1 className="mt-2 font-display text-xl font-bold text-amber-800">
            Tu solicitud está en revisión
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-amber-800/80">
            La familia Wasakaka está revisando tus documentos. Te avisamos en
            la aplicación apenas te aprueben (normalmente en menos de 24 horas).
          </p>
          <Badge className="mt-3 bg-amber-200 text-amber-900">Cuenta pendiente</Badge>
        </div>
        <WizardHabilitacion alTerminar={cargar} modoOtro />
      </div>
    );
  }

  if (c.estado === "suspendida" || c.estado === "rechazada") {
    return (
      <div className="space-y-4">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-4xl">{c.estado === "suspendida" ? "⏸️" : "🚫"}</p>
          <h1 className="mt-2 font-display text-xl font-bold text-red-800">
            {c.estado === "suspendida" ? "Tu vitrina está en pausa" : "Tu solicitud fue rechazada"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-red-800/80">
            Motivo: {c.motivoEstado ?? "revisión del panel"}. Habla con la familia
            Wasakaka para resolverlo.
          </p>
        </div>
        {c.estado === "suspendida" && (
          <p className="text-center text-xs text-muted-foreground">
            Mientras tanto puedes revisar tus números y tu menú, pero nadie puede
            encargarte hasta que te reactiven.
          </p>
        )}
      </div>
    );
  }

  // pestañas del panel
  const pestañas = [
    { id: "hoy", etiqueta: "Hoy", Icono: LayoutDashboard },
    { id: "menu", etiqueta: "Menú", Icono: ListOrdered },
    { id: "agenda", etiqueta: "Agenda", Icono: CalendarDays },
    { id: "numeros", etiqueta: "Mis números", Icono: PiggyBank },
  ] as const;

  return (
    <div className="space-y-4">
      {/* encabezado con estado legal rápido */}
      <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-card p-4 shadow-sm">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">{c.nombre}</h1>
          <p className="text-xs text-muted-foreground">
            Plan {c.plan === "fundadora" ? "fundadora ($19/mes)" : "regular ($29/mes)"} ·{" "}
            {c.promocionFundadora ? (
              <span className="font-semibold text-green-700">
                Comisión fundadora: 0% (promoción de lanzamiento)
              </span>
            ) : (
              <>comisión {c.comisionPct}%</>
            )} · {c.zona}
          </p>
        </div>
        {panel.tarjeta.nivel === "vencida" || panel.tarjeta.nivel === "sin_tarjeta" ? (
          <Badge className="bg-red-100 text-red-800">Tarjeta vencida: vitrina pausada</Badge>
        ) : panel.tarjeta.nivel === "aviso" || panel.tarjeta.nivel === "critico" ? (
          <Badge className="bg-amber-100 text-amber-800">
            Tarjeta vence en {panel.tarjeta.diasRestantes} días
          </Badge>
        ) : (
          <Badge className="bg-green-100 text-green-800">Documentos al día</Badge>
        )}
        <Button size="icon" variant="ghost" aria-label="Actualizar" onClick={cargar}>
          <RefreshCw className={`size-4 ${cargando ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* pestañas */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-lindo">
        {pestañas.map(({ id, etiqueta, Icono }) => (
          <button
            key={id}
            onClick={() => setVistaCocinera(id)}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold transition-colors ${
              vistaCocinera === id
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Icono className="size-4" />
            {etiqueta}
            {id === "hoy" && panel.numeros.pedidosActivos > 0 && (
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${vistaCocinera === id ? "bg-white/25" : "bg-primary text-white"}`}>
                {panel.numeros.pedidosActivos}
              </span>
            )}
          </button>
        ))}
      </div>

      {vistaCocinera === "hoy" && <PanelHoy panel={panel} recargar={cargar} />}
      {vistaCocinera === "menu" && <PanelMenu panel={panel} recargar={cargar} />}
      {vistaCocinera === "agenda" && <PanelAgenda panel={panel} recargar={cargar} />}
      {vistaCocinera === "numeros" && <PanelNumeros panel={panel} recargar={cargar} />}
    </div>
  );
}

function SinCuenta() {
  const { avisar } = useWasakaka();
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
        <p className="text-4xl">👩‍🍳</p>
        <h1 className="mt-2 font-display text-xl font-bold">Vende lo tuyo en Wasakaka</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Publica tus platillos, recibe preórdenes de tu barrio y cobra sin
          sorpresas. El asistente te lleva paso a paso y la familia Wasakaka
          revisa tu cuenta.
        </p>
      </div>
      <WizardHabilitacion alTerminar={() => { avisar("Solicitud enviada"); window.location.reload(); }} />
    </div>
  );
}

export function ToastExito(titulo: string, descripcion?: string) {
  toast({ title: titulo, description });
}
