import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estadoTarjeta, nivelTopeVentas, TOPE_VENTAS_ANUAL_CENTAVOS } from "@/lib/cumplimiento";
import { comisionAplicable, aDolares, DIAS_AVISO_PROMO } from "@/lib/dinero";
import { ventasDelAno, ventasDelMes } from "@/lib/ventas";

// GET /api/cocineras/[id]/panel
// Datos completos del panel de la cocinera: perfil, platos, agenda,
// pedidos del día, mis números (RF-C11) y contador del tope legal (RF-C10).
// El dinero sale en DÓLARES (la base lo guarda en centavos) listo para mostrar.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const cocinera = await db.cocinera.findUnique({
      where: { id },
      include: {
        usuario: { select: { nombre: true, telefono: true, zona: true, idioma: true } },
        platos: { orderBy: { createdAt: "desc" } },
        agendas: {
          where: { fecha: { gte: new Date().toISOString().slice(0, 10) } },
          orderBy: { fecha: "asc" },
        },
      },
    });
    if (!cocinera) {
      return NextResponse.json({ error: "Cocinera no encontrada." }, { status: 404 });
    }

    const pedidos = await db.pedido.findMany({
      where: {
        cocineraId: id,
        // pedidos recientes: últimos 7 días
        fecha: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      },
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        items: true,
        entrega: true,
        calificacion: true,
        agenda: { select: { fecha: true, horaCorte: true } },
      },
      orderBy: { fecha: "desc" },
    });

    const tarjeta = estadoTarjeta(cocinera.tarjetaVence);

    // Tope legal (RF-C10 + RF-I04): ventas del AÑO calendario en curso
    // (plataforma + ajuste manual fuera de la plataforma), calculado en vivo.
    const contadorAno = await ventasDelAno(id);
    const tope = nivelTopeVentas(contadorAno.totalCentavos);

    // Comisión: fuente única; las fundadoras en promoción pagan 0% (RF-P04)
    const ventasMesCentavos = await ventasDelMes(id);
    const comisionPct = comisionAplicable(cocinera, ventasMesCentavos);
    const enPromo = comisionPct < 8 && cocinera.comisionPromo != null;
    const diasParaFinPromo = cocinera.promoHasta
      ? Math.ceil((cocinera.promoHasta.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Mis números (RF-C11): día / semana / mes
    const inicioDia = new Date();
    inicioDia.setHours(0, 0, 0, 0);
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - 6);
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const rango = (desde: Date) =>
      pedidos.filter(
        (p) => p.fecha >= desde && p.estado !== "cancelado" && p.metodoPago === "tarjeta"
      );
    const suma = (ps: typeof pedidos) =>
      Math.round(ps.reduce((acc, p) => acc + p.subtotal, 0));
    const comisiones = (ps: typeof pedidos) =>
      Math.round(ps.reduce((acc, p) => acc + p.comision, 0));

    // Suscripción real (RF-P05): el estado vive en la base. Sin registro activo
    // para el período no se muestra «próximo cobro».
    const ahora = new Date();
    const periodo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
    const suscripcion = await db.suscripcion.findFirst({
      where: { cocineraId: id, estado: { in: ["activa", "cobrada"] }, periodo },
      orderBy: { createdAt: "desc" },
    });
    const proximoCobro = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);

    return NextResponse.json({
      cocinera: {
        id: cocinera.id,
        nombre: cocinera.usuario.nombre,
        telefono: cocinera.usuario.telefono,
        zona: cocinera.usuario.zona,
        bio: cocinera.bio,
        estado: cocinera.estado,
        motivoEstado: cocinera.motivoEstado,
        plan: cocinera.plan,
        vendeTcs: cocinera.vendeTcs,
        numeroDshs: cocinera.numeroDshs,
        numeroDshsVence: cocinera.numeroDshsVence,
        radioEntregaKm: cocinera.radioEntregaKm,
        aceptaEfectivo: cocinera.aceptaEfectivo,
        comisionPct,
        promocionFundadora: enPromo,
        promoHasta: cocinera.promoHasta,
        avisoSalidaPromo: enPromo && diasParaFinPromo != null && diasParaFinPromo <= DIAS_AVISO_PROMO,
        diasParaFinPromo,
        ventasFuera: aDolares(cocinera.ventasFueraPlataforma),
      },
      tarjeta: {
        nivel: tarjeta.nivel,
        diasRestantes: tarjeta.diasRestantes,
        vence: cocinera.tarjetaVence,
      },
      topeLegal: {
        ventasPlataforma: aDolares(contadorAno.plataformaCentavos),
        ventasFuera: aDolares(contadorAno.fueraCentavos),
        ventasAnioActual: aDolares(contadorAno.totalCentavos),
        tope: TOPE_VENTAS_ANUAL_CENTAVOS / 100,
        porcentaje: tope.porcentaje,
        nivel: tope.nivel,
      },
      suscripcion: suscripcion
        ? {
            activa: true,
            cuotaMensual: aDolares(suscripcion.monto),
            estado: suscripcion.estado,
            proximoCobro: proximoCobro.toISOString(),
          }
        : {
            activa: false,
            cuotaMensual: cocinera.plan === "fundadora" ? 19 : 29,
            estado: null,
            proximoCobro: null,
          },
      platos: cocinera.platos.map((p) => ({
        ...p,
        precio: aDolares(p.precio),
        alergenos: JSON.parse(p.alergenos || "[]") as string[],
      })),
      agendas: cocinera.agendas,
      pedidos: pedidos.map((p) => ({
        id: p.id,
        estado: p.estado,
        tipoEntrega: p.tipoEntrega,
        metodoPago: p.metodoPago,
        direccionEntrega: p.direccionEntrega,
        subtotal: aDolares(p.subtotal),
        comision: aDolares(p.comision),
        netoCocinera: aDolares(p.netoCocinera),
        total: aDolares(p.total),
        codigoCierre: p.codigoCierre,
        fechaEntrega: p.fechaEntrega,
        fecha: p.fecha,
        cliente: p.cliente,
        items: p.items.map((i) => ({ ...i, precioUnitario: aDolares(i.precioUnitario) })),
        entrega: p.entrega,
        calificacion: p.calificacion,
      })),
      numeros: {
        ventasHoy: suma(rango(inicioDia)) / 100,
        ventasSemana: suma(rango(inicioSemana)) / 100,
        ventasMes: suma(rango(inicioMes)) / 100,
        pedidosHoy: rango(inicioDia).length,
        comisionesPagadasSemana: comisiones(rango(inicioSemana)) / 100,
        pedidosActivos: pedidos.filter(
          (p) => !["entregado", "cancelado"].includes(p.estado)
        ).length,
      },
    });
  } catch (e) {
    console.error("GET /api/cocineras/[id]/panel", e);
    return NextResponse.json({ error: "No pudimos cargar tu panel." }, { status: 500 });
  }
}
