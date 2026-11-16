import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { aDolares } from "@/lib/dinero";

// GET /api/catalogo?zona=&categoria=&alergenos=&dia=
// Público (RF-U01, RF-U02): cocineras activas de la zona y sus platos activos.
// Ingredientes y alérgenos SIEMPRE visibles en la respuesta.

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const zona = sp.get("zona") ?? undefined;
  const categoria = sp.get("categoria") ?? undefined;
  const alergenosEvitar = (sp.get("alergenos") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const dia = sp.get("dia") ?? undefined; // YYYY-MM-DD o "todos"

  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const cocineras = await db.cocinera.findMany({
      where: {
        estado: "activa",
        ...(zona && zona !== "todas" ? { usuario: { zona } } : {}),
      },
      include: {
        usuario: {
          select: { nombre: true, zona: true, telefono: true, idioma: true },
        },
        platos: { where: { activo: true }, orderBy: { createdAt: "asc" } },
        agendas: {
          where: { activa: true, fecha: { gte: hoy } },
          orderBy: { fecha: "asc" },
        },
      },
    });

    // calificaciones para reputación (RF-U07 alimenta el orden del catálogo)
    const resenas = await db.calificacion.findMany({
      select: { cocineraId: true, estrellas: true },
    });
    const tarifas = new Map<string, { suma: number; total: number }>();
    for (const r of resenas) {
      const t = tarifas.get(r.cocineraId) ?? { suma: 0, total: 0 };
      t.suma += r.estrellas;
      t.total += 1;
      tarifas.set(r.cocineraId, t);
    }

    const resultado = cocineras
      .map((c) => {
        const platosFiltrados = c.platos.filter((p) => {
          if (categoria && categoria !== "todas" && p.categoria !== categoria) return false;
          if (alergenosEvitar.length > 0) {
            const alergenos: string[] = JSON.parse(p.alergenos || "[]");
            if (alergenosEvitar.some((a) => alergenos.includes(a))) return false;
          }
          return true;
        });

        const agendasFiltradas =
          dia && dia !== "todos" ? c.agendas.filter((a) => a.fecha === dia) : c.agendas;

        const cal = tarifas.get(c.id);
        const promedio = cal && cal.total > 0 ? Math.round((cal.suma / cal.total) * 10) / 10 : null;

        return {
          id: c.id,
          nombre: c.usuario.nombre,
          zona: c.usuario.zona,
          bio: c.bio,
          fotoUrl: c.fotoUrl,
          radioEntregaKm: c.radioEntregaKm,
          aceptaEfectivo: c.aceptaEfectivo,
          calificacionPromedio: promedio,
          totalResenas: cal?.total ?? 0,
          agendas: agendasFiltradas.map((a) => ({
            id: a.id,
            fecha: a.fecha,
            horaCorte: a.horaCorte,
            capacidadPedidos: a.capacidadPedidos,
          })),
          platos: platosFiltrados.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            precio: aDolares(p.precio),
            categoria: p.categoria,
            esTcs: p.esTcs,
            ingredientes: p.ingredientes,
            alergenos: JSON.parse(p.alergenos || "[]") as string[],
            fotoUrl: p.fotoUrl,
          })),
        };
      })
      .filter((c) => c.platos.length > 0)
      .sort((a, b) => (b.calificacionPromedio ?? 0) - (a.calificacionPromedio ?? 0));

    const zonas = [
      ...new Set(
        (
          await db.usuario.findMany({
            where: { cocinera: { estado: "activa" } },
            select: { zona: true },
          })
        )
          .map((u) => u.zona)
          .filter((z): z is string => Boolean(z))
      ),
    ];

    return NextResponse.json({ cocineras: resultado, zonas, dia: dia ?? "todos" });
  } catch (e) {
    console.error("GET /api/catalogo", e);
    return NextResponse.json({ error: "No pudimos cargar el catálogo." }, { status: 500 });
  }
}
