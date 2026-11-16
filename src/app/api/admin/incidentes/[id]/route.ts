import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/admin/incidentes/[id] (RF-A03)
// Ejecuta el protocolo: contactar lote, cerrar incidente, reabrir cocinera.
// Toda acción queda registrada con hora como evidencia.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      accion: "contactar_lote" | "cerrar" | "reabrir_cocinera" | "nota";
      nota?: string;
    };

    const incidente = await db.incidente.findUnique({
      where: { id },
      include: {
        pedido: {
          include: {
            items: true,
            cocinera: { include: { usuario: true } },
          },
        },
      },
    });
    if (!incidente) {
      return NextResponse.json({ error: "Incidente no encontrado." }, { status: 404 });
    }

    const accionesPrevias = JSON.parse(
      (incidente.acciones || "[]") as string
    ) as { accion: string; detalle: string | null; hora: string }[];

    const nuevaAccion = {
      accion: body.accion,
      detalle: body.nota?.trim() ?? null,
      hora: new Date().toISOString(),
    };

    let mensaje = "";
    const datos: Record<string, unknown> = { acciones: JSON.stringify([...accionesPrevias, nuevaAccion]) };

    if (body.accion === "contactar_lote") {
      const hace72h = new Date(Date.now() - 72 * 3600 * 1000);
      // trazabilidad POR LOTE real (RF-A03); si el pedido histórico no registró
      // lote, se respalda por plato para no dejar clientes sin avisar.
      const lotesAfectados = incidente.pedido.items
        .map((i) => i.lote)
        .filter((l): l is string => Boolean(l));
      const compradores = await db.pedido.findMany({
        where: {
          cocineraId: incidente.pedido.cocineraId,
          fecha: { gte: hace72h },
          ...(lotesAfectados.length > 0
            ? { items: { some: { lote: { in: lotesAfectados } } } }
            : { items: { some: { platoId: { in: incidente.pedido.items.map((i) => i.platoId) } } } }),
        },
        include: { cliente: true },
      });
      nuevaAccion.detalle =
        body.nota?.trim() ??
        `${compradores.length} cliente(s) listados para contactar por ${
          lotesAfectados.length > 0 ? `el/los lote(s) ${lotesAfectados.join(", ")}` : "los platos del pedido"
        }`;
      datos.acciones = JSON.stringify([...accionesPrevias, nuevaAccion]);
      mensaje = `Lista de contacto generada: ${compradores.length} cliente(s) en 72 horas por lote.`;
      datos.estado = "en_proceso";
    }

    if (body.accion === "reabrir_cocinera") {
      await db.cocinera.update({
        where: { id: incidente.pedido.cocineraId },
        data: { estado: "activa", motivoEstado: "Reactivada tras revisión de incidente" },
      });
      for (const item of incidente.pedido.items) {
        await db.plato.updateMany({ where: { id: item.platoId }, data: { activo: true } });
      }
      nuevaAccion.detalle = `Cocinera ${incidente.pedido.cocinera.usuario.nombre} reactivada con platos`;
      datos.acciones = JSON.stringify([...accionesPrevias, nuevaAccion]);
      mensaje = "Cocinera reactivada. Solo manual, tras revisión (RF-A03).";
    }

    if (body.accion === "cerrar") {
      datos.estado = "cerrado";
      nuevaAccion.detalle = body.nota?.trim() ?? "Incidente cerrado tras revisión";
      datos.acciones = JSON.stringify([...accionesPrevias, nuevaAccion]);
      mensaje = "Incidente cerrado.";
    }

    if (body.accion === "nota") {
      mensaje = "Nota agregada al expediente.";
    }

    const actualizado = await db.incidente.update({ where: { id }, data: datos });

    return NextResponse.json({
      ok: true,
      incidente: actualizado,
      mensaje,
      notificacion: `Incidente: ${body.accion.replace("_", " ")}`,
    });
  } catch (e) {
    console.error("POST /api/admin/incidentes/[id]", e);
    return NextResponse.json({ error: "No pudimos ejecutar la acción." }, { status: 500 });
  }
}
