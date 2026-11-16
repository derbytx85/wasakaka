"use client";

import { useCallback, useEffect, useState } from "react";
import { useWasakaka } from "@/store/wasakaka";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ESTADO_LABEL, formatoDinero } from "@/lib/dinero";
import { toast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  ClipboardCheck,
  FileSpreadsheet,
  Map as MapIcon,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Undo2,
} from "lucide-react";

interface Resumen {
  pendientes: {
    id: string;
    nombre: string;
    telefono: string | null;
    zona: string | null;
    vendeTcs: boolean;
    numeroDshs: string | null;
    tarjeta: string | null;
    tarjetaEstado: string;
    radioEntregaKm: number;
    plan: string;
    bio: string | null;
  }[];
  platosRecientes: {
    id: string;
    nombre: string;
    cocinera: string;
    categoria: string;
    ingredientes: string;
    activo: boolean;
  }[];
  pedidosHoy: {
    id: string;
    estado: string;
    cliente: string;
    cocinera: string;
    total: number;
    comision: number;
    netoCocinera: number;
    tipoEntrega: string;
    metodoPago: string;
    fechaEntrega: string | null;
  }[];
  alertasCorte: { pedidoId: string; texto: string }[];
  incidentes: {
    id: string;
    tipo: string;
    descripcion: string;
    estado: string;
    acciones: string;
    pedido: { cocinera: { usuario: { nombre: string } }; cliente: { nombre: string } };
  }[];
  dinero: {
    ventasMes: number;
    comisionMes: number;
    procesamientoMes: number;
    margenMes: number;
    impuestoMesApartado: number;
    suscripcionesActivas: number;
    ingresoSuscripcionesMes: number;
    // honestidad RF-P05: si nadie ha sido cobrada este mes, la UI lo rotula demo
    suscripcionesSinCobrosReales: boolean;
  };
  impuestos: {
    mesActual: string;
    mesActualCobrado: number;
    cierreActual: {
      totalVentas: number;
      impuestoCobrado: number;
      impuestoRemitido: number;
      comprobante: string | null;
    } | null;
    mesAnterior: { mes: string; totalVentas: number; impuestoCobrado: number; impuestoRemitido: number; comprobante: string | null } | null;
  };
  metricas: {
    cocinerasActivas: number;
    pedidosMes: number;
    ventaPromedio: number;
    ventasPorZona: { zona: string; pedidos: number; total: number }[];
  };
}

export function VistaAdmin() {
  const { vistaAdmin, setVistaAdmin, avisar } = useWasakaka();
  const [resumen, setResumen] = useState<Resumen | null>(null);

  const cargar = useCallback(() => {
    return fetch("/api/admin/resumen")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setResumen(d);
      })
      .catch(() => {
        /* silencioso */
      });
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [cargar]);

  const pestañas = [
    { id: "operacion", etiqueta: "Operación" },
    { id: "aprobaciones", etiqueta: "Aprobaciones" },
    { id: "dinero", etiqueta: "Dinero e impuestos" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="flex-1 font-display text-2xl font-bold">Panel de la familia</h1>
        <Button size="icon" variant="ghost" aria-label="Actualizar" onClick={cargar}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex gap-1.5">
        {pestañas.map((p) => (
          <button
            key={p.id}
            onClick={() => setVistaAdmin(p.id)}
            className={`rounded-full border px-3.5 py-2 text-sm font-bold transition-colors ${
              vistaAdmin === p.id
                ? "border-primary bg-primary text-white"
                : "border-border bg-card text-muted-foreground hover:bg-secondary"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      {!resumen && <p className="py-10 text-center text-sm text-muted-foreground">Cargando el panel…</p>}

      {resumen && vistaAdmin === "operacion" && (
        <Operacion resumen={resumen} recargar={cargar} />
      )}
      {resumen && vistaAdmin === "aprobaciones" && (
        <Aprobaciones resumen={resumen} recargar={cargar} avisar={avisar} />
      )}
      {resumen && vistaAdmin === "dinero" && <Dinero resumen={resumen} recargar={cargar} />}
    </div>
  );
}

// RF-A02: operación del día + RF-A03: incidentes
function Operacion({ resumen, recargar }: { resumen: Resumen; recargar: () => void }) {
  const [incidenteAbierto, setIncidenteAbierto] = useState<Resumen["incidentes"][number] | null>(null);

  const accionIncidente = async (id: string, accion: string) => {
    const r = await fetch(`/api/admin/incidentes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion }),
    });
    const d = await r.json();
    if (r.ok) {
      toast({ title: d.notificacion ?? "Listo", description: d.mensaje });
      recargar();
      setIncidenteAbierto(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* alertas de hora de corte */}
      {resumen.alertasCorte.length > 0 && (
        <div className="space-y-1.5 rounded-3xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
            <AlertTriangle className="size-4" /> Atención por hora de corte
          </p>
          {resumen.alertasCorte.map((a) => (
            <p key={a.pedidoId} className="text-sm text-amber-800/90">
              • {a.texto}
            </p>
          ))}
        </div>
      )}

      {/* mapa del día simplificado */}
      <section className="overflow-hidden rounded-3xl border border-border">
        <div className="flex items-center gap-2 bg-card px-4 py-2.5 text-sm font-bold">
          <MapIcon className="size-4 text-primary" /> Entregas en vivo de hoy
        </div>
        <svg viewBox="0 0 100 48" className="h-28 w-full bg-[#f3ead8]" role="img" aria-label="Mapa de pedidos del día">
          <path d="M0 16 Q 50 10 100 18" stroke="#e5d5b8" strokeWidth="5" fill="none" />
          <path d="M0 36 Q 55 30 100 38" stroke="#e5d5b8" strokeWidth="5" fill="none" />
          <path d="M25 0 Q 28 24 24 48" stroke="#e5d5b8" strokeWidth="4" fill="none" />
          <path d="M62 0 Q 60 24 64 48" stroke="#e5d5b8" strokeWidth="4" fill="none" />
          {resumen.pedidosHoy
            .filter((p) => !["entregado", "cancelado"].includes(p.estado))
            .slice(0, 8)
            .map((p, i) => {
              const x = 12 + ((i * 37) % 80);
              const y = 10 + ((i * 23) % 30);
              return (
                <g key={p.id}>
                  <circle cx={x} cy={y} r="3" fill="#d05a1e" opacity="0.85" />
                  <circle cx={x} cy={y} r="5" fill="none" stroke="#d05a1e" opacity="0.3">
                    <animate attributeName="r" values="4;7;4" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                </g>
              );
            })}
        </svg>
      </section>

      {/* pedidos del día */}
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">Pedidos de hoy ({resumen.pedidosHoy.length})</h2>
        {resumen.pedidosHoy.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Sin pedidos todavía hoy.</p>
        )}
        {resumen.pedidosHoy.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {p.cliente} → {p.cocinera}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.tipoEntrega === "recogida" ? "recogida" : "domicilio"} ·{" "}
                {p.metodoPago === "efectivo" ? "efectivo" : "tarjeta"} · neto cocinera{" "}
                {formatoDinero(p.netoCocinera)}
              </p>
            </div>
            <p className="font-bold">{formatoDinero(p.total)}</p>
            <Badge className={p.estado === "nuevo" ? "bg-amber-100 text-amber-900" : "bg-secondary text-secondary-foreground"}>
              {ESTADO_LABEL[p.estado]}
            </Badge>
          </div>
        ))}
      </section>

      {/* incidentes RF-A03 */}
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">Incidentes abiertos</h2>
        {resumen.incidentes.length === 0 && (
          <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
            <ShieldCheck className="size-4" /> Sin incidentes. Protocolo listo por si aparece uno.
          </p>
        )}
        {resumen.incidentes.map((inc) => (
          <button
            key={inc.id}
            onClick={() => setIncidenteAbierto(inc)}
            className="flex w-full items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-left"
          >
            <AlertTriangle className={`size-5 shrink-0 ${inc.tipo === "salud" ? "text-red-600" : "text-amber-600"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-red-800">
                {inc.tipo === "salud" ? "SALUD" : inc.tipo} · {inc.pedido.cocinera.usuario.nombre}
              </p>
              <p className="truncate text-xs text-red-700/80">{inc.descripcion}</p>
            </div>
            <Badge className="bg-red-200 text-red-900">{inc.estado}</Badge>
          </button>
        ))}
      </section>

      <Dialog open={!!incidenteAbierto} onOpenChange={(o) => !o && setIncidenteAbierto(null)}>
        <DialogContent className="rounded-2xl">
          {incidenteAbierto && (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">
                  Protocolo de {incidenteAbierto.tipo === "salud" ? "salud" : "reclamo"}
                </DialogTitle>
                <DialogDescription>{incidenteAbierto.descripcion}</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p className="rounded-xl bg-secondary/60 p-3">
                  {incidenteAbierto.pedido.cliente.nombre} reportó contra{" "}
                  {incidenteAbierto.pedido.cocinera.usuario.nombre}. La cocina y
                  el plato están pausados automáticamente.
                </p>
                <div className="grid gap-2">
                  <Button variant="outline" className="rounded-full" onClick={() => accionIncidente(incidenteAbierto.id, "contactar_lote")}>
                    <ClipboardCheck className="size-4" /> Generar lista del lote (72 h)
                  </Button>
                  <Button variant="outline" className="rounded-full" onClick={() => accionIncidente(incidenteAbierto.id, "reabrir_cocinera")}>
                    <Undo2 className="size-4" /> Reabrir cocinera tras revisión
                  </Button>
                  <Button className="rounded-full bg-primary font-bold" onClick={() => accionIncidente(incidenteAbierto.id, "cerrar")}>
                    <BadgeCheck className="size-4" /> Cerrar incidente
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada acción queda registrada con hora como evidencia.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// RF-A01: cola de aprobaciones + revisión anti-prohibidos
function Aprobaciones({
  resumen,
  recargar,
  avisar,
}: {
  resumen: Resumen;
  recargar: () => void;
  avisar: (t: string, c?: "whatsapp" | "app") => void;
}) {
  const [motivoDialog, setMotivoDialog] = useState<{ id: string; accion: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState("");

  const decidir = async () => {
    if (!motivoDialog) return;
    const r = await fetch(`/api/admin/cocineras/${motivoDialog.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: motivoDialog.accion, motivo }),
    });
    const d = await r.json();
    if (r.ok) {
      avisar(d.whatsapp ?? d.notificacion, "whatsapp");
      toast({ title: d.notificacion ?? "Listo" });
      recargar();
    }
    setMotivoDialog(null);
    setMotivo("");
  };

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">
          Cocineras pendientes ({resumen.pendientes.length})
        </h2>
        {resumen.pendientes.length === 0 && (
          <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-4 text-sm text-green-800">
            <BadgeCheck className="size-4" /> Todo al día: nadie espera aprobación.
          </p>
        )}
        {resumen.pendientes.map((c) => (
          <div key={c.id} className="space-y-2 rounded-3xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{c.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {c.zona} · radio {c.radioEntregaKm} km · plan {c.plan} · {c.telefono}
                </p>
                {c.bio && <p className="mt-1 text-sm">«{c.bio}»</p>}
              </div>
              {c.vendeTcs ? (
                <Badge variant="secondary" className="shrink-0 bg-blue-100 text-blue-800">TCS</Badge>
              ) : null}
            </div>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-1.5">
                <BadgeCheck className={`size-3.5 ${c.tarjeta ? "text-green-600" : "text-red-500"}`} />
                Tarjeta de manipulador: {c.tarjeta ?? "no subió"}{" "}
                {c.tarjeta && c.tarjetaEstado !== "ok" && c.tarjetaEstado !== "vencida" && `(vence pronto)`}
              </li>
              {c.vendeTcs && (
                <li className="flex items-center gap-1.5">
                  <BadgeCheck className={`size-3.5 ${c.numeroDshs ? "text-green-600" : "text-red-500"}`} />
                  Registro DSHS: {c.numeroDshs ?? "falta"}
                </li>
              )}
            </ul>
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-full bg-primary font-bold hover:bg-primary/90"
                onClick={() => setMotivoDialog({ id: c.id, accion: "aprobar", nombre: c.nombre })}
              >
                Aprobar
              </Button>
              <Button
                variant="outline"
                className="rounded-full text-destructive"
                onClick={() => setMotivoDialog({ id: c.id, accion: "rechazar", nombre: c.nombre })}
              >
                <Ban className="size-4" /> Rechazar
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">
          Platos nuevos a revisar (primeros 30 días)
        </h2>
        <p className="text-xs text-muted-foreground">
          Segunda capa anti-categorías prohibidas: ojo con ingredientes de carne,
          pollo, cerdo, pescado, mariscos o helado.
        </p>
        {resumen.platosRecientes.length === 0 && (
          <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">Sin platos nuevos.</p>
        )}
        {resumen.platosRecientes.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border bg-card p-3 text-sm">
            <p className="font-bold">
              {p.nombre} <span className="text-xs font-normal text-muted-foreground">· {p.cocinera}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {p.categoria} · ingredientes: {p.ingredientes}
            </p>
          </div>
        ))}
      </section>

      <Dialog open={!!motivoDialog} onOpenChange={(o) => !o && setMotivoDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">
              {motivoDialog?.accion === "aprobar" ? "Aprobar a" : "Rechazar a"} {motivoDialog?.nombre}
            </DialogTitle>
            <DialogDescription>
              El motivo queda registrado. Le avisamos en la aplicación (el canal
              de WhatsApp real se integra más adelante).
            </DialogDescription>
          </DialogHeader>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional al aprobar, recomendado al rechazar)" className="rounded-xl" />
          <Button className="rounded-full bg-primary font-bold hover:bg-primary/90" onClick={decidir}>
            Confirmar
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// RF-A04 dinero + RF-I03 impuestos + RF-A06 métricas
function Dinero({ resumen, recargar }: { resumen: Resumen; recargar: () => void }) {
  const d = resumen.dinero;
  const [generandoCierre, setGenerandoCierre] = useState(false);

  // RF-I03: generar el cierre del mes actual → se guarda en ImpuestoMensual
  const generarCierre = async () => {
    setGenerandoCierre(true);
    try {
      const r = await fetch(`/api/admin/impuestos/${resumen.impuestos.mesActual}`);
      const data = await r.json();
      if (r.ok) {
        toast({ title: "Cierre guardado", description: data.mensaje ?? "El registro mensual quedó consultable en la base." });
        recargar();
      } else {
        toast({ title: "No se pudo generar el cierre", description: data.error, variant: "destructive" });
      }
    } finally {
      setGenerandoCierre(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Tarjeta titulo="Comisiones del mes" valor={formatoDinero(d.comisionMes)} />
        <Tarjeta titulo="Costo de procesamiento" valor={formatoDinero(d.procesamientoMes)} />
        <Tarjeta titulo="Margen neto" valor={formatoDinero(d.margenMes)} acento />
        <Tarjeta titulo="Suscripciones activas" valor={`${d.suscripcionesActivas} cocineras`} />
        <Tarjeta
          titulo="Ingreso por suscripciones (mes)"
          valor={
            d.suscripcionesSinCobrosReales
              ? "Sin cobros reales aún (demo)"
              : formatoDinero(d.ingresoSuscripcionesMes)
          }
        />
        <Tarjeta titulo="Impuesto apartado (mes)" valor={formatoDinero(d.impuestoMesApartado)} />
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-base font-bold">Conciliación (RF-P07)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Comparación nocturna automática entre los cobros del procesador y la
          base de datos. Diferencias mayores a US$0.01 generan alerta.
        </p>
        <p className="mt-2 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">
          <ShieldCheck className="size-4" /> Sin diferencias en la última conciliación.
        </p>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <FileSpreadsheet className="size-4 text-primary" /> Impuesto de ventas (RF-I02/I03)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El impuesto se aparta de las ventas: nunca se mezcla con ingresos.
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Mes actual ({resumen.impuestos.mesActual}) · cobrado</span>
            <span className="font-bold">{formatoDinero(resumen.impuestos.mesActualCobrado)}</span>
          </li>
          {resumen.impuestos.cierreActual ? (
            <li className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 p-2.5">
              <span>
                Cierre guardado: {formatoDinero(resumen.impuestos.cierreActual.impuestoCobrado)} cobrados ·{" "}
                {formatoDinero(resumen.impuestos.cierreActual.impuestoRemitido)} remitidos
              </span>
              <Badge variant="secondary" className="shrink-0">{resumen.impuestos.cierreActual.comprobante}</Badge>
            </li>
          ) : null}
          {resumen.impuestos.mesAnterior && (
            <li className="flex justify-between">
              <span>
                {resumen.impuestos.mesAnterior.mes} · remitido al Contralor
              </span>
              <span className="font-bold text-green-700">
                {formatoDinero(resumen.impuestos.mesAnterior.impuestoRemitido)}
              </span>
            </li>
          )}
        </ul>
        {!resumen.impuestos.cierreActual && (
          <Button
            className="mt-3 rounded-full bg-primary font-bold hover:bg-primary/90"
            disabled={generandoCierre}
            onClick={generarCierre}
          >
            <FileSpreadsheet className="size-4" />
            {generandoCierre ? "Generando cierre…" : "Generar cierre del mes y guardarlo"}
          </Button>
        )}
        {resumen.impuestos.mesAnterior?.comprobante && (
          <p className="mt-2 rounded-xl bg-secondary/60 p-2.5 text-xs">
            Comprobante guardado: {resumen.impuestos.mesAnterior.comprobante}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <TrendingUp className="size-4 text-primary" /> Métricas mínimas (RF-A06)
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Cocineras activas</span>
            <span className="font-bold">{resumen.metricas.cocinerasActivas}</span>
          </li>
          <li className="flex justify-between">
            <span>Pedidos del mes</span>
            <span className="font-bold">{resumen.metricas.pedidosMes}</span>
          </li>
          <li className="flex justify-between">
            <span>Venta promedio</span>
            <span className="font-bold">{formatoDinero(resumen.metricas.ventaPromedio)}</span>
          </li>
        </ul>
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Ventas por barrio
        </p>
        {resumen.metricas.ventasPorZona.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Sin ventas este mes.</p>
        ) : (
          <ul className="mt-1 space-y-1.5">
            {resumen.metricas.ventasPorZona.map((z) => (
              <li key={z.zona} className="flex justify-between text-sm">
                <span>{z.zona}</span>
                <span>
                  {z.pedidos} pedidos · {formatoDinero(z.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tarjeta({ titulo, valor, acento }: { titulo: string; valor: string; acento?: boolean }) {
  return (
    <div className={`rounded-3xl border p-4 ${acento ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      <p className={`mt-1 font-display text-xl font-bold ${acento ? "text-primary" : ""}`}>{valor}</p>
    </div>
  );
}
