import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/pedidos/[id]/cerrar (RF-C09 / RF-U06)
// La entrega se cierra con el código de 4 dígitos del cliente.
// Sin cierre no hay entrega confirmada (y el efectivo se registra aquí).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { codigo: string };

    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { entrega: true, pago: true },
    });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }
    if (pedido.estado === "entregado") {
      return NextResponse.json({ error: "Este pedido ya está entregado." }, { status: 409 });
    }

    if (body.codigo?.trim() !== pedido.codigoCierre) {
      return NextResponse.json(
        { error: "El código no coincide. Pídele el código de 4 dígitos al cliente." },
        { status: 403 }
      );
    }

    await db.pedido.update({ where: { id }, data: { estado: "entregado" } });
    await db.entrega.upsert({
      where: { pedidoId: id },
      create: { pedidoId: id, progreso: 1, horaEntrega: new Date(), evidencia: `cierre-${pedido.codigoCierre}` },
      update: { progreso: 1, horaEntrega: new Date(), evidencia: `cierre-${pedido.codigoCierre}` },
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Entrega confirmada. ¡Buen provecho!",
      notificacion: "Entrega cerrada con código",
      aviso: "Aviso en la app para el cliente: tu pedido fue entregado. ¡Califícalo!",
    });
  } catch (e) {
    console.error("POST /api/pedidos/[id]/cerrar", e);
    return NextResponse.json({ error: "No pudimos cerrar la entrega." }, { status: 500 });
  }
}
