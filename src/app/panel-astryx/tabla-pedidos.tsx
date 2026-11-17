"use client";

// Tabla de pedidos recientes con el componente Table de Astryx.
// Es cliente porque usa renderCell (insignias de estado), que no puede
// cruzar el límite servidor→cliente; los datos llegan ya formateados
// desde el servidor (page.tsx), sin recalcular dinero aquí.
import { Table, proportional, pixel } from "@astryxdesign/core/Table";
import { Badge } from "@astryxdesign/core/Badge";

export interface FilaPedido extends Record<string, unknown> {
  id: string;
  hora: string;
  cliente: string;
  cocinera: string;
  entrega: string;
  total: string;
  comision: string;
  estado: string;
}

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

// El estado se lee de un vistazo por color: amarillo = hay que actuar,
// colores fríos = en curso, neutro = cerrado.
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

export function TablaPedidos({ filas }: { filas: FilaPedido[] }) {
  return (
    <Table
      data={filas}
      idKey="id"
      density="balanced"
      dividers="rows"
      isStriped
      hasHover
      columns={[
        { key: "hora", header: "Hora", width: pixel(84) },
        {
          key: "cliente",
          header: "Cliente",
          width: proportional(1, { minWidth: 140 }),
        },
        {
          key: "cocinera",
          header: "Cocinera",
          width: proportional(1, { minWidth: 140 }),
        },
        {
          key: "entrega",
          header: "Entrega",
          width: proportional(1, { minWidth: 130 }),
        },
        { key: "total", header: "Total", width: pixel(96), align: "end" },
        { key: "comision", header: "Comisión", width: pixel(96), align: "end" },
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
