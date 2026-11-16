import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/demo/identidades
// Etapa de demo: entrega las cuentas sembradas para que la app permita
// "ver la app como" cliente / cocinera / admin sin login completo.
// SEGURIDAD: solo existe con DEMO_MODE=1 en el entorno. Sin esa variable el
// endpoint responde 404 y la app no muestra el cambiador de rol: no hay forma
// de llegar al panel de administración desde la interfaz.
// En producción esto lo reemplaza Supabase Auth (sesiones reales).

export async function GET() {
  if (process.env.DEMO_MODE !== "1") {
    return NextResponse.json({ error: "No disponible." }, { status: 404 });
  }

  try {
    const usuarios = await db.usuario.findMany({
      where: { rol: { in: ["cliente", "admin"] } },
      orderBy: { rol: "asc" },
    });
    const cocineras = await db.cocinera.findMany({
      include: { usuario: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      cliente: usuarios.find((u) => u.rol === "cliente") ?? null,
      admin: usuarios.find((u) => u.rol === "admin") ?? null,
      cocineras: cocineras.map((c) => ({
        id: c.id,
        usuarioId: c.usuarioId,
        nombre: c.usuario.nombre,
        zona: c.usuario.zona,
        estado: c.estado,
        plan: c.plan,
      })),
    });
  } catch (e) {
    console.error("GET /api/demo/identidades", e);
    return NextResponse.json({ error: "No pudimos cargar las identidades." }, { status: 500 });
  }
}
