import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MESES_PROMO_FUNDADORA, COMISION_PROMO_FUNDADORAS } from "@/lib/dinero";

// POST /api/cocineras/habilitacion (RF-C01)
// Asistente de habilitación: crea la cuenta en estado «pendiente» hasta
// que el panel de administración la apruebe.
// Las fundadoras entran a la promoción de lanzamiento: 0% de comisión por 6
// meses (RF-P04, mecanismo comisionPromo/promoHasta).

interface CuerpoHabilitacion {
  nombre: string;
  telefono: string;
  correo?: string;
  zona: string;
  direccionCasa: string; // privada, nunca pública
  vendeTcs: boolean;
  numeroDshs?: string;
  numeroDshsVence?: string; // fecha YYYY-MM-DD: el registro DSHS vence por separado
  tarjetaManipuladorUrl?: string; // nombre de archivo subido (simulado en MVP)
  tarjetaVence?: string; // fecha YYYY-MM-DD de la tarjeta de manipulador
  radioEntregaKm: number;
  plan: "fundadora" | "regular";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<CuerpoHabilitacion>;

    // Validación de campos obligatorios del asistente
    const faltan: string[] = [];
    if (!body.nombre?.trim()) faltan.push("nombre");
    if (!body.telefono?.trim()) faltan.push("teléfono");
    if (!body.zona?.trim()) faltan.push("barrio/zona");
    if (!body.direccionCasa?.trim()) faltan.push("dirección de casa");
    if (!body.tarjetaManipuladorUrl) faltan.push("tarjeta de manipulador de alimentos");
    if (body.vendeTcs && !body.numeroDshs?.trim()) {
      return NextResponse.json(
        {
          error:
            "Para vender refrigerados TCS necesitamos tu número de registro del DSHS (Texas Department of State Health Services).",
        },
        { status: 400 }
      );
    }
    if (body.vendeTcs && !body.numeroDshsVence) {
      return NextResponse.json(
        {
          error:
            "Falta la fecha de vencimiento de tu registro DSHS: es un documento distinto de la tarjeta de manipulador y vence por separado.",
        },
        { status: 400 }
      );
    }
    if (faltan.length > 0) {
      return NextResponse.json(
        { error: `Faltan datos del asistente: ${faltan.join(", ")}.` },
        { status: 400 }
      );
    }

    // ¿correo o teléfono ya registrados?
    const existente = await db.usuario.findFirst({
      where: { OR: [{ telefono: body.telefono }, ...(body.correo ? [{ correo: body.correo }] : [])] },
    });
    if (existente) {
      return NextResponse.json(
        { error: "Ya existe una cuenta con ese teléfono o correo." },
        { status: 409 }
      );
    }

    const usuario = await db.usuario.create({
      data: {
        rol: "cocinera",
        nombre: body.nombre!.trim(),
        telefono: body.telefono!.trim(),
        correo: body.correo?.trim() || null,
        idioma: "es",
        zona: body.zona,
      },
    });

    // fecha de fin de la promoción fundadora: 6 meses desde hoy (activación)
    const promoHasta =
      body.plan === "regular"
        ? null
        : new Date(Date.now() + MESES_PROMO_FUNDADORA * 30 * 24 * 3600 * 1000);

    const cocinera = await db.cocinera.create({
      data: {
        usuarioId: usuario.id,
        direccionCasa: body.direccionCasa!,
        vendeTcs: Boolean(body.vendeTcs),
        numeroDshs: body.vendeTcs ? body.numeroDshs!.trim() : null,
        numeroDshsVence: body.vendeTcs ? new Date(body.numeroDshsVence + "T12:00:00") : null,
        tarjetaManipuladorUrl: body.tarjetaManipuladorUrl!,
        tarjetaVence: body.tarjetaVence ? new Date(body.tarjetaVence + "T12:00:00") : null,
        radioEntregaKm: Number(body.radioEntregaKm) || 5,
        plan: body.plan === "regular" ? "regular" : "fundadora",
        estado: "pendiente",
        bio: body.zona ? `Cocinera del barrio ${body.zona}.` : null,
        comisionPromo: body.plan === "regular" ? null : COMISION_PROMO_FUNDADORAS,
        promoHasta,
      },
    });

    // Notificación simulada (RF-N01): en producción sale por WhatsApp al panel
    return NextResponse.json(
      {
        ok: true,
        cocineraId: cocinera.id,
        estado: "pendiente",
        mensaje:
          "¡Tu solicitud quedó enviada! La familia Wasakaka la revisará y te avisamos en la aplicación (normalmente en menos de 24 horas).",
        notificacion: `Nueva cocinera pendiente de aprobación: ${usuario.nombre}`,
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("POST /api/cocineras/habilitacion", e);
    return NextResponse.json({ error: "No pudimos registrar tu solicitud." }, { status: 500 });
  }
}
