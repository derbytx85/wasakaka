import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/agenda/[id] — editar hora de corte, capacidad o pausar el día
// DELETE /api/agenda/[id] — desactivar el día (solo si no tiene pedidos activos)

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      horaCorte?: string;
      capacidadPedidos?: number;
      activa?: boolean;
    };

    const agenda = await db.agendaCocina.findUnique({ where: { id } });
    if (!agenda) {
      return NextResponse.json({ error: "Día no encontrado." }, { status: 404 });
    }

    const actualizada = await db.agendaCocina.update({
      where: { id },
      data: {
        ...(body.horaCorte ? { horaCorte: body.horaCorte } : {}),
        ...(body.capacidadPedidos !== undefined
          ? { capacidadPedidos: Math.max(1, Number(body.capacidadPedidos)) }
          : {}),
        ...(body.activa !== undefined ? { activa: body.activa } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      agenda: actualizada,
      notificacion: body.activa === false ? "Día pausado" : "Día actualizado",
    });
  } catch (e) {
    console.error("PATCH /api/agenda/[id]", e);
    return NextResponse.json({ error: "No pudimos actualizar el día." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agenda = await db.agendaCocina.findUnique({
      where: { id },
      include: { pedidos: true },
    });
    if (!agenda) {
      return NextResponse.json({ error: "Día no encontrado." }, { status: 404 });
    }
    const activos = agenda.pedidos.filter(
      (p) => !["entregado", "cancelado"].includes(p.estado)
    );
    if (activos.length > 0) {
      await db.agendaCocina.update({ where: { id }, data: { activa: false } });
      return NextResponse.json({
        ok: true,
        pausado: true,
        mensaje:
          "Este día tiene pedidos activos, así que lo pausamos en vez de borrarlo. Avisa a los clientes si no podrás cocinar.",
        notificacion: "Día pausado (tiene pedidos)",
      });
    }
    await db.agendaCocina.delete({ where: { id } });
    return NextResponse.json({ ok: true, notificacion: "Día eliminado" });
  } catch (e) {
    console.error("DELETE /api/agenda/[id]", e);
    return NextResponse.json({ error: "No pudimos eliminar el día." }, { status: 500 });
  }
}
