import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validarPlato } from "@/lib/cumplimiento";
import { aCentavos, aDolares } from "@/lib/dinero";

// POST /api/platos (RF-C03/C04/C05)
// Crear plato: pasa SIEMPRE por el motor de cumplimiento en el servidor.
// Un plato se crea inactivo; el PATCH /activo lo publica si cumple.

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      cocineraId: string;
      nombre?: string;
      descripcion?: string;
      precio?: number;
      categoria?: string;
      categoriaTributaria?: "gravado" | "exento";
      esTcs?: boolean;
      ingredientes?: string;
      alergenos?: string[];
      fotoUrl?: string;
      loteRequerido?: boolean;
      activarAhora?: boolean;
    };

    if (!body.cocineraId) {
      return NextResponse.json({ error: "Falta la cocinera." }, { status: 400 });
    }

    const cocinera = await db.cocinera.findUnique({
      where: { id: body.cocineraId },
      include: { usuario: true },
    });
    if (!cocinera) {
      return NextResponse.json({ error: "Cocinera no encontrada." }, { status: 404 });
    }
    if (cocinera.estado !== "activa") {
      return NextResponse.json(
        { error: "Tu cuenta aún no está activa. Espera la aprobación del panel." },
        { status: 403 }
      );
    }

    // Registro DSHS vigente: fecha PROPIA del registro DSHS (documento distinto
    // de la tarjeta de manipulador; vencen por separado).
    const dshsVigente =
      Boolean(cocinera.numeroDshs) &&
      Boolean(cocinera.numeroDshsVence) &&
      cocinera.numeroDshsVence!.getTime() > Date.now();

    const veredicto = validarPlato({
      nombre: body.nombre ?? "",
      descripcion: body.descripcion ?? "",
      precio: Number(body.precio) || 0,
      categoria: body.categoria ?? "",
      esTcs: Boolean(body.esTcs),
      ingredientes: body.ingredientes ?? "",
      alergenos: body.alergenos ?? [],
      cocineraVendeTcs: cocinera.vendeTcs,
      cocineraDshsVigente: dshsVigente,
    });

    if (!veredicto.ok) {
      return NextResponse.json(
        {
          error:
            "Este plato no se puede publicar. La ley de comida casera de Texas (SB 541) no lo permite.",
          violaciones: veredicto.violaciones,
          mensajes: veredicto.mensajes,
        },
        { status: 422 }
      );
    }

    const plato = await db.plato.create({
      data: {
        cocineraId: body.cocineraId,
        nombre: body.nombre!.trim(),
        descripcion: body.descripcion!.trim(),
        precio: aCentavos(Number(body.precio)),
        categoria: body.categoria!,
        categoriaTributaria: body.categoriaTributaria === "exento" ? "exento" : "gravado",
        esTcs: Boolean(body.esTcs),
        ingredientes: body.ingredientes!.trim(),
        alergenos: JSON.stringify(body.alergenos ?? []),
        fotoUrl: body.fotoUrl || "/img/conchas.png",
        loteRequerido: Boolean(body.loteRequerido) || body.categoria === "conservas",
        activo: Boolean(body.activarAhora), // se publica solo si el motor dio ok
      },
    });

    return NextResponse.json(
      {
        ok: true,
        plato: { ...plato, precio: aDolares(plato.precio), alergenos: JSON.parse(plato.alergenos) },
        mensajes: veredicto.mensajes,
        notificacion: `Plato creado: ${plato.nombre}${plato.activo ? " y publicado" : " (borrador)"}`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/platos", e);
    return NextResponse.json({ error: "No pudimos crear el plato." }, { status: 500 });
  }
}
