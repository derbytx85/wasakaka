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
