import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aCentavos } from "@/lib/dinero";

// PATCH /api/cocineras/[id]/ventas-fuera (RF-I04)
// Ajuste manual de ventas fuera de la plataforma: la cocinera declara sus
// ventas directas y se suman al contador del tope legal anual. Se guarda en
// centavos; el número llega en dólares desde la pantalla «Mis números».

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as { ventasFueraPlataforma?: number | string };

    const valor = Number(body.ventasFueraPlataforma);
    if (Number.isNaN(valor) || valor < 0) {
      return NextResponse.json(
        { error: "Escribe un monto válido (0 o más), en dólares." },
        { status: 400 }
      );
    }

    const actualizada = await db.cocinera.update({
      where: { id },
      data: { ventasFueraPlataforma: aCentavos(valor) },
    });

    return NextResponse.json({
      ok: true,
      ventasFueraPlataforma: actualizada.ventasFueraPlataforma / 100,
      mensaje:
        "Tus ventas directas quedaron registradas: se suman al contador del tope legal (no pasan por Wasakaka).",
      notificacion: "Ajuste registrado",
    });
  } catch (e) {
    console.error("PATCH /api/cocineras/[id]/ventas-fuera", e);
    return NextResponse.json({ error: "No pudimos guardar el ajuste." }, { status: 500 });
  }
}
