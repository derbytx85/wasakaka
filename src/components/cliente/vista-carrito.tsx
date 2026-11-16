"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useWasakaka } from "@/store/wasakaka";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { formatoDinero, formatoHora, pasoHoraCorte } from "@/lib/dinero";
import { Minus, Plus, ShoppingBasket, Trash2, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AgendaOpcion {
  id: string;
  fecha: string;
  horaCorte: string;
}

interface Cocinera {
  id: string;
  nombre: string;
  agendas: AgendaOpcion[];
}

// Desglose del carrito calculado SOLO por el servidor (RF-I01): el cliente
// nunca calcula impuestos. El comprador paga subtotal + impuesto estimado,
// nada más: la comisión se descuenta del lado de la cocinera y JAMÁS aparece
// en ninguna pantalla del rol cliente (RF-P01 / RF-U04).

interface DesgloseServidor {
  subtotal: number;
  impuestoEstimado: number;
  total: number;
}

export function VistaCarrito() {
  const { items, cambiarCantidad, quitar, vaciar, clienteId, setClienteDemo, avisar, setSeguimiento, setVistaCliente } =
    useWasakaka();

  const [tipoEntrega, setTipoEntrega] = useState<"entrega_cocinera" | "recogida">("entrega_cocinera");
  const [direccion, setDireccion] = useState("");
  const [metodoPago, setMetodoPago] = useState<"tarjeta" | "efectivo">("tarjeta");
  const [enviando, setEnviando] = useState(false);
  const [opcionesPor, setOpcionesPor] = useState<Record<string, AgendaOpcion[]>>({}); // cocineraId → días disponibles
  const [elegidoPor, setElegidoPor] = useState<Record<string, string>>({}); // cocineraId → fecha elegida
  const [aceptaEfectivoPor, setAceptaEfectivoPor] = useState<Record<string, boolean>>({});
  const [consultaHecha, setConsultaHecha] = useState(false);
  const [desglose, setDesglose] = useState<DesgloseServidor | null>(null);

  // registro de cliente (RF-U01): solo si no hay cuenta demo activa
  const [regNombre, setRegNombre] = useState("");
  const [regTelefono, setRegTelefono] = useState("");
  const [regCorreo, setRegCorreo] = useState("");

  const cocinerasEnCarrito = useMemo(() => {
    const mapa = new Map<string, string>();
    items.forEach((i) => mapa.set(i.cocineraId, i.cocineraNombre));
    return [...mapa.entries()].map(([id, nombre]) => ({ id, nombre }));
  }, [items]);

  const firmaItems = useMemo(
    () => items.map((i) => `${i.platoId}:${i.cantidad}`).join("|"),
    [items]
  );

  // agendas de las cocineras del carrito (para elegir día de entrega)
  useEffect(() => {
    if (cocinerasEnCarrito.length === 0 || consultaHecha) return;
    setConsultaHecha(true);
    fetch("/api/catalogo")
      .then((r) => r.json())
      .then((d) => {
        const mapOpciones: Record<string, AgendaOpcion[]> = {};
        const mapEfectivo: Record<string, boolean> = {};
        const iniciales: Record<string, string> = {};
        for (const c of (d.cocineras ?? []) as (Cocinera & { aceptaEfectivo: boolean })[]) {
          if (c.agendas.length > 0) {
            mapOpciones[c.id] = c.agendas;
            // elegimos por defecto el primer día cuyo corte no haya pasado (hora local);
            // el servidor sigue siendo la autoridad final (RF-C07)
            const vigente = c.agendas.find((a) => !pasoHoraCorte(a.horaCorte, a.fecha));
            const eleccion = vigente ?? c.agendas[c.agendas.length - 1];
            iniciales[c.id] = eleccion.fecha;
          }
          mapEfectivo[c.id] = c.aceptaEfectivo;
        }
        setOpcionesPor((prev) => ({ ...mapOpciones, ...prev }));
        setElegidoPor((prev) => ({ ...iniciales, ...prev }));
        setAceptaEfectivoPor(mapEfectivo);
      })
      .catch(() => {});
  }, [cocinerasEnCarrito.length]);

  // desglose en el SERVIDOR (impuesto por categoría tributaria de cada plato)
  useEffect(() => {
    if (items.length === 0) {
      setDesglose(null);
      return;
    }
    const controlador = new AbortController();
    fetch("/api/desglose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ platoId: i.platoId, cantidad: i.cantidad })) }),
      signal: controlador.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setDesglose(d);
      })
      .catch(() => {});
    return () => controlador.abort();
  }, [firmaItems]);

  const subtotal = useMemo(
    () => Math.round(items.reduce((a, i) => a + i.precio * i.cantidad, 0) * 100) / 100,
    [items]
  );
  const total = desglose?.total ?? subtotal;

  const efectivoValido =
    metodoPago === "tarjeta" ||
    (tipoEntrega === "recogida" && items.every((i) => aceptaEfectivoPor[i.cocineraId]));

  const registrarCliente = async (): Promise<string | null> => {
    if (!regNombre.trim() || !regTelefono.trim()) {
      toast({
        title: "Falta tu contacto",
        description: "Escribe tu nombre y teléfono para crear tu cuenta al pagar.",
        variant: "destructive",
      });
      return null;
    }
    const r = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: regNombre, telefono: regTelefono, correo: regCorreo || undefined }),
    });
    const d = await r.json();
    if (!r.ok) {
      toast({ title: "No se pudo crear tu cuenta", description: d.error, variant: "destructive" });
      return null;
    }
    setClienteDemo(d.cliente.id, d.cliente.nombre);
    avisar(d.mensaje ?? "Cuenta creada");
    return d.cliente.id as string;
  };

  const enviar = async () => {
    if (tipoEntrega === "entrega_cocinera" && direccion.trim().length < 10) {
      toast({
        title: "Falta la dirección",
        description: "Escribe la dirección donde recibes tu pedido.",
        variant: "destructive",
      });
      return;
    }
    for (const c of cocinerasEnCarrito) {
      if (!elegidoPor[c.id]) {
        toast({
          title: "Elige el día de cocina",
          description: `Falta elegir el día para tu pedido con ${c.nombre}.`,
          variant: "destructive",
        });
        return;
      }
    }
    setEnviando(true);
    try {
      // RF-U01: el registro ocurre al confirmar el primer pedido
      let idCliente = clienteId;
      if (!idCliente) {
        idCliente = await registrarCliente();
        if (!idCliente) return;
      }
      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: idCliente,
          items: items.map((i) => ({ platoId: i.platoId, cantidad: i.cantidad })),
          tipoEntrega,
          direccionEntrega: tipoEntrega === "entrega_cocinera" ? direccion : undefined,
          zona: "Northside",
          metodoPago: efectivoValido ? metodoPago : "tarjeta",
          fechaEntrega: elegidoPor[cocinerasEnCarrito[0].id],
          fechaEntregaPor: Object.fromEntries(
            cocinerasEnCarrito.map((c) => [c.id, elegidoPor[c.id]])
          ),
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast({ title: "No se pudo crear el pedido", description: d.error, variant: "destructive" });
        return;
      }
      vaciar();
      avisar(d.mensaje ?? "Pedido creado");
      const primero = d.pedidos?.[0];
      if (primero) {
        setSeguimiento(primero.id);
        setVistaCliente("pedidos");
        toast({
          title: "¡Pedido enviado!",
          description: `Tu código de cierre es ${primero.codigoCierre}. Guárdalo para recibir.`,
        });
      }
    } finally {
      setEnviando(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-card p-10 text-center">
        <ShoppingBasket className="mx-auto size-12 text-primary/40" />
        <p className="mt-3 font-display text-xl font-bold">Tu canasta está vacía</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Recorre el catálogo y antójate de algo rico de tu barrio.
        </p>
        <Button
          className="mt-4 min-h-11 rounded-full bg-primary px-6 font-bold hover:bg-primary/90"
          onClick={() => setVistaCliente("inicio")}
        >
          Ver catálogo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Tu canasta</h1>

      {!clienteId && (
        <section className="space-y-3 rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-display text-lg font-bold">Crea tu cuenta al pedir</h2>
          <p className="text-sm text-muted-foreground">
            Solo pedimos lo mínimo para entregarte: nombre y teléfono. Se registra
            al confirmar tu primer pedido (RF-U01).
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-nombre">Nombre *</Label>
              <Input id="c-nombre" value={regNombre} onChange={(e) => setRegNombre(e.target.value)} placeholder="Tu nombre" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-tel">Teléfono *</Label>
              <Input id="c-tel" value={regTelefono} onChange={(e) => setRegTelefono(e.target.value)} placeholder="+1 817 …" inputMode="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-correo">Correo (opcional)</Label>
              <Input id="c-correo" type="email" value={regCorreo} onChange={(e) => setRegCorreo(e.target.value)} placeholder="tucorreo@ejemplo.com" />
            </div>
          </div>
        </section>
      )}

      {/* items agrupados por cocinera */}
      {cocinerasEnCarrito.map((c) => (
        <section key={c.id} className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="border-b bg-secondary/60 px-4 py-2 text-sm font-bold">
            De la cocina de {c.nombre}
          </div>
          <ul className="divide-y divide-border">
            {items
              .filter((i) => i.cocineraId === c.id)
              .map((i) => (
                <li key={i.platoId} className="flex items-center gap-3 p-3">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {i.fotoUrl && <Image src={i.fotoUrl} alt="" fill className="object-cover" sizes="56px" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{i.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatoDinero(i.precio)} c/u · {formatoDinero(i.precio * i.cantidad)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-10 rounded-full"
                      aria-label="Quitar uno"
                      onClick={() => cambiarCantidad(i.platoId, -1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-sm font-bold">{i.cantidad}</span>
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-10 rounded-full"
                      aria-label="Agregar uno"
                      onClick={() => cambiarCantidad(i.platoId, 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-10 rounded-full text-destructive hover:bg-destructive/10"
                      aria-label="Eliminar"
                      onClick={() => quitar(i.platoId)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ))}

      {/* día de cocina por cocinera (RF-C07 / RF-U04) */}
      {cocinerasEnCarrito.some((c) => (opcionesPor[c.id] ?? []).length > 0) && (
        <section className="space-y-3 rounded-3xl border border-border bg-card p-5">
          <h2 className="font-display text-lg font-bold">¿Para qué día lo cocinamos?</h2>
          {cocinerasEnCarrito.map((c) => {
            const opciones = opcionesPor[c.id] ?? [];
            if (opciones.length === 0) return null;
            const hoy = new Date().toISOString().slice(0, 10);
            const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
            return (
              <div key={c.id} className="space-y-2">
                <p className="text-sm font-semibold">
                  Con {c.nombre}{" "}
                  <span className="font-normal text-muted-foreground">· hora de corte incluida</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opciones.map((a) => {
                    const activa = elegidoPor[c.id] === a.fecha;
                    const pasado = pasoHoraCorte(a.horaCorte, a.fecha);
                    const etiqueta =
                      a.fecha === hoy ? "Hoy" : a.fecha === manana ? "Mañana" : diaSemana(a.fecha);
                    return (
                      <button
                        key={a.id}
                        onClick={() => setElegidoPor((prev) => ({ ...prev, [c.id]: a.fecha }))}
                        disabled={pasado}
                        className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                          activa
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-card text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {etiqueta} · corte {formatoHora(a.horaCorte)}
                        {pasado ? " (pasó)" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Encarga antes de la hora de corte de cada cocinera. Después de esa hora, su cocina del
            día queda cerrada.
          </p>
        </section>
      )}

      {/* entrega y pago */}
      <section className="space-y-4 rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold">¿Cómo lo recibes?</h2>
        <RadioGroup
          value={tipoEntrega}
          onValueChange={(v) => setTipoEntrega(v as "entrega_cocinera" | "recogida")}
          className="gap-3"
        >
          <div className="flex items-start gap-3 rounded-2xl border p-3 has-[button[data-state=checked]]:border-primary">
            <RadioGroupItem value="entrega_cocinera" id="entrega" className="mt-0.5" />
            <div>
              <Label htmlFor="entrega" className="font-bold">
                Entrega a domicilio
              </Label>
              <p className="text-xs text-muted-foreground">
                La cocinera te lo lleva personalmente y sigues su pedido paso a paso en la app.
              </p>
              {tipoEntrega === "entrega_cocinera" && (
                <div className="mt-2">
                  <Input
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Calle y número, colonia, ciudad"
                    aria-label="Dirección de entrega"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border p-3 has-[button[data-state=checked]]:border-primary">
            <RadioGroupItem value="recogida" id="recogida" className="mt-0.5" />
            <div>
              <Label htmlFor="recogida" className="font-bold">
                Recoger en su casa
              </Label>
              <p className="text-xs text-muted-foreground">
                Te llega el punto de encuentro al confirmar la cocinera.
              </p>
            </div>
          </div>
        </RadioGroup>

        <Separator />

        <h2 className="font-display text-lg font-bold">¿Cómo pagas?</h2>
        <RadioGroup
          value={metodoPago}
          onValueChange={(v) => setMetodoPago(v as "tarjeta" | "efectivo")}
          className="gap-3"
        >
          <div className="flex items-start gap-3 rounded-2xl border p-3 has-[button[data-state=checked]]:border-primary">
            <RadioGroupItem value="tarjeta" id="tarjeta" className="mt-0.5" />
            <div>
              <Label htmlFor="tarjeta" className="font-bold">
                Tarjeta (pago ahora)
              </Label>
              <p className="text-xs text-muted-foreground">
                Pago protegido. Tus datos los procesa el banco, nunca los tocamos.
              </p>
            </div>
          </div>
          <div className={`flex items-start gap-3 rounded-2xl border p-3 ${tipoEntrega !== "recogida" || !items.every((i) => aceptaEfectivoPor[i.cocineraId]) ? "opacity-50" : ""}`}>
            <RadioGroupItem
              value="efectivo"
              id="efectivo"
              disabled={tipoEntrega !== "recogida" || !items.every((i) => aceptaEfectivoPor[i.cocineraId])}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="efectivo" className="font-bold flex items-center gap-2">
                Efectivo al recoger <Wallet className="size-4" />
              </Label>
              <p className="text-xs text-muted-foreground">
                Solo para recogida y si la cocinera lo acepta.
              </p>
            </div>
          </div>
        </RadioGroup>

        <Separator />

        {/* RF-U04: desglose transparente antes de pagar. El impuesto lo calcula
            el servidor por plato (exentos no pagan); mientras la tasa real por
            dirección no exista, la línea va rotulada «Impuesto estimado». */}
        <div className="space-y-1.5 text-sm">
          <p className="font-display text-base font-bold">Antes de pagar, lo ves claro:</p>
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold">{formatoDinero(desglose?.subtotal ?? subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Impuesto estimado</span>
            <span>{desglose ? formatoDinero(desglose.impuestoEstimado) : "calculando…"}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Cargo de servicio</span>
            <span className="font-semibold text-green-700">Ninguno</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span className="text-primary">{formatoDinero(total)}</span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            El precio del plato es el precio. Sin cargos sorpresa: pagas el
            subtotal y el impuesto estimado, nada más.
          </p>
        </div>

        <Button
          disabled={enviando || !efectivoValido}
          onClick={enviar}
          className="h-12 w-full rounded-full bg-primary text-base font-bold hover:bg-primary/90"
        >
          {enviando ? "Enviando pedido…" : `Pedir por ${formatoDinero(total)}`}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          La cocinera confirma tu pedido y te avisamos en la aplicación en cada paso.
        </p>
      </section>
    </div>
  );
}

function diaSemana(fecha: string): string {
  const s = new Date(fecha + "T12:00:00").toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
