"use client";

import { useState } from "react";
import type { CocineraPanel } from "@/components/cocinera/vista-cocinera";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { CalendarPlus, Clock, Users } from "lucide-react";

// Agenda y preórdenes (RF-C07): días de cocina, hora de corte y capacidad.

function etiquetaDia(fecha: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (fecha === hoy) return "Hoy";
  if (fecha === manana) return "Mañana";
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function PanelAgenda({ panel, recargar }: { panel: CocineraPanel; recargar: () => void }) {
  const [fecha, setFecha] = useState("");
  const [horaCorte, setHoraCorte] = useState("18:00");
  const [capacidad, setCapacidad] = useState("10");
  const [enviando, setEnviando] = useState(false);

  const crear = async () => {
    if (!fecha) {
      toast({ title: "Elige la fecha", variant: "destructive" });
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch("/api/agenda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cocineraId: panel.cocinera.id,
          fecha,
          horaCorte,
          capacidadPedidos: Number(capacidad) || 10,
        }),
      });
      const d = await r.json();
      if (!r.ok) {
        toast({ title: "No se pudo activar el día", description: d.error, variant: "destructive" });
        return;
      }
      toast({ title: "Día de cocina activado", description: d.mensaje });
      recargar();
    } finally {
      setEnviando(false);
    }
  };

  const editar = async (id: string, cambios: Record<string, unknown>) => {
    const r = await fetch(`/api/agenda/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    });
    const d = await r.json();
    if (!r.ok) toast({ title: "Error", description: d.error, variant: "destructive" });
    else toast({ title: d.notificacion ?? "Día actualizado" });
    recargar();
  };

  const eliminar = async (id: string) => {
    const r = await fetch(`/api/agenda/${id}`, { method: "DELETE" });
    const d = await r.json();
    toast({ title: d.notificacion ?? "Listo", description: d.mensaje });
    recargar();
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-border bg-card p-4 shadow-sm">
        <h2 className="font-display text-base font-bold">Activar un día de cocina</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="a-fecha">Fecha</Label>
            <Input
              id="a-fecha"
              type="date"
              value={fecha}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="a-hora">Hora de corte</Label>
            <Input id="a-hora" type="time" value={horaCorte} onChange={(e) => setHoraCorte(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label htmlFor="a-cap" className="flex items-center gap-1.5">
              <Users className="size-3.5" /> Máximo de pedidos ese día
            </Label>
            <Input
              id="a-cap"
              type="number"
              min={1}
              max={50}
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Pasada la hora de corte, ese día deja de recibir encargos. El cliente ve
          «encarga hasta las {horaCorte}».
        </p>
        <Button disabled={enviando} className="w-full rounded-full bg-primary font-bold hover:bg-primary/90" onClick={crear}>
          <CalendarPlus className="size-4" /> Activar día
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-bold">Tus próximos días</h2>
        {panel.agendas.length === 0 && (
          <p className="rounded-3xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Sin días activos: los clientes no pueden encargarte. Activa al menos uno.
          </p>
        )}
        {panel.agendas.map((a) => {
          const usados = panel.pedidos.filter(
            (p) => p.fechaEntrega === a.fecha && p.estado !== "cancelado"
          ).length;
          return (
            <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold capitalize">{etiquetaDia(a.fecha)}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" /> corte {a.horaCorte} · {usados}/{a.capacidadPedidos} pedidos
                </p>
              </div>
              <Badge variant={a.activa ? "default" : "outline"} className={a.activa ? "bg-green-100 text-green-800" : ""}>
                {a.activa ? "activo" : "pausado"}
              </Badge>
              <div className="flex w-full gap-1.5 sm:w-auto">
                <Input
                  type="time"
                  defaultValue={a.horaCorte}
                  className="h-8 w-28 rounded-full text-xs"
                  aria-label="Cambiar hora de corte"
                  onBlur={(e) => e.target.value !== a.horaCorte && editar(a.id, { horaCorte: e.target.value })}
                />
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => editar(a.id, { activa: !a.activa })}>
                  {a.activa ? "Pausar" : "Activar"}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-full text-destructive text-xs" onClick={() => eliminar(a.id)}>
                  Quitar
                </Button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
