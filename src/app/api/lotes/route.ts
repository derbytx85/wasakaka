import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/lotes (RF-C12)
// Registro de lote y pH por producción de encurtidos/fermentados.
// Se conserva 12 meses por ley y es exportable desde el panel.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cocineraId: string;
      platoId: string;
      lote: string;
      ph?: number;
    };

    if (!body.cocineraId || !body.platoId || !body.lote?.trim()) {
      return NextResponse.json(
        { error: "Faltan datos: cocinera, plato y lote." },
        { status: 400 }
      );
    }

    const registro = await db.registroLote.create({
      data: {
        cocineraId: body.cocineraId,
        platoId: body.platoId,
        lote: body.lote.trim().toUpperCase(),
        ph: body.ph && !Number.isNaN(Number(body.ph)) ? Number(body.ph) : null,
      },
    });

    const borrarAntes = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    await db.registroLote.deleteMany({ where: { fecha: { lt: borrarAntes } } });

    return NextResponse.json(
      {
        ok: true,
        registro,
        mensaje: `Lote ${registro.lote} guardado. Se conserva 12 meses por ley.`,
        notificacion: "Lote registrado",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/lotes", e);
    return NextResponse.json({ error: "No pudimos registrar el lote." }, { status: 500 });
  }
}

// GET /api/lotes?cocineraId= — histórico (12 meses) exportable
export async function GET(req: NextRequest) {
  const cocineraId = req.nextUrl.searchParams.get("cocineraId");
  if (!cocineraId) {
    return NextResponse.json({ error: "Falta la cocinera." }, { status: 400 });
  }
  try {
    const hace12meses = new Date(Date.now() - 365 * 24 * 3600 * 1000);
    const registros = await db.registroLote.findMany({
      where: { cocineraId, fecha: { gte: hace12meses } },
      include: { plato: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    });
    return NextResponse.json({
      registros: registros.map((r) => ({
        id: r.id,
        lote: r.lote,
        ph: r.ph,
        fecha: r.fecha,
        plato: r.plato.nombre,
      })),
    });
  } catch (e) {
    console.error("GET /api/lotes", e);
    return NextResponse.json({ error: "No pudimos cargar los lotes." }, { status: 500 });
  }
}
