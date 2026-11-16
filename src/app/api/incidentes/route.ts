import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/incidentes (RF-U06 botón «tuve un problema» / RF-A03 protocolo de salud)
// Si es de salud: pausa inmediata de cocinera y plato + lista de clientes del lote (72 h).

function logAccion(accion: string, detalle?: string): string {
  return JSON.stringify([
    { accion, detalle: detalle ?? null, hora: new Date().toISOString() },
  ]);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      pedidoId: string;
      tipo: "salud" | "calidad" | "otro";
      descripcion: string;
    };

    const pedido = await db.pedido.findUnique({
      where: { id: body.pedidoId },
      include: { items: true, cocinera: { include: { usuario: true } } },
    });
    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    }

    let accionesIniciales = logAccion("incidente_recibido", `tipo: ${body.tipo}`);
    const alertas: string[] = [];

    if (body.tipo === "salud") {
      // (1) pausa inmediata de la cocinera y del plato
      await db.cocinera.update({
        where: { id: pedido.cocineraId },
        data: { estado: "suspendida", motivoEstado: "Incidente de salud abierto — revisión del panel" },
      });
      for (const item of pedido.items) {
        await db.plato.update({ where: { id: item.platoId }, data: { activo: false } });
      }
      accionesIniciales = JSON.stringify([
        { accion: "incidente_recibido", detalle: `tipo: ${body.tipo}`, hora: new Date().toISOString() },
        { accion: "cocinera_pausada", detalle: pedido.cocinera.usuario.nombre, hora: new Date().toISOString() },
        { accion: "platos_pausados", detalle: pedido.items.map((i) => i.nombrePlato).join(", "), hora: new Date().toISOString() },
      ]);

      // (2) lista automática de clientes que compraron ESE LOTE en 72 h (RF-A03):
      // la trazabilidad va por lote real, no solo por plato.
      const hace72h = new Date(Date.now() - 72 * 3600 * 1000);
      const lotesAfectados = pedido.items
        .map((i) => i.lote)
        .filter((l): l is string => Boolean(l));
      const recientes = await db.pedido.findMany({
        where: {
          cocineraId: pedido.cocineraId,
          fecha: { gte: hace72h },
          ...(lotesAfectados.length > 0
            ? { items: { some: { lote: { in: lotesAfectados } } } }
            : { items: { some: { platoId: { in: pedido.items.map((i) => i.platoId) } } } }),
        },
        include: { cliente: true, items: true },
      });
      alertas.push(
        `${recientes.length} cliente(s) compraron ${lotesAfectados.length > 0 ? `el/los lote(s) ${lotesAfectados.join(", ")}` : "estos platos"} en las últimas 72 horas — lista lista para contactar.`
      );
    }

    const incidente = await db.incidente.create({
      data: {
        pedidoId: pedido.id,
        tipo: body.tipo,
        descripcion: body.descripcion.trim(),
        acciones: accionesIniciales,
        estado: body.tipo === "salud" ? "en_proceso" : "abierto",
      },
    });

    return NextResponse.json(
      {
        ok: true,
        incidente,
        alertas,
        texto:
          body.tipo === "salud"
            ? "Gracias por avisar. Pausamos la cocina y el plato mientras la familia Wasakaka lo revisa. Te contactaremos."
            : "Gracias por avisar. La familia Wasakaka revisará tu reclamo y te responderá.",
        notificacion: `Incidente registrado (${body.tipo})`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/incidentes", e);
    return NextResponse.json({ error: "No pudimos registrar el incidente." }, { status: 500 });
  }
}
