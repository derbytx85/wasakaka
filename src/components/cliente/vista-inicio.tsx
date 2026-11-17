"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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
import { CATEGORIA_LABEL, ALERGENOS_PERMITIDOS } from "@/lib/cumplimiento";
import { formatoDinero, formatoHora } from "@/lib/dinero";
import { Clock, MapPin, Plus, Search, Star, UtensilsCrossed, Snowflake, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";

interface PlatoCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  esTcs: boolean;
  ingredientes: string;
  alergenos: string[];
  fotoUrl: string | null;
}

interface CocineraCatalogo {
  id: string;
  nombre: string;
  zona: string | null;
  bio: string | null;
  fotoUrl: string | null;
  radioEntregaKm: number;
  aceptaEfectivo: boolean;
  calificacionPromedio: number | null;
  totalResenas: number;
  agendas: { id: string; fecha: string; horaCorte: string; capacidadPedidos: number }[];
  platos: PlatoCatalogo[];
}

function etiquetaDia(fecha: string): string {
  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (fecha === hoy) return "hoy";
  if (fecha === manana) return "mañana";
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-US", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export function VistaCliente() {
  const [cocineras, setCocineras] = useState<CocineraCatalogo[] | null>(null);
  const [zonas, setZonas] = useState<string[]>([]);
  const [zona, setZona] = useState("todas");
  const [categoria, setCategoria] = useState("todas");
  const [dia, setDia] = useState("todos");
  const [alergenosEvitar, setAlergenosEvitar] = useState<string[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [platoDetalle, setPlatoDetalle] = useState<{
    plato: PlatoCatalogo;
    cocinera: CocineraCatalogo;
  } | null>(null);

  const { agregar, avisar } = useWasakaka();

  useEffect(() => {
    const params = new URLSearchParams({ zona, categoria, dia });
    if (alergenosEvitar.length > 0) params.set("alergenos", alergenosEvitar.join(","));
    setCocineras(null);
    fetch(`/api/catalogo?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setCocineras(d.cocineras ?? []);
        if (d.zonas?.length) setZonas(d.zonas);
      })
      .catch(() => {
        setCocineras([]);
        avisar("No pudimos cargar el catálogo. Revisa tu conexión.");
      });
  }, [zona, categoria, dia, alergenosEvitar]);

  const cocinerasFiltradas = useMemo(() => {
    if (!cocineras) return [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return cocineras;
    return cocineras
      .map((c) => ({
        ...c,
        platos: c.platos.filter(
          (p) =>
            p.nombre.toLowerCase().includes(q) ||
            p.descripcion.toLowerCase().includes(q) ||
            p.ingredientes.toLowerCase().includes(q)
        ),
      }))
      .filter((c) => c.platos.length > 0);
  }, [cocineras, busqueda]);

  const diasDisponibles = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return [
      { valor: "todos", etiqueta: "Todos los días" },
      { valor: hoy, etiqueta: "Hoy" },
      { valor: manana, etiqueta: "Mañana" },
    ];
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg">
        {cocineras && cocineras.length > 0 && (
          <div className="absolute inset-0 opacity-25">
            <Image
              src="/img/hero.png"
              alt=""
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}
        <div className="relative patron-mantel px-5 py-6">
          <h1 className="font-display text-2xl font-bold leading-snug">
            El sabor de casa, hecho por tu vecina
          </h1>
          <p className="mt-1 max-w-md text-sm opacity-90">
            Panadería, repostería y antojos latinos hechos en casa, bajo la ley
            de comida casera de Texas. Encarga hoy, recoge o recibe mañana.
          </p>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca conchas, flan, tamales…"
              className="h-10 rounded-full border-none bg-white/90 pl-9 text-foreground placeholder:text-foreground/40"
            />
          </div>
        </div>
      </section>

      {/* Filtros (RF-U02) */}
      <section className="space-y-2" aria-label="Filtros del catálogo">
        <div className="flex gap-2 overflow-x-auto pb-1 scroll-lindo desvanecer-bordes">
          <Pill activa={zona === "todas"} onClick={() => setZona("todas")}>
            <MapPin className="size-3.5" /> Todos los barrios
          </Pill>
          {zonas.map((z) => (
            <Pill key={z} activa={zona === z} onClick={() => setZona(z)}>
              <MapPin className="size-3.5" /> {z}
            </Pill>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scroll-lindo desvanecer-bordes">
          <Pill activa={categoria === "todas"} onClick={() => setCategoria("todas")}>
            <UtensilsCrossed className="size-3.5" /> Todo
          </Pill>
          {Object.entries(CATEGORIA_LABEL).map(([valor, etiqueta]) => (
            <Pill key={valor} activa={categoria === valor} onClick={() => setCategoria(valor)}>
              {etiqueta}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Evito:</span>
          {ALERGENOS_PERMITIDOS.map((a) => (
            <button
              key={a}
              onClick={() =>
                setAlergenosEvitar((prev) =>
                  prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                )
              }
              className={`flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors ${
                alergenosEvitar.includes(a)
                  ? "border-destructive bg-destructive text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {alergenosEvitar.includes(a) && <X className="size-3.5" aria-hidden />}
              {a}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {diasDisponibles.map((d) => (
            <button
              key={d.valor}
              onClick={() => setDia(d.valor)}
              className={`min-h-10 rounded-full border px-3 text-sm font-medium transition-colors ${
                dia === d.valor
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary"
              }`}
            >
              {d.etiqueta}
            </button>
          ))}
        </div>
      </section>

      {/* Catálogo */}
      {!cocineras && <EsqueletoCatalogo />}

      {cocineras && cocinerasFiltradas.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-3xl">🍽️</p>
          <p className="mt-2 font-bold">Todavía no hay platos con esos filtros</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Prueba otro barrio, quita alérgenos o cambia el día de cocina.
          </p>
        </div>
      )}

      {cocinerasFiltradas.map((c) => (
        <section key={c.id} className="space-y-3">
          <div className="flex items-center gap-3">
            {/* RF-U: la cocinera tiene cara — foto real o iniciales sobre el color primario */}
            {c.fotoUrl ? (
              <div className="relative size-11 shrink-0 overflow-hidden rounded-2xl">
                <Image
                  src={c.fotoUrl}
                  alt={`Retrato de ${c.nombre}`}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              </div>
            ) : (
              <div
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground"
              >
                {iniciales(c.nombre)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-display text-lg font-bold">{c.nombre}</h2>
                {c.calificacionPromedio !== null && (
                  <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                    <Star className="size-3 fill-yellow-600 text-yellow-600" />
                    {c.calificacionPromedio} ({c.totalResenas})
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {c.zona} · entrega a {c.radioEntregaKm} km a la redonda
                {c.aceptaEfectivo ? " · acepta efectivo en recogida" : ""}
              </p>
              {c.agendas.length > 0 && (
                <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-primary">
                  <Clock className="size-3.5" />
                  Encarga hasta las {formatoHora(c.agendas[0].horaCorte)} para entrega{" "}
                  {etiquetaDia(c.agendas[0].fecha)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {c.platos.map((p) => (
              <TarjetaPlato
                key={p.id}
                plato={p}
                cocinera={c}
                onDetalle={() => setPlatoDetalle({ plato: p, cocinera: c })}
                onAgregar={() => {
                  agregar({
                    platoId: p.id,
                    cocineraId: c.id,
                    cocineraNombre: c.nombre,
                    nombre: p.nombre,
                    precio: p.precio,
                    cantidad: 1,
                    fotoUrl: p.fotoUrl,
                  });
                  avisar(`${p.nombre} se agregó a tu pedido`);
                }}
              />
            ))}
          </div>
        </section>
      ))}

      <Dialog open={!!platoDetalle} onOpenChange={(o) => !o && setPlatoDetalle(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl p-0 scroll-lindo">
          {platoDetalle && (
            <>
              <div className="relative h-52 w-full">
                {platoDetalle.plato.fotoUrl && (
                  <Image
                    src={platoDetalle.plato.fotoUrl}
                    alt={platoDetalle.plato.nombre}
                    fill
                    className="rounded-t-2xl object-cover"
                    sizes="(max-width: 768px) 100vw, 448px"
                  />
                )}
              </div>
              <div className="space-y-4 p-5">
                <DialogHeader className="space-y-1 text-left">
                  <DialogTitle className="font-display text-xl text-foreground">
                    {platoDetalle.plato.nombre}
                  </DialogTitle>
                  <DialogDescription>{platoDetalle.plato.descripcion}</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-secondary text-secondary-foreground">
                    {CATEGORIA_LABEL[platoDetalle.plato.categoria]}
                  </Badge>
                  {platoDetalle.plato.esTcs && (
                    <Badge className="bg-blue-100 text-blue-800" variant="secondary">
                      Refrigerado · requiere DSHS
                    </Badge>
                  )}
                </div>

                {/* RF-U02: ingredientes y alérgenos SIEMPRE visibles, nunca escondidos */}
                <div className="rounded-2xl bg-secondary/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Ingredientes
                  </p>
                  <p className="mt-1 text-sm">{platoDetalle.plato.ingredientes}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Alérgenos
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {platoDetalle.plato.alergenos.length > 0 ? (
                      platoDetalle.plato.alergenos.map((a) => (
                        <Badge key={a} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                          {a}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Sin alérgenos principales declarados
                      </span>
                    )}
                  </div>
                </div>

                {platoDetalle.cocinera.agendas.length > 0 && (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <Clock className="size-4" />
                    Encarga hasta las {formatoHora(platoDetalle.cocinera.agendas[0].horaCorte)} ·
                    entrega {etiquetaDia(platoDetalle.cocinera.agendas[0].fecha)}
                  </p>
                )}

                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-2xl font-bold text-primary">
                    {formatoDinero(platoDetalle.plato.precio)}
                  </p>
                  <Button
                    className="rounded-full bg-primary px-6 font-bold hover:bg-primary/90"
                    onClick={() => {
                      agregar({
                        platoId: platoDetalle.plato.id,
                        cocineraId: platoDetalle.cocinera.id,
                        cocineraNombre: platoDetalle.cocinera.nombre,
                        nombre: platoDetalle.plato.nombre,
                        precio: platoDetalle.plato.precio,
                        cantidad: 1,
                        fotoUrl: platoDetalle.plato.fotoUrl,
                      });
                      avisar(`${platoDetalle.plato.nombre} se agregó a tu pedido`);
                      setPlatoDetalle(null);
                    }}
                  >
                    <Plus className="size-4" /> Agregar al pedido
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || nombre.slice(0, 2).toUpperCase();
}

function Pill({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors ${
        activa
          ? "border-primary bg-primary text-white"
          : "border-border bg-card text-muted-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function TarjetaPlato({
  plato,
  cocinera,
  onDetalle,
  onAgregar,
}: {
  plato: PlatoCatalogo;
  cocinera: CocineraCatalogo;
  onDetalle: () => void;
  onAgregar: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <button onClick={onDetalle} className="block w-full text-left">
        <div className="relative h-36 w-full">
          {plato.fotoUrl && (
            <Image
              src={plato.fotoUrl}
              alt={plato.nombre}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 350px"
            />
          )}
          {plato.esTcs && (
            <Badge className="absolute left-2 top-2 gap-1 bg-white/90 text-xs text-foreground">
              <Snowflake className="size-3.5" aria-hidden /> Refrigerado
            </Badge>
          )}
        </div>
        <div className="space-y-1.5 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-base font-bold leading-tight">{plato.nombre}</h3>
            <p className="shrink-0 font-display text-lg font-bold text-primary">
              {formatoDinero(plato.precio)}
            </p>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{plato.descripcion}</p>
          {/* RF-U02: ingredientes SIEMPRE visibles — mínimo 3 líneas, nunca escondidos */}
          <p className="line-clamp-3 min-h-12 text-xs text-foreground/70">
            <span className="font-semibold">Ingredientes:</span> {plato.ingredientes}
          </p>
          <div className="flex flex-wrap gap-1">
            {plato.alergenos.slice(0, 4).map((a) => (
              <span
                key={a}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
              >
                {a}
              </span>
            ))}
          </div>
          <p className="flex items-center gap-1 text-[11px] font-semibold text-primary">
            <Clock className="size-3" />
            {cocinera.agendas.length > 0
              ? `Encarga hasta las ${formatoHora(cocinera.agendas[0].horaCorte)}`
              : "Sin días de cocina activos"}
          </p>
        </div>
      </button>
      <div className="px-4 pb-4">
        <Button
          className="min-h-11 w-full rounded-full bg-primary font-bold hover:bg-primary/90"
          onClick={onAgregar}
        >
          <Plus className="size-4" /> Agregar
        </Button>
      </div>
    </article>
  );
}

function EsqueletoCatalogo() {
  return (
    <div className="space-y-4">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-11 w-56 rounded-2xl" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
