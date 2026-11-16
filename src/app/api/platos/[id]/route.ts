import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validarPlato } from "@/lib/cumplimiento";
import { aCentavos, aDolares } from "@/lib/dinero";

// PATCH /api/platos/[id] — editar, activar/desactivar (RF-C03/C04/C05)
// DELETE /api/platos/[id] — borrar plato

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      nombre?: string;
      descripcion?: string;
      precio?: number;
      categoria?: string;
      categoriaTributaria?: "gravado" | "exento";
      esTcs?: boolean;
      ingredientes?: string;
      alergenos?: string[];
      fotoUrl?: string;
      activo?: boolean;
    };

    const plato = await db.plato.findUnique({
      where: { id },
      include: { cocinera: true },
    });
    if (!plato) {
      return NextResponse.json({ error: "Plato no encontrado." }, { status: 404 });
    }

    const datos = {
      nombre: body.nombre?.trim() ?? plato.nombre,
      descripcion: body.descripcion?.trim() ?? plato.descripcion,
      precio:
        body.precio !== undefined ? aCentavos(Number(body.precio)) : plato.precio,
      categoria: body.categoria ?? plato.categoria,
      categoriaTributaria:
        body.categoriaTributaria === "exento" || body.categoriaTributaria === "gravado"
          ? body.categoriaTributaria
          : plato.categoriaTributaria,
      esTcs: body.esTcs ?? plato.esTcs,
      ingredientes: body.ingredientes?.trim() ?? plato.ingredientes,
      alergenos: body.alergenos ?? (JSON.parse(plato.alergenos || "[]") as string[]),
      fotoUrl: body.fotoUrl ?? plato.fotoUrl,
    };

    // Motor de cumplimiento en servidor, también al editar
    // Registro DSHS con fecha PROPIA (documento distinto de la tarjeta)
    const dshsVigente =
      Boolean(plato.cocinera.numeroDshs) &&
      Boolean(plato.cocinera.numeroDshsVence) &&
      plato.cocinera.numeroDshsVence!.getTime() > Date.now();

    const veredicto = validarPlato({
      ...datos,
      cocineraVendeTcs: plato.cocinera.vendeTcs,
      cocineraDshsVigente: dshsVigente,
    });

    const quiereActivar = body.activo === true;
    if (!veredicto.ok) {
      // si el plato estaba activo y la edición lo incumple → queda pausado
      await db.plato.update({
        where: { id },
        data: { activo: false },
      });
      return NextResponse.json(
        {
          error:
            "Con estos cambios el plato deja de cumplir la ley de comida casera (SB 541). Lo pausamos para que nadie pueda encargarlo.",
          violaciones: veredicto.violaciones,
          mensajes: veredicto.mensajes,
        },
        { status: 422 }
      );
    }

    const actualizado = await db.plato.update({
      where: { id },
      data: {
        ...datos,
        alergenos: JSON.stringify(datos.alergenos),
        activo: body.activo !== undefined ? body.activo : plato.activo,
      },
    });

    return NextResponse.json({
      ok: true,
      plato: { ...actualizado, precio: aDolares(actualizado.precio), alergenos: JSON.parse(actualizado.alergenos) },
      mensajes: veredicto.mensajes,
      notificacion: quiereActivar
        ? `Plato publicado: ${actualizado.nombre}`
        : `Plato actualizado: ${actualizado.nombre}`,
    });
  } catch (e) {
    console.error("PATCH /api/platos/[id]", e);
    return NextResponse.json({ error: "No pudimos actualizar el plato." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const enUso = await db.pedidoItem.findFirst({ where: { platoId: id } });
    if (enUso) {
      // hay pedidos históricos: solo se pausa, nunca se borra (trazabilidad)
      await db.plato.update({ where: { id }, data: { activo: false } });
      return NextResponse.json({
        ok: true,
        pausado: true,
        mensaje:
          "Este plato tiene pedidos históricos, así que lo pausamos en vez de borrarlo (así queda la trazabilidad de tus ventas).",
        notificacion: "Plato pausado",
      });
    }
    await db.plato.delete({ where: { id } });
    return NextResponse.json({ ok: true, notificacion: "Plato eliminado" });
  } catch (e) {
    console.error("DELETE /api/platos/[id]", e);
    return NextResponse.json({ error: "No pudimos eliminar el plato." }, { status: 500 });
  }
}
