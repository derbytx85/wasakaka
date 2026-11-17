"use client";

// Tablas de la vista previa Astryx para la cocinera: sus pedidos (con SU
// neto destacado, que es el dinero que le queda) y sus platos publicados.
// Datos ya calculados en el servidor; aquí solo se presentan.
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { Badge } from "@astryxdesign/core/Badge";

type VarianteBadge =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "blue"
  | "orange"
  | "purple"
  | "teal";

const ESTADOS: Record<string, { variant: VarianteBadge; etiqueta: string }> = {
  nuevo: { variant: "warning", etiqueta: "Nuevo" },
  confirmado: { variant: "info", etiqueta: "Confirmado" },
  en_cocina: { variant: "orange", etiqueta: "En cocina" },
  listo: { variant: "teal", etiqueta: "Listo" },
  en_entrega: { variant: "blue", etiqueta: "En entrega" },
  para_recogida: { variant: "purple", etiqueta: "Para recogida" },
  entregado: { variant: "neutral", etiqueta: "Entregado" },
  cancelado: { variant: "error", etiqueta: "Cancelado" },
};

export interface FilaPedidoCocinera extends Record<string, unknown> {
  id: string;
  fecha: string;
  cliente: string;
  total: string;
  neto: string;
  estado: string;
}

export function TablaPedidosCocinera({
  filas,
}: {
  filas: FilaPedidoCocinera[];
}) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      isStriped
      hasHover
      columns={[
        { key: "fecha", header: "Fecha", width: pixel(130) },
        {
          key: "cliente",
          header: "Cliente",
          width: proportional(1, { minWidth: 150 }),
        },
        { key: "total", header: "Total", width: pixel(96), align: "end" },
        { key: "neto", header: "Tu neto", width: pixel(96), align: "end" },
        {
          key: "estado",
          header: "Estado",
          width: pixel(150),
          renderCell: (f) => {
            const e = ESTADOS[f.estado] ?? {
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

export interface FilaPlato extends Record<string, unknown> {
  id: string;
  nombre: string;
  categoria: string;
  precio: string;
  activo: boolean;
  categoriaTributaria: string;
  esTcs: boolean;
}

export function TablaPlatos({ filas }: { filas: FilaPlato[] }) {
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
          width: proportional(2, { minWidth: 180 }),
        },
        {
          key: "categoria",
          header: "Categoría",
          width: proportional(1, { minWidth: 120 }),
        },
        { key: "precio", header: "Precio", width: pixel(96), align: "end" },
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
        {
          key: "categoriaTributaria",
          header: "Impuesto",
          width: pixel(120),
          renderCell: (f) =>
            f.categoriaTributaria === "exento" ? (
              <Badge variant="teal" label="Exento" />
            ) : (
              <Badge variant="neutral" label="Gravado" />
            ),
        },
        {
          key: "esTcs",
          header: "Conservación",
          width: pixel(150),
          renderCell: (f) =>
            f.esTcs ? (
              <Badge variant="warning" label="Refrigerado TCS" />
            ) : (
              "—"
            ),
        },
      ]}
    />
  );
}
