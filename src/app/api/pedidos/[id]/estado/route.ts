import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { puedeTransicionar, ESTADO_LABEL } from "@/lib/dinero";

// PATCH /api/pedidos/[id]/estado (RF-C08)
// Cambia el estado del pedido con reglas de quién puede pasar a qué estado.

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      estado: string;
      rol: "cocinera" | "cliente" | "admin";
    };

    const pedido = await db.pedido.findUnique({
      where: { id },
      include: { entrega: true },
    });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    const destino = body.estado;
    if (!puedeTransicionar(pedido.estado, destino, body.rol ?? "cocinera")) {
      return NextResponse.json(
        {
          error: `Un pedido «${ESTADO_LABEL[pedido.estado]}» no puede pasar a «${ESTADO_LABEL[destino] ?? destino}».`,
        },
        { status: 422 }
      );
    }

    // al cancelar pedido prepagado → reembolso simulado (RF-P06)
    let reembolso = false;
    if (destino === "cancelado") {
      const pago = await db.pago.findUnique({ where: { pedidoId: id } });
      if (pago && pago.estado === "pagado") {
        await db.pago.update({
          where: { id: pago.id },
          data: { estado: "reembolsado", reembolsoId: `re_${Date.now().toString(36)}` },
        });
        reembolso = true;
      }
    }

    // al salir a entrega: arranca el seguimiento en vivo (RF-U05)
    if (destino === "en_entrega") {
      await db.entrega.upsert({
        where: { pedidoId: id },
        create: {
          pedidoId: id,
          latActual: 32.7357,
          lngActual: -97.3308,
          progreso: 0,
          horaSalida: new Date(),
        },
        update: { horaSalida: new Date(), progreso: 0 },
      });
    }

    if (destino === "para_recogida" && !pedido.entrega) {
      await db.entrega.create({ data: { pedidoId: id } });
    }

    const actualizado = await db.pedido.update({
      where: { id },
      data: { estado: destino },
    });

    return NextResponse.json({
      ok: true,
      pedido: actualizado,
      reembolso,
      notificacion: `Pedido ${ESTADO_LABEL[destino]}`,
      // RF-N01: el aviso interno va «En la app» — WhatsApp llega en la fase de integración real
      aviso: `Aviso en la app para el cliente: tu pedido está ${ESTADO_LABEL[destino]}`,
    });
  } catch (e) {
    console.error("PATCH /api/pedidos/[id]/estado", e);
    return NextResponse.json({ error: "No pudimos actualizar el pedido." }, { status: 500 });
  }
}
