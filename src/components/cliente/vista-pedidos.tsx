"use client";

import { useCallback, useEffect, useState } from "react";
import { useWasakaka } from "@/store/wasakaka";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatoDinero, ESTADO_LABEL } from "@/lib/dinero";
import { toast } from "@/hooks/use-toast";
import {
  Check,
  ChefHat,
  ClipboardCopy,
  MapPin,
  Star,
  TriangleAlert,
  X,
} from "lucide-react";

interface PedidoItemDTO {
  id: string;
  nombrePlato: string;
  cantidad: number;
  precioUnitario: number;
  lote?: string | null;
}
interface PedidoDTO {
  id: string;
  estado: string;
  tipoEntrega: string;
  metodoPago: string;
  direccionEntrega: string;
  subtotal: number;
  impuesto: number;
  total: number;
  netoCocinera: number;
  codigoCierre: string;
  fecha: string;
  fechaEntrega: string | null;
  items: PedidoItemDTO[];
  cocinera: { id: string; usuario: { nombre: string } };
  entrega: { progreso: number; horaSalida: string | null; horaEntrega: string | null } | null;
  calificacion: { estrellas: number; comentario: string | null; respuestaCocinera?: string | null } | null;
}

const FLUJO = ["nuevo", "confirmado", "en_cocina", "listo", "en_entrega", "entregado"];

export function VistaPedidos() {
  const { clienteId, seguimientoPedidoId, setSeguimiento, avisar, setVistaCliente } = useWasakaka();
  const [pedidos, setPedidos] = useState<PedidoDTO[] | null>(null);

  const cargar = useCallback(() => {
    if (!clienteId) return;
    fetch(`/api/pedidos?clienteId=${clienteId}`)
      .then((r) => r.json())
      .then((d) => setPedidos(d.pedidos ?? []))
      .catch(() => setPedidos([]));
  }, [clienteId]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 8000); // seguimiento en vivo por sondeo
    return () => clearInterval(t);
  }, [cargar]);

  if (!pedidos) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Cargando tus pedidos…</p>;
  }

  if (pedidos.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
        <p className="text-3xl">🧺</p>
        <p className="mt-2 font-display text-xl font-bold">Todavía no tienes pedidos</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando encargues algo, aquí sigues tu entrega paso a paso.
        </p>
        <Button
          className="mt-4 rounded-full bg-primary font-bold hover:bg-primary/90"
          onClick={() => setVistaCliente("inicio")}
        >
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Mis pedidos</h1>
      {pedidos.map((p) => (
        <TarjetaPedido
          key={p.id}
          pedido={p}
          destacado={p.id === seguimientoPedidoId}
          alCerrar={() => {
            setSeguimiento(null);
            cargar();
          }}
        />
      ))}
    </div>
  );
}

function TarjetaPedido({
  pedido,
  destacado,
  alCerrar,
}: {
  pedido: PedidoDTO;
  destacado: boolean;
  alCerrar: () => void;
}) {
  const enSeguimiento = pedido.estado === "en_entrega";
  const activo = !["entregado", "cancelado"].includes(pedido.estado);

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-card shadow-sm ${
        destacado ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-secondary/50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <ChefHat className="size-4 shrink-0 text-primary" />
          <p className="truncate text-sm font-bold">{pedido.cocinera.usuario.nombre}</p>
        </div>
        <Badge
          className={
            pedido.estado === "entregado"
              ? "bg-green-100 text-green-800"
              : pedido.estado === "cancelado"
                ? "bg-red-100 text-red-800"
                : "bg-primary text-white"
          }
        >
          {ESTADO_LABEL[pedido.estado]}
        </Badge>
      </div>

      <div className="space-y-3 p-4">
        <ul className="space-y-0.5 text-sm">
          {pedido.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span className="truncate">
                {i.cantidad} × {i.nombrePlato}
              </span>
              <span className="shrink-0 font-semibold">
                {formatoDinero(i.precioUnitario * i.cantidad)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total pagado (con impuesto)</span>
          <span className="font-bold">{formatoDinero(pedido.total)}</span>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {pedido.tipoEntrega === "recogida" ? "Recoges en su casa" : pedido.direccionEntrega}
          {" · "}
          {pedido.metodoPago === "efectivo" ? "efectivo al recoger" : "pagado con tarjeta"}
        </p>

        {activo && <LineaEstados estado={pedido.estado} tipoEntrega={pedido.tipoEntrega} />}

        {enSeguimiento && (
          <p className="rounded-xl bg-secondary/60 p-2.5 text-xs font-semibold text-primary">
            {pedido.cocinera.usuario.nombre} salió a entregar tu pedido. Te avisamos en la app
            cuando llegue — confirma con tu código de cierre.
          </p>
        )}

        {activo && <BloqueCodigo pedido={pedido} alCerrar={alCerrar} />}

        {pedido.estado === "entregado" && (
          <BloqueCalificacion pedido={pedido} />
        )}

        {activo && <BotonProblema pedido={pedido} />}
      </div>
    </article>
  );
}

function LineaEstados({ estado, tipoEntrega }: { estado: string; tipoEntrega: string }) {
  const ruta = FLUJO.filter((s) => (tipoEntrega === "recogida" ? s !== "en_entrega" : s !== "para_recogida"));
  if (estado === "cancelado") {
    return (
      <p className="flex items-center gap-1.5 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-700">
        <X className="size-4" /> Pedido cancelado. Si pagaste con tarjeta, tu
        reembolso quedó solicitado.
      </p>
    );
  }
  const indice = ruta.indexOf(estado);
  return (
    <div className="flex items-center">
      {ruta.map((s, i) => (
        <div key={s} className="flex flex-1 items-center last:flex-none">
          <div
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i < indice
                ? "bg-primary text-white"
                : i === indice
                  ? "bg-primary text-white ring-4 ring-primary/20"
                  : "bg-muted text-muted-foreground"
            }`}
            aria-label={ESTADO_LABEL[s]}
            title={ESTADO_LABEL[s]}
          >
            {i < indice ? <Check className="size-3" /> : i + 1}
          </div>
          {i < ruta.length - 1 && (
            <div className={`h-0.5 flex-1 ${i < indice ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// Mapa falso eliminado (RF-U05): el «seguimiento en vivo» dibujado con un
// temporizador del navegador prometía una ubicación que no existe. Lo real y
// verificable es el paso a paso de estados del pedido, que se muestra arriba.

function BloqueCodigo({ pedido, alCerrar }: { pedido: PedidoDTO; alCerrar: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mostrarEntrega = pedido.tipoEntrega === "entrega_cocinera" && pedido.estado === "en_entrega";

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
        toast({ title: "Código incorrecto", description: d.error, variant: "destructive" });
        return;
      }
      toast({ title: "Entrega confirmada", description: d.mensaje });
      alCerrar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="rounded-2xl bg-secondary/60 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        Tu código de cierre
      </p>
      <div className="mt-1 flex items-center gap-2">
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">
          {pedido.codigoCierre}
        </p>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copiar código"
          onClick={() => {
            navigator.clipboard?.writeText(pedido.codigoCierre).catch(() => {});
            toast({ title: "Código copiado" });
          }}
        >
          <ClipboardCopy className="size-4" />
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {mostrarEntrega
          ? "Dáselo a la cocinera al recibir tu pedido. Sin código no se cierra la entrega."
          : "Enséñalo al recoger o entregar. Sin código no se cierra el pedido."}
      </p>
    </div>
  );
}

function BloqueCalificacion({ pedido }: { pedido: PedidoDTO }) {
  const { clienteId, avisar } = useWasakaka();
  const [estrellas, setEstrellas] = useState(pedido.calificacion?.estrellas ?? 0);
  const [comentario, setComentario] = useState(pedido.calificacion?.comentario ?? "");
  const [enviado, setEnviado] = useState(Boolean(pedido.calificacion));

  const enviar = async () => {
    if (estrellas === 0) return;
    await fetch("/api/calificaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pedidoId: pedido.id, clienteId, estrellas, comentario }),
    });
    setEnviado(true);
    avisar("¡Gracias por calificar!");
  };

  return (
    <div className="rounded-2xl border border-border p-4">
      {enviado ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`size-4 ${n <= estrellas ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`}
              />
            ))}
          </div>
          {comentario && <p className="text-sm text-muted-foreground">«{comentario}»</p>}
          {pedido.calificacion?.respuestaCocinera && (
            <p className="rounded-xl bg-secondary/60 p-2 text-sm">
              <span className="font-bold">{pedido.cocinera.usuario.nombre} respondió:</span>{" "}
              {pedido.calificacion.respuestaCocinera}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm font-bold">¿Cómo estuvo tu pedido?</p>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                aria-label={`${n} estrellas`}
                onClick={() => setEstrellas(n)}
                className="rounded-full p-1 hover:bg-secondary"
              >
                <Star
                  className={`size-7 transition-colors ${
                    n <= estrellas ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
          {estrellas > 0 && (
            <>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Cuéntale a tu barrio qué te gustó (opcional)"
                className="mt-2 min-h-16 rounded-xl"
              />
              <Button
                className="mt-2 w-full rounded-full bg-primary font-bold hover:bg-primary/90"
                onClick={enviar}
              >
                Enviar calificación
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function BotonProblema({ pedido }: { pedido: PedidoDTO }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"calidad" | "salud" | "otro">("calidad");
  const [descripcion, setDescripcion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { avisar } = useWasakaka();

  const enviar = async () => {
    if (descripcion.trim().length < 5) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/incidentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: pedido.id, tipo, descripcion }),
      });
      const d = await r.json();
      if (r.ok) {
        avisar(d.texto ?? "Incidente registrado", "app");
        toast({ title: "Reporte enviado", description: d.texto });
        setAbierto(false);
        setDescripcion("");
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Separator />
      <Button
        variant="ghost"
        className="w-full rounded-full text-destructive hover:bg-destructive/10"
        onClick={() => setAbierto(true)}
      >
        <TriangleAlert className="size-4" /> Tuve un problema con este pedido
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-primary">Cuéntanos qué pasó</DialogTitle>
            <DialogDescription>
              Tu reporte llega directo al panel de la familia Wasakaka. Si es de
              salud, pausamos la cocina de inmediato mientras lo revisamos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["salud", "Me sentí mal"],
                  ["calidad", "No estuvo bien el pedido"],
                  ["otro", "Otro"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  onClick={() => setTipo(valor)}
                  className={`rounded-2xl border p-3 text-xs font-bold transition-colors ${
                    tipo === valor
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
            <Textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Cuéntanos con tus palabras qué pasó"
              className="min-h-20 rounded-xl"
            />
            <Button
              disabled={enviando || descripcion.trim().length < 5}
              onClick={enviar}
              className="w-full rounded-full bg-primary font-bold hover:bg-primary/90"
            >
              {enviando ? "Enviando…" : "Enviar reporte"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
