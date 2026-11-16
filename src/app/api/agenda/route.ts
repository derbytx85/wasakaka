import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/agenda (RF-C07) — la cocinera activa un día de cocina
// con hora de corte y capacidad máxima de pedidos.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cocineraId: string;
      fecha: string; // YYYY-MM-DD
      horaCorte: string; // HH:MM
      capacidadPedidos?: number;
    };

    if (!body.cocineraId || !body.fecha || !body.horaCorte) {
      return NextResponse.json(
        { error: "Faltan datos: cocinera, fecha y hora de corte." },
        { status: 400 }
      );
    }

    const existente = await db.agendaCocina.findFirst({
      where: { cocineraId: body.cocineraId, fecha: body.fecha },
    });
    if (existente) {
      return NextResponse.json(
        { error: `Ya tienes un día de cocina el ${body.fecha}. Edítalo en la lista.` },
        { status: 409 }
      );
    }

    const agenda = await db.agendaCocina.create({
      data: {
        cocineraId: body.cocineraId,
        fecha: body.fecha,
        horaCorte: body.horaCorte,
        capacidadPedidos: Math.max(1, Number(body.capacidadPedidos) || 10),
        activa: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        agenda,
        mensaje: `Día de cocina activado: ${agenda.fecha}. Los clientes pueden encargar hasta las ${agenda.horaCorte}.`,
        notificacion: "Día de cocina activado",
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/agenda", e);
    return NextResponse.json({ error: "No pudimos activar el día." }, { status: 500 });
  }
}
