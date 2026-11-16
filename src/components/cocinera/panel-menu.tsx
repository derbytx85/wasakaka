"use client";

import { useState } from "react";
import Image from "next/image";
import type { CocineraPanel } from "@/components/cocinera/vista-cocinera";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ALERGENOS_PERMITIDOS, CATEGORIA_LABEL, CATEGORIAS_PERMITIDAS } from "@/lib/cumplimiento";
import { formatoDinero } from "@/lib/dinero";
import { toast } from "@/hooks/use-toast";
import { Plus, Printer, Tag, Trash2 } from "lucide-react";

// Menú de la cocinera (RF-C03/C04/C05): editor con cumplimiento forzado en
// el servidor + etiquetas imprimibles (RF-C06).

interface Violacion {
  ingrediente: string;
  explicacion: string;
}

export function PanelMenu({ panel, recargar }: { panel: CocineraPanel; recargar: () => void }) {
  const [platoEditando, setPlatoEditando] = useState<CocineraPanel["platos"][number] | "nuevo" | null>(
    null
  );

  const imprimirEtiquetas = async (platosIds: string[]) => {
    const r = await fetch(
      `/api/etiquetas?cocineraId=${panel.cocinera.id}&platos=${platosIds.join(",")}`
    );
    const d = await r.json();
    if (!r.ok || !d.etiquetas?.length) {
      toast({ title: "Sin etiquetas", description: d.error ?? "Activa y publica al menos un plato.", variant: "destructive" });
      return;
    }
    const html = construirHTML(d.etiquetas);
    const v = window.open("", "_blank", "width=800,height=900");
    v?.document.write(html);
    v?.document.close();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          className="flex-1 rounded-full bg-primary font-bold hover:bg-primary/90"
          onClick={() => setPlatoEditando("nuevo")}
        >
          <Plus className="size-4" /> Nuevo plato
        </Button>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => imprimirEtiquetas(panel.platos.filter((p) => p.activo).map((p) => p.id))}
        >
          <Printer className="size-4" /> Descargar etiquetas
        </Button>
      </div>

      {panel.platos.length === 0 && (
        <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center">
          <Tag className="mx-auto size-10 text-primary/40" />
          <p className="mt-2 font-bold">Tu menú está vacío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea tu primer plato. Te pediremos ingredientes y alérgenos: la ley
            los exige y tus vecinos te lo agradecerán.
          </p>
        </div>
      )}

      <ul className="space-y-2.5">
        {panel.platos.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-3 rounded-3xl border border-border bg-card p-3 shadow-sm"
          >
            <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-secondary">
              {p.fotoUrl && <Image src={p.fotoUrl} alt="" fill className="object-cover" sizes="64px" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-bold">{p.nombre}</p>
                {p.esTcs && <Badge variant="secondary" className="text-[10px]">❄️ TCS</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                {CATEGORIA_LABEL[p.categoria]} · {formatoDinero(p.precio)}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {p.alergenos.length > 0 ? p.alergenos.join(" · ") : "Sin alérgenos declarados"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={p.activo}
                  aria-label={p.activo ? "Pausar plato" : "Publicar plato"}
                  onCheckedChange={async (activo) => {
                    const r = await fetch(`/api/platos/${p.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ activo }),
                    });
                    const d = await r.json();
                    if (!r.ok) {
                      mostrarViolaciones(d.violaciones ?? [], d.error);
                    }
                    recargar();
                  }}
                />
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {p.activo ? "publicado" : "pausado"}
                </span>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-7" aria-label="Editar" onClick={() => setPlatoEditando(p)}>
                  ✏️
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  aria-label="Eliminar"
                  onClick={async () => {
                    const r = await fetch(`/api/platos/${p.id}`, { method: "DELETE" });
                    const d = await r.json();
                    toast({ title: d.notificacion ?? "Listo", description: d.mensaje });
                    recargar();
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {platoEditando && (
        <EditorPlato
          panel={panel}
          plato={platoEditando === "nuevo" ? null : platoEditando}
          alCerrar={(huboCambios) => {
            setPlatoEditando(null);
            if (huboCambios) recargar();
          }}
          alImprimir={(platoId) => imprimirEtiquetas([platoId])}
        />
      )}
    </div>
  );
}

function mostrarViolaciones(violaciones: Violacion[], error: string) {
  toast({
    title: "No se puede publicar",
    description: [
      error,
      ...violaciones.map((v) => `• ${v.ingrediente}: ${v.explicacion}`),
    ].join("\n"),
    variant: "destructive",
    duration: 8000,
  });
}

function EditorPlato({
  panel,
  plato,
  alCerrar,
  alImprimir,
}: {
  panel: CocineraPanel;
  plato: CocineraPanel["platos"][number] | null;
  alCerrar: (huboCambios: boolean) => void;
  alImprimir: (platoId: string) => void;
}) {
  const [nombre, setNombre] = useState(plato?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(plato?.descripcion ?? "");
  const [precio, setPrecio] = useState(plato?.precio.toString() ?? "");
  const [categoria, setCategoria] = useState(plato?.categoria ?? "panaderia");
  const [esTcs, setEsTcs] = useState(plato?.esTcs ?? false);
  const [ingredientes, setIngredientes] = useState(plato?.ingredientes ?? "");
  const [alergenos, setAlergenos] = useState<string[]>(plato?.alergenos ?? []);
  const [enviando, setEnviando] = useState(false);
  const [creadoId, setCreadoId] = useState<string | null>(plato?.id ?? null);

  const guardar = async (activar: boolean) => {
    setEnviando(true);
    try {
      const cuerpo = {
        cocineraId: panel.cocinera.id,
        nombre,
        descripcion,
        precio: Number(precio),
        categoria,
        esTcs,
        ingredientes,
        alergenos,
        activarAhora: activar,
      };
      const res = creadoId
        ? await fetch(`/api/platos/${creadoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...cuerpo, activo: activar }),
          })
        : await fetch("/api/platos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(cuerpo),
          });
      const d = await res.json();
      if (!res.ok) {
        mostrarViolaciones(d.violaciones ?? [], d.error);
        return;
      }
      if (d.mensajes?.length) {
        toast({ title: "Guardado con avisos", description: d.mensajes.join(" ") });
      } else {
        toast({ title: d.notificacion ?? "Plato guardado" });
      }
      if (d.plato?.id) setCreadoId(d.plato.id);
      if (activar && d.plato?.id) alImprimir(d.plato.id);
      alCerrar(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && alCerrar(false)}>
      <DialogContent className="max-h-[88vh] rounded-2xl p-0">
        <ScrollArea className="max-h-[88vh]">
          <div className="space-y-4 p-5">
            <DialogHeader className="text-left">
              <DialogTitle className="text-primary">
                {plato ? "Editar plato" : "Nuevo plato"}
              </DialogTitle>
              <DialogDescription>
                Campos obligatorios: nombre, descripción, precio, ingredientes y
                alérgenos. Sin ellos, el plato no se puede publicar (RF-C03).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="p-nombre">Nombre del plato *</Label>
              <Input id="p-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Conchas artesanales (4 pzas)" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-desc">Descripción *</Label>
              <Textarea id="p-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Cómo lo haces, qué lo hace especial" className="min-h-16" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-precio">Precio en dólares *</Label>
              <Input id="p-precio" value={precio} onChange={(e) => setPrecio(e.target.value.replace(/[^\d.]/g, ""))} placeholder="6.00" inputMode="decimal" />
            </div>

            <div className="space-y-1.5">
              <Label>Categoría (lista cerrada de la ley) *</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS_PERMITIDAS.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoria(cat)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      categoria === cat
                        ? "border-primary bg-primary text-white"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {CATEGORIA_LABEL[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 rounded-2xl bg-secondary/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">¿Refrigerado TCS?</p>
                  <p className="text-xs text-muted-foreground">
                    Alimentos que exigen control de tiempo y temperatura (flan,
                    tamales de olla, crema pastelera…). Necesitas registro del
                    DSHS.
                  </p>
                </div>
                <Switch checked={esTcs} onCheckedChange={setEsTcs} />
              </div>
              {esTcs && !panel.cocinera.vendeTcs && (
                <p className="rounded-xl bg-red-50 p-2 text-xs text-red-700">
                  Tu cuenta no tiene registro DSHS activo: con TCS activado, el
                  sistema bloqueará este plato.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="p-ing">Ingredientes (completos, en orden) *</Label>
              <Textarea id="p-ing" value={ingredientes} onChange={(e) => setIngredientes(e.target.value)} placeholder="Harina de trigo, azúcar, mantequilla…" className="min-h-16" />
            </div>

            <div className="space-y-1.5">
              <Label>Alérgenos principales *</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALERGENOS_PERMITIDOS.map((a) => (
                  <button
                    key={a}
                    onClick={() =>
                      setAlergenos((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))
                    }
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      alergenos.includes(a)
                        ? "border-amber-400 bg-amber-100 text-amber-900"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Si no tiene ninguno, deja vacío el campo: se publicará como «sin
                alérgenos principales declarados».
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button disabled={enviando} variant="outline" className="flex-1 rounded-full" onClick={() => guardar(false)}>
                Guardar como borrador
              </Button>
              <Button disabled={enviando} className="flex-1 rounded-full bg-primary font-bold hover:bg-primary/90" onClick={() => guardar(true)}>
                {enviando ? "Revisando…" : "Publicar (revisa la ley)"}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Al publicar, el motor de cumplimiento del servidor revisa la ley de
              comida casera. Si algo no se puede vender, te explicamos por qué.
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// RF-C06: hoja de etiquetas imprimible en casa (hojas estándar de etiquetas)
function construirHTML(etiquetas: {
  nombre: string;
  ingredientes: string;
  alergenos: string[];
  esTcs: boolean;
  fechaElaboracion: string;
  instrucciones: string | null;
  origenLegal: string;
  fraseLegal: string;
}[]): string {
  const tarjetas = etiquetas
    .map(
      (e) => `
      <div class="etiqueta">
        <p class="nombre">${e.nombre}</p>
        <p class="origen">${e.origenLegal}</p>
        <p><strong>Ingredientes:</strong> ${e.ingredientes}</p>
        <p><strong>Alérgenos:</strong> ${e.alergenos.length ? e.alergenos.join(", ") : "no contiene los principales"}</p>
        ${e.esTcs ? `<p><strong>Fecha de elaboración:</strong> ${e.fechaElaboracion}</p><p class="tcs">${e.instrucciones}</p>` : ""}
        <p class="legal">${e.fraseLegal}</p>
      </div>`
    )
    .join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas Wasakaka</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    h1 { font-size: 18px; }
    .etiqueta { border: 1.5px dashed #999; border-radius: 8px; padding: 10px; margin-bottom: 10px; font-size: 11px; line-height: 1.45; page-break-inside: avoid; }
    .nombre { font-weight: bold; font-size: 14px; margin: 0; }
    .origen { color: #555; margin: 2px 0 6px; }
    .legal { margin-top: 6px; font-style: italic; color: #444; }
    .tcs { font-weight: bold; }
    @media print { body { margin: 8mm; } }
  </style></head><body>
  <h1>Wasakaka · Etiquetas para imprimir en casa</h1>
  <p>Imprime, recorta y pega en cada empaque. Conserva la frase legal y los alérgenos visibles.</p>
  ${tarjetas}
  <script>window.onload = () => window.print();</script>
  </body></html>`;
}
