"use client";

import { useState } from "react";
import type { CocineraPanel } from "@/components/cocinera/vista-cocinera";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ESTADO_LABEL, formatoDinero } from "@/lib/dinero";
import { toast } from "@/hooks/use-toast";
import { Bike, CalendarClock, CheckCircle2, ChefHat, HandCoins, PackageCheck, Phone } from "lucide-react";

// Panel «Hoy» (RF-C08, RF-C09): pedidos del día con estados y cierre con código.

export function PanelHoy({ panel, recargar }: { panel: CocineraPanel; recargar: () => void }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const pedidosHoy = panel.pedidos.filter(
    (p) => p.fechaEntrega === hoy && !["cancelado", "entregado"].includes(p.estado)
  );
  const entregadosHoy = panel.pedidos.filter((p) => p.estado === "entregado" && p.fechaEntrega === hoy);
  const proximos = panel.pedidos
    .filter((p) => p.fechaEntrega > hoy && !["cancelado", "entregado"].includes(p.estado))
    .sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega));

  return (
    <div className="space-y-3">
      {pedidosHoy.length === 0 && entregadosHoy.length === 0 && proximos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <ChefHat className="mx-auto size-10 text-primary/40" />
          <p className="mt-2 font-bold">Hoy no tienes pedidos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Activa tu agenda y comparte tu enlace en el grupo del barrio.
          </p>
        </div>
      )}

      {pedidosHoy.map((p) => (
        <PedidoHoy key={p.id} pedido={p} recargar={recargar} />
      ))}

      {entregadosHoy.map((p) => (
        <div key={p.id} className="rounded-3xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-green-800">
              {p.cliente.nombre} · {p.items.reduce((a, i) => a + i.cantidad, 0)} artículos
            </p>
            <Badge className="bg-green-200 text-green-900">
              <CheckCircle2 className="mr-1 size-3" /> Entregado
            </Badge>
          </div>
          <p className="mt-1 text-xs text-green-800/80">
            {panel.cocinera.promocionFundadora
              ? `Cobraste ${formatoDinero(p.netoCocinera)} completo — sin comisión (promoción fundadora)`
              : `Cobraste ${formatoDinero(p.netoCocinera)} (tu precio menos ${panel.cocinera.comisionPct}% de comisión)`}
          </p>
        </div>
      ))}

      {proximos.length > 0 && (
        <section className="space-y-3 pt-1">
          <h3 className="flex items-center gap-1.5 px-1 text-sm font-bold text-muted-foreground">
            <CalendarClock className="size-4" /> Próximos días
          </h3>
          {proximos.map((p) => (
            <PedidoHoy key={p.id} pedido={p} recargar={recargar} mostrarFecha />
          ))}
        </section>
      )}
    </div>
  );
}

function PedidoHoy({
  pedido,
  recargar,
  mostrarFecha = false,
}: {
  pedido: CocineraPanel["pedidos"][number];
  recargar: () => void;
  mostrarFecha?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState("");

  const avanzar = async (estado: string) => {
    setEnviando(true);
    try {
      const r = await fetch(`/api/pedidos/${pedido.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, rol: "cocinera" }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "No se pudo actualizar", description: d.error, variant: "destructive" });
        return;
      }
      toast({ title: `Pedido ${ESTADO_LABEL[estado]}`, description: d.whatsapp });
      recargar();
    } finally {
      setEnviando(false);
    }
  };

  const cerrar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`/api/pedidos/${pedido.id}/cerrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "El código no coincide", description: d.error, variant: "destructive" });
        return;
      }
      toast({ title: "Entrega cerrada", description: d.mensaje });
      recargar();
    } finally {
      setEnviando(false);
    }
  };

  const cancelar = async () => {
    setEnviando(true);
    try {
      const r = await fetch(`/api/pedidos/${pedido.id}/estado`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelado", rol: "cocinera" }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({ title: "Pedido cancelado", description: d.reembolso ? "Reembolso al cliente solicitado." : undefined });
        recargar();
      }
    } finally {
      setEnviando(false);
    }
  };

  const esRecogida = pedido.tipoEntrega === "recogida";

  return (
    <article className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold">{pedido.cliente.nombre}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3" /> {pedido.cliente.telefono ?? "—"}
            {" · "}
            {esRecogida ? "recoge en tu casa" : pedido.direccionEntrega}
          </p>
        </div>
        <div className="text-right">
          {mostrarFecha && (
            <Badge variant="outline" className="mb-1 border-border text-muted-foreground">
              para {new Date(pedido.fechaEntrega + "T12:00:00").toLocaleDateString("es-US", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </Badge>
          )}
          <Badge className={pedido.estado === "nuevo" ? "bg-amber-100 text-amber-900" : "bg-primary text-white"}>
            {ESTADO_LABEL[pedido.estado]}
          </Badge>
          {pedido.metodoPago === "efectivo" && (
            <Badge variant="outline" className="ml-1 border-green-300 text-green-700">
              efectivo
            </Badge>
          )}
        </div>
      </div>

      <ul className="mt-3 space-y-0.5 text-sm">
        {pedido.items.map((i) => (
          <li key={i.id} className="flex justify-between">
            <span>
              {i.cantidad} × {i.nombrePlato}
            </span>
            <span className="font-semibold">{formatoDinero(i.precioUnitario * i.cantidad)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-secondary/60 p-3 text-center text-xs">
        <div>
          <p className="font-bold">{formatoDinero(pedido.subtotal)}</p>
          <p className="text-muted-foreground">tu precio</p>
        </div>
        <div>
          <p className="font-bold text-destructive">−{formatoDinero(pedido.comision)}</p>
          <p className="text-muted-foreground">comisión</p>
        </div>
        <div>
          <p className="font-bold text-green-700">{formatoDinero(pedido.netoCocinera)}</p>
          <p className="text-muted-foreground">recibes</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pedido.estado === "nuevo" && (
          <>
            <Button disabled={enviando} className="min-h-11 flex-1 rounded-full bg-primary text-base font-bold" onClick={() => avanzar("confirmado")}>
              <CheckCircle2 className="size-4" /> Confirmar pedido
            </Button>
            <Button disabled={enviando} variant="outline" className="min-h-11 rounded-full text-destructive" onClick={cancelar}>
              Cancelar
            </Button>
          </>
        )}
        {pedido.estado === "confirmado" && (
          <Button disabled={enviando} className="min-h-11 w-full rounded-full bg-primary text-base font-bold" onClick={() => avanzar("en_cocina")}>
            <ChefHat className="size-4" /> Ya estoy cocinando
          </Button>
        )}
        {pedido.estado === "en_cocina" && (
          <Button disabled={enviando} className="min-h-11 w-full rounded-full bg-primary text-base font-bold" onClick={() => avanzar("listo")}>
            <PackageCheck className="size-4" /> Está listo
          </Button>
        )}
        {pedido.estado === "listo" && !esRecogida && (
          <Button disabled={enviando} className="min-h-11 w-full rounded-full bg-primary text-base font-bold" onClick={() => avanzar("en_entrega")}>
            <Bike className="size-4" /> Salí a entregar (activa ubicación en vivo)
          </Button>
        )}
      </div>

      {(pedido.estado === "en_entrega" || pedido.estado === "para_recogida" || (pedido.estado === "listo" && esRecogida)) && (
        <div className="mt-3 flex gap-2">
          <Input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="Código de 4 dígitos del cliente"
            inputMode="numeric"
            aria-label="Código de cierre"
            className="rounded-full"
          />
          <Button disabled={enviando || codigo.length !== 4} className="min-h-11 rounded-full bg-primary text-base font-bold" onClick={cerrar}>
            <HandCoins className="size-4" /> Cerrar
          </Button>
        </div>
      )}
    </article>
  );
}
