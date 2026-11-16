import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/clientes (RF-U01)
// Registro de cliente: nombre, teléfono y correo. Se invoca desde el carrito
// al confirmar el primer pedido (la especificación pide registro recién al
// momento de pagar, no antes).

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      nombre?: string;
      telefono?: string;
      correo?: string;
      zona?: string;
    };

    const faltan: string[] = [];
    if (!body.nombre?.trim()) faltan.push("nombre");
    if (!body.telefono?.trim()) faltan.push("teléfono");
    if (faltan.length > 0) {
      return NextResponse.json(
        { error: `Faltan datos del registro: ${faltan.join(", ")}.` },
        { status: 400 }
      );
    }

    const telefono = body.telefono!.trim();
    const correo = body.correo?.trim() || null;

    // ¿teléfono o correo ya registrados?
    const existente = await db.usuario.findFirst({
      where: { OR: [{ telefono }, ...(correo ? [{ correo }] : [])] },
    });
    if (existente) {
      // si ya existe y es cliente, devolvemos la cuenta (fricción mínima al pagar)
      if (existente.rol === "cliente") {
        return NextResponse.json({
          ok: true,
          cliente: { id: existente.id, nombre: existente.nombre },
          yaRegistrado: true,
          mensaje: `Bienvenida de vuelta, ${existente.nombre}.`,
        });
      }
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese teléfono o correo." },
        { status: 409 }
      );
    }

    const cliente = await db.usuario.create({
      data: {
        rol: "cliente",
        nombre: body.nombre!.trim(),
        telefono,
        correo,
        idioma: "es",
        zona: body.zona?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        cliente: { id: cliente.id, nombre: cliente.nombre },
        mensaje: `¡Listo, ${cliente.nombre}! Ya puedes confirmar tu pedido.`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/clientes", e);
    return NextResponse.json({ error: "No pudimos crear tu cuenta." }, { status: 500 });
  }
}
