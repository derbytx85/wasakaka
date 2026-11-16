import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calcularDesglose, aDolares } from "@/lib/dinero";

// POST /api/desglose
// Desglose de carrito calculado SOLO en el servidor (RF-I01): el cliente nunca
// calcula impuestos. La tasa real depende de la dirección y la categoría, así
// que mientras no exista cálculo por dirección la línea se rótula «Impuesto
// estimado» en todas las pantallas.
// Entrada: { items: [{ platoId, cantidad }] }
// Salida: { subtotal, impuestoEstimado, total, lineas: [...] }

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      items?: { platoId: string; cantidad: number }[];
    };

    if (!body.items?.length) {
      return NextResponse.json({ error: "Faltan los items del carrito." }, { status: 400 });
    }

    const platos = await db.plato.findMany({
      where: { id: { in: body.items.map((i) => i.platoId) }, activo: true },
    });

    let subtotalCentavos = 0;
    let gravadoCentavos = 0;
    const lineas: {
      platoId: string;
      nombre: string;
      precio: number;
      cantidad: number;
      importe: number;
      tributo: "gravado" | "exento";
    }[] = [];

    for (const item of body.items) {
      const plato = platos.find((p) => p.id === item.platoId);
      if (!plato) continue;
      const cantidad = Math.max(1, Math.min(20, item.cantidad));
      const importe = plato.precio * cantidad;
      subtotalCentavos += importe;
      if (plato.categoriaTributaria !== "exento") gravadoCentavos += importe;
      lineas.push({
        platoId: plato.id,
        nombre: plato.nombre,
        precio: aDolares(plato.precio),
        cantidad,
        importe: aDolares(importe),
        tributo: plato.categoriaTributaria === "exento" ? "exento" : "gravado",
      });
    }

    // comisión de referencia del desglose: estándar (8%) — es informativa para
    // el panel de la cocinera, JAMÁS se muestra ni se cobra al comprador.
    const desglose = calcularDesglose(aDolares(subtotalCentavos), undefined, {
      subtotalGravado: aDolares(gravadoCentavos),
    });

    return NextResponse.json({
      subtotal: desglose.subtotal,
      impuestoEstimado: desglose.impuesto,
      total: desglose.total,
      lineas,
    });
  } catch (e) {
    console.error("POST /api/desglose", e);
    return NextResponse.json({ error: "No pudimos calcular el desglose." }, { status: 500 });
  }
}
