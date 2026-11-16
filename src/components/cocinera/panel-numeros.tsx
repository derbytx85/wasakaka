"use client";

import { useState } from "react";
import type { CocineraPanel } from "@/components/cocinera/vista-cocinera";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatoDinero, COMISION_ESTANDAR } from "@/lib/dinero";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, FlaskConical, Scale } from "lucide-react";

// «Mis números» (RF-C10, RF-C11, RF-C12): transparencia total, ningún cargo oculto.
// - El contador del tope ya incluye el ajuste manual (lo calcula el servidor);
//   aquí se previsualiza la edición antes de guardarla vía PATCH ventas-fuera.
// - Comisión fundadora: 0% durante la promoción de lanzamiento (RF-P04).

const TOPE = 150000;

export function PanelNumeros({ panel, recargar }: { panel: CocineraPanel; recargar: () => void }) {
  const { topeLegal, numeros, suscripcion, cocinera } = panel;
  const [ventasFuera, setVentasFuera] = useState(String(cocinera.ventasFuera ?? 0));
  const [guardando, setGuardando] = useState(false);
  const [lote, setLote] = useState("");
  const [ph, setPh] = useState("");
  const [platoLote, setPlatoLote] = useState("");

  // el servidor ya suma ventasFueraPlataforma al contador; para previsualizar
  // el ajuste pendiente partimos de lo que NO viene del ajuste manual
  const valorEditado = Number(ventasFuera || 0);
  const totalPrevisualizado = topeLegal.ventasPlataforma + valorEditado;
  const porcentaje = Math.min(100, (totalPrevisualizado / TOPE) * 100);
  const colorBarra =
    porcentaje >= 100 ? "bg-destructive" : porcentaje >= 95 ? "bg-orange-600" : porcentaje >= 80 ? "bg-amber-500" : "bg-primary";

  const guardarAjuste = async () => {
    setGuardando(true);
    try {
      // RF-I04: el ajuste manual se GUARDA en la base (endpoint real)
      const r = await fetch(`/api/cocineras/${cocinera.id}/ventas-fuera`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ventasFueraPlataforma: valorEditado }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "No se pudo guardar", description: d.error, variant: "destructive" });
        return;
      }
      toast({ title: d.notificacion ?? "Ajuste registrado", description: d.mensaje });
      recargar();
    } finally {
      setGuardando(false);
    }
  };

  const registrarLote = async () => {
    if (!platoLote || !lote.trim()) {
      toast({ title: "Faltan datos del lote", variant: "destructive" });
      return;
    }
    // RF-C12: el lote se registra de verdad en la base (POST /api/lotes)
    const r = await fetch("/api/lotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cocineraId: cocinera.id, platoId: platoLote, lote, ph: ph || undefined }),
    });
    const d = await r.json();
    if (!r.ok) {
      toast({ title: "No se pudo registrar el lote", description: d.error, variant: "destructive" });
      return;
    }
    toast({ title: d.notificacion ?? "Lote registrado", description: d.mensaje });
    setLote("");
    setPh("");
    recargar();
  };

  return (
    <div className="space-y-4">
      {/* Tope legal (RF-C10) */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <Scale className="size-4 text-primary" /> Tu tope legal del año
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          La ley de comida casera de Texas permite vender hasta US$150,000 por
          año. Te avisamos al 80% y al 95%.
        </p>
        <div className="mt-3">
          <div className="flex justify-between text-sm font-bold">
            <span>Ventas del año</span>
            <span className="tabular-nums">
              {formatoDinero(totalPrevisualizado)} de {formatoDinero(TOPE)}
            </span>
          </div>
          <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(porcentaje)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full rounded-full transition-all ${colorBarra}`} style={{ width: `${Math.max(2, porcentaje)}%` }} />
          </div>
          <p className="mt-1.5 text-xs font-semibold">
            {porcentaje >= 100
              ? "Llegaste al tope: tu vitrina se pausa. Habla con la familia Wasakaka sobre la ruta de cocina comercial."
              : porcentaje >= 95
                ? "¡Alerta! Estás al 95% del tope legal."
                : porcentaje >= 80
                  ? "Vas al 80% del tope legal. Planea tu cierre de año."
                  : `Llevas el ${Math.round(porcentaje)}% del tope.`}
          </p>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="v-fuera" className="text-xs">
              Ventas fuera de la plataforma (ajuste manual)
            </Label>
            <Input
              id="v-fuera"
              inputMode="decimal"
              value={ventasFuera}
              onChange={(e) => setVentasFuera(e.target.value.replace(/[^\d.]/g, ""))}
              className="mt-1 rounded-xl"
            />
          </div>
          <Button variant="outline" className="rounded-full" disabled={guardando} onClick={guardarAjuste}>
            {guardando ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </section>

      {/* Ventas (RF-C11) */}
      <section className="grid grid-cols-2 gap-3">
        <Tarjeta titulo="Ventas de hoy" valor={formatoDinero(numeros.ventasHoy)} />
        <Tarjeta titulo="Ventas de la semana" valor={formatoDinero(numeros.ventasSemana)} />
        <Tarjeta titulo="Ventas del mes" valor={formatoDinero(numeros.ventasMes)} />
        <Tarjeta titulo="Pedidos activos" valor={String(numeros.pedidosActivos)} />
      </section>

      {/* Suscripción y cobros */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <CalendarClock className="size-4 text-primary" /> Tu cuota y tus cobros
        </h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Plan {cocinera.plan}</span>
            <span className="font-bold">{formatoDinero(suscripcion.cuotaMensual)}/mes</span>
          </li>
          {cocinera.promocionFundadora ? (
            <li className="flex justify-between">
              <span>Comisión por venta</span>
              <span className="font-bold text-green-700">
                Comisión fundadora: US$0 (promoción de lanzamiento)
              </span>
            </li>
          ) : (
            <li className="flex justify-between">
              <span>Comisión por venta</span>
              <span className="font-bold">{cocinera.comisionPct}%</span>
            </li>
          )}
          {cocinera.promocionFundadora && (
            <li className="rounded-xl bg-green-50 p-2.5 text-xs text-green-800">
              {cocinera.avisoSalidaPromo
                ? `Aviso: tu promoción fundadora termina en ${cocinera.diasParaFinPromo} días; después tu comisión será del ${COMISION_ESTANDAR}%.`
                : "Vendes con 0% de comisión mientras dure la promoción de lanzamiento (sale antes si pasas de US$400 en ventas de un mes)."}
            </li>
          )}
          {/* RF-P05: el «próximo cobro» solo existe si hay suscripción activa real en la base */}
          {suscripcion.activa && suscripcion.proximoCobro && (
            <li className="flex justify-between">
              <span>Próxima fecha de cobro</span>
              <span className="font-bold">
                {new Date(suscripcion.proximoCobro).toLocaleDateString("es-US", {
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </li>
          )}
          <li className="flex justify-between text-muted-foreground">
            <span>Comisiones pagadas esta semana</span>
            <span>{formatoDinero(numeros.comisionesPagadasSemana)}</span>
          </li>
        </ul>
        <p className="mt-2 rounded-xl bg-secondary/60 p-2.5 text-xs">
          {cocinera.promocionFundadora
            ? "Así funciona: durante la promoción de lanzamiento te quedas el 100% de tu precio. Al salir de la promoción, la comisión estándar del 8% se descuenta de tu lado (ya cubre el costo de la tarjeta). "
            : "Así funciona: te quedas el 100% de tu precio menos la comisión del 8%, que ya cubre el costo de la tarjeta. "}
          <strong>Ningún cargo oculto.</strong> El comprador nunca paga comisión.
        </p>
      </section>

      {/* Registro de lotes (RF-C12) para encurtidos y fermentados */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-base font-bold">
          <FlaskConical className="size-4 text-primary" /> Registro de lotes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Para encurtidos y fermentados: guarda lote y pH de cada producción. Se
          conserva 12 meses (lo pide la ley).
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-1">
            <Label htmlFor="l-plato" className="text-xs">Plato (encurtido/fermentado)</Label>
            <select
              id="l-plato"
              value={platoLote}
              onChange={(e) => setPlatoLote(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm"
            >
              <option value="">Elige un plato…</option>
              {panel.platos
                .filter((p) => p.loteRequerido || p.categoria === "conservas")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="l-lote" className="text-xs">Lote</Label>
            <Input id="l-lote" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="ENC-2026-1115" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="l-ph" className="text-xs">pH (si aplica)</Label>
            <Input id="l-ph" value={ph} onChange={(e) => setPh(e.target.value.replace(/[^\d.]/g, ""))} placeholder="3.9" inputMode="decimal" className="rounded-xl" />
          </div>
        </div>
        <Button className="mt-3 w-full rounded-full bg-primary font-bold hover:bg-primary/90" onClick={registrarLote}>
          Registrar producción
        </Button>
      </section>
    </div>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-semibold text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-display text-2xl font-bold text-primary">{valor}</p>
    </div>
  );
}
