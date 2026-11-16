import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// PATCH /api/admin/cocineras/[id] (RF-A01)
// Aprobar / rechazar / pausar / reactivar con motivo. Todo queda registrado
// como auditoría (quién y cuándo — en producción, desde la sesión del admin).

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await req.json()) as {
      accion: "aprobar" | "rechazar" | "pausar" | "reactivar";
      motivo?: string;
    };

    const cocinera = await db.cocinera.findUnique({
      where: { id },
      include: { usuario: true },
    });
    if (!cocinera) {
      return NextResponse.json({ error: "Cocinera no encontrada." }, { status: 404 });
    }

    let estado: string;
    let motivo = body.motivo?.trim() || null;

    switch (body.accion) {
      case "aprobar":
        // no se aprueba sin tarjeta de manipulador vigente (RF-C01)
        if (!cocinera.tarjetaManipuladorUrl) {
          return NextResponse.json(
            { error: "No se puede aprobar sin tarjeta de manipulador de alimentos." },
            { status: 422 }
          );
        }
        if (cocinera.vendeTcs && !cocinera.numeroDshs) {
          return NextResponse.json(
            { error: "No se puede aprobar una cocinera TCS sin número de registro DSHS." },
            { status: 422 }
          );
        }
        estado = "activa";
        motivo = motivo ?? "Aprobada por el panel";
        break;
      case "rechazar":
        estado = "rechazada";
        motivo = motivo || "Rechazada por el panel";
        break;
      case "pausar":
        estado = "suspendida";
        motivo = motivo || "Pausada por el panel";
        break;
      case "reactivar":
        estado = "activa";
        motivo = motivo ?? "Reactivada por el panel";
        break;
      default:
        return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
    }

    const actualizada = await db.cocinera.update({
      where: { id },
      data: { estado, motivoEstado: motivo },
    });

    return NextResponse.json({
      ok: true,
      cocinera: { id: actualizada.id, estado: actualizada.estado },
      notificacion: `${cocinera.usuario.nombre}: ${estado}`,
      aviso: `Aviso en la app para ${cocinera.usuario.nombre}: tu cuenta está ${estado} (WhatsApp llega en la fase de integración real — demo)`,
    });
  } catch (e) {
    console.error("PATCH /api/admin/cocineras/[id]", e);
    return NextResponse.json({ error: "No pudimos actualizar la cocinera." }, { status: 500 });
  }
}
