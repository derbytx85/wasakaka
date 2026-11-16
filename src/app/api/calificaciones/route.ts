import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/calificaciones (RF-U07)
// 1–5 estrellas y comentario tras la entrega; la cocinera puede responder.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pedidoId: string;
      clienteId: string;
      estrellas: number;
      comentario?: string;
      respuestaCocinera?: string;
      cocineraId?: string; // solo para respuesta
    };

    if (body.respuestaCocinera && body.cocineraId) {
      const cal = await db.calificacion.findUnique({ where: { pedidoId: body.pedidoId } });
      if (!cal) {
        return NextResponse.json({ error: "Calificación no encontrada." }, { status: 404 });
      }
      const actualizada = await db.calificacion.update({
        where: { id: cal.id },
        data: { respuestaCocinera: body.respuestaCocinera.trim() },
      });
      return NextResponse.json({ ok: true, calificacion: actualizada, notificacion: "Respuesta enviada" });
    }

    const estrellas = Math.max(1, Math.min(5, Number(body.estrellas)));
    const pedido = await db.pedido.findUnique({ where: { id: body.pedidoId } });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }
    if (pedido.estado !== "entregado") {
      return NextResponse.json(
        { error: "Solo puedes calificar pedidos ya entregados." },
        { status: 409 }
      );
    }

    const calificacion = await db.calificacion.upsert({
      where: { pedidoId: body.pedidoId },
      create: {
        pedidoId: body.pedidoId,
        clienteId: body.clienteId,
        cocineraId: pedido.cocineraId,
        estrellas,
        comentario: body.comentario?.trim() || null,
      },
      update: { estrellas, comentario: body.comentario?.trim() || null },
    });

    return NextResponse.json({
      ok: true,
      calificacion,
      notificacion: "¡Gracias por calificar!",
    });
  } catch (e) {
    console.error("POST /api/calificaciones", e);
    return NextResponse.json({ error: "No pudimos guardar tu calificación." }, { status: 500 });
  }
}
