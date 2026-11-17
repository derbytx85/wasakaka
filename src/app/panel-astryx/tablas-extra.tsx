"use client";

// Tablas secundarias del panel Astryx: incidentes abiertos y cocineras
// esperando aprobación, con el cumplimiento (tarjeta de manipulador y
// registro DSHS) convertido en insignias legibles de un vistazo.
// Los datos llegan calculados desde el servidor; aquí no se decide nada.
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { Badge } from "@astryxdesign/core/Badge";

type VarianteBadge =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "teal";

export interface FilaIncidente extends Record<string, unknown> {
  id: string;
  fecha: string;
  cocinera: string;
  tipo: string;
  descripcion: string;
  estado: string;
}

const TIPOS: Record<string, { variant: VarianteBadge; etiqueta: string }> = {
  salud: { variant: "error", etiqueta: "Salud" },
  calidad: { variant: "warning", etiqueta: "Calidad" },
  otro: { variant: "neutral", etiqueta: "Otro" },
};

const ESTADOS_INCIDENTE: Record<
  string,
  { variant: VarianteBadge; etiqueta: string }
> = {
  abierto: { variant: "error", etiqueta: "Abierto" },
  en_proceso: { variant: "info", etiqueta: "En proceso" },
};

export function TablaIncidentes({ filas }: { filas: FilaIncidente[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      hasHover
      columns={[
        { key: "fecha", header: "Fecha", width: pixel(130) },
        {
          key: "cocinera",
          header: "Cocinera",
          width: proportional(1, { minWidth: 140 }),
        },
        {
          key: "tipo",
          header: "Tipo",
          width: pixel(110),
          renderCell: (f) => {
            const t = TIPOS[f.tipo] ?? {
              variant: "neutral" as const,
              etiqueta: f.tipo,
            };
            return <Badge variant={t.variant} label={t.etiqueta} />;
          },
        },
        {
          key: "descripcion",
          header: "Descripción",
          width: proportional(2, { minWidth: 200 }),
        },
        {
          key: "estado",
          header: "Estado",
          width: pixel(130),
          renderCell: (f) => {
            const e = ESTADOS_INCIDENTE[f.estado] ?? {
              variant: "neutral" as const,
              etiqueta: f.estado,
            };
            return <Badge variant={e.variant} label={e.etiqueta} />;
          },
        },
      ]}
    />
  );
}

export interface FilaAprobacion extends Record<string, unknown> {
  id: string;
  nombre: string;
  desde: string;
  plan: string;
  tarjetaNivel: string; // ok | aviso | critico | vencida | sin_tarjeta
  vendeTcs: boolean;
  tieneDshs: boolean;
}

const TARJETA: Record<string, { variant: VarianteBadge; etiqueta: string }> = {
  ok: { variant: "success", etiqueta: "Tarjeta al día" },
  aviso: { variant: "warning", etiqueta: "Tarjeta por vencer" },
  critico: { variant: "error", etiqueta: "Tarjeta vence ya" },
  vencida: { variant: "error", etiqueta: "Tarjeta vencida" },
  sin_tarjeta: { variant: "error", etiqueta: "Sin tarjeta" },
};

export function TablaAprobaciones({ filas }: { filas: FilaAprobacion[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      hasHover
      columns={[
        {
          key: "nombre",
          header: "Cocinera",
          width: proportional(1, { minWidth: 160 }),
        },
        { key: "desde", header: "Espera desde", width: pixel(120) },
        {
          key: "plan",
          header: "Plan",
          width: pixel(120),
          renderCell: (f) => (
            <Badge
              variant={f.plan === "fundadora" ? "teal" : "neutral"}
              label={f.plan === "fundadora" ? "Fundadora" : "Regular"}
            />
          ),
        },
        {
          key: "tarjetaNivel",
          header: "Manipulador de alimentos",
          width: pixel(170),
          renderCell: (f) => {
            const t = TARJETA[f.tarjetaNivel] ?? {
              variant: "neutral" as const,
              etiqueta: f.tarjetaNivel,
            };
            return <Badge variant={t.variant} label={t.etiqueta} />;
          },
        },
        {
          key: "tieneDshs",
          header: "Registro DSHS",
          width: pixel(150),
          renderCell: (f) => {
            if (f.tieneDshs)
              return <Badge variant="success" label="Registrada" />;
            if (!f.vendeTcs)
              return <Badge variant="neutral" label="No vende TCS" />;
            return <Badge variant="error" label="Falta registro" />;
          },
        },
      ]}
    />
  );
}

export interface FilaPlatoRevisar extends Record<string, unknown> {
  id: string;
  nombre: string;
  cocinera: string;
  categoria: string;
  ingredientes: string;
  activo: boolean;
}

// Platos de cocineras nuevas (primeros 30 días): la segunda capa de revisión
// contra categorías prohibidas por la ley de comida casera de Texas.
export function TablaPlatosRevisar({ filas }: { filas: FilaPlatoRevisar[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      hasHover
      columns={[
        {
          key: "nombre",
          header: "Plato",
          width: proportional(1, { minWidth: 160 }),
        },
        {
          key: "cocinera",
          header: "Cocinera",
          width: proportional(1, { minWidth: 140 }),
        },
        {
          key: "categoria",
          header: "Categoría",
          width: pixel(130),
        },
        {
          key: "ingredientes",
          header: "Ingredientes",
          width: proportional(2, { minWidth: 220 }),
        },
        {
          key: "activo",
          header: "Publicación",
          width: pixel(130),
          renderCell: (f) =>
            f.activo ? (
              <Badge variant="success" label="Publicado" />
            ) : (
              <Badge variant="neutral" label="En pausa" />
            ),
        },
      ]}
    />
  );
}

export interface FilaConciliacion extends Record<string, unknown> {
  id: string;
  concepto: string;
  detalle: string;
  monto: string;
}

// Conciliación del mes (RF-P07): el dinero separado por naturaleza —
// ventas, comisión, costos, margen y el impuesto que NO es ingreso.
export function TablaConciliacion({ filas }: { filas: FilaConciliacion[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      columns={[
        {
          key: "concepto",
          header: "Concepto",
          width: proportional(1, { minWidth: 180 }),
        },
        {
          key: "detalle",
          header: "Detalle",
          width: proportional(2, { minWidth: 220 }),
        },
        { key: "monto", header: "Monto", width: pixel(120), align: "end" },
      ]}
    />
  );
}

export interface FilaZona extends Record<string, unknown> {
  id: string;
  zona: string;
  pedidos: string;
  total: string;
}

export function TablaZonas({ filas }: { filas: FilaZona[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      hasHover
      columns={[
        {
          key: "zona",
          header: "Barrio",
          width: proportional(1, { minWidth: 140 }),
        },
        { key: "pedidos", header: "Pedidos", width: pixel(100), align: "end" },
        { key: "total", header: "Ventas", width: pixel(120), align: "end" },
      ]}
    />
  );
}
